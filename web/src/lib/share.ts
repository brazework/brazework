"use server";
import { revalidatePath } from "next/cache";
import { dbFeatures } from "@/lib/db-features";
import { friendlyError } from "@/lib/forge";
import { mediaUrl } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

// Sending a post to people: into your direct conversations and group chats, as a message carrying
// the post's link, which chat bubbles turn into a preview card (postPreview). Nothing new in the
// database: each send is an ordinary message, under every rule messages already have.

export type ShareTarget = { kind: "dm" | "group"; id: string; title: string; subtitle: string; first?: string; last?: string };

export async function shareTargets(): Promise<ShareTarget[]> {
  const { supabase, user } = await getViewer();
  if (!user) return [];
  const me = user.id;
  const [dms, groups] = await Promise.all([
    supabase.from("conversations").select("id, user_a, user_b, people, status, started_by").or(`user_a.eq.${me},user_b.eq.${me}`).eq("status", "active").order("last_message_at", { ascending: false, nullsFirst: false }).limit(30),
    (await dbFeatures()).groupChats ? supabase.rpc("my_chats") : Promise.resolve({ data: [] }),
  ]);
  type Row = { id: string; user_a: string; user_b: string; people: Record<string, { firstName?: string; lastName?: string; headline?: string }> };
  const people: ShareTarget[] = ((dms.data ?? []) as Row[]).map((c) => {
    const other = c.user_a === me ? c.user_b : c.user_a;
    const p = c.people?.[other] ?? {};
    return { kind: "dm", id: c.id, title: `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Forge member", subtitle: p.headline ?? "", first: p.firstName ?? "", last: p.lastName ?? "" };
  });
  const chats: ShareTarget[] = ((groups.data ?? []) as { id: string; kind: string; title: string; subtitle: string }[]).map((g) => ({ kind: "group", id: g.id, title: g.title, subtitle: g.subtitle }));
  return [...people, ...chats];
}

// Posts and events travel the same way: a message carrying the item's link.
export async function shareItem(kind: "post" | "events" | "projects", itemId: string, targets: { kind: "dm" | "group"; id: string }[], note: string): Promise<{ ok: boolean; message: string; sent: number }> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(itemId)) return { ok: false, message: `That ${kind === "post" ? "post" : kind === "events" ? "event" : "project"} wasn't found.`, sent: 0 };
  const picked = targets.filter((t) => /^[A-Za-z0-9-]{1,64}$/.test(t.id)).slice(0, 20);
  if (!picked.length) return { ok: false, message: "Pick someone to send it to.", sent: 0 };
  const text = `${note.trim().slice(0, 1500)}${note.trim() ? "\n" : ""}/${kind}/${itemId}`;
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again.", sent: 0 };
  const results = await Promise.all(picked.map((t) =>
    t.kind === "dm"
      ? supabase.from("messages").insert({ conversation_id: t.id, body: text })
      : supabase.from("chat_messages").insert({ chat_id: t.id, body: text })));
  const failed = results.filter((r) => r.error);
  revalidatePath("/messages", "layout");
  if (failed.length === picked.length) return { ok: false, message: friendlyError(failed[0].error), sent: 0 };
  return { ok: true, message: failed.length ? `Sent to ${picked.length - failed.length} of ${picked.length}.` : "", sent: picked.length - failed.length };
}

// What a shared post looks like inside a chat bubble.
export async function postPreview(postId: string): Promise<{ id: string; author: string; kind: string; body: string; hasMedia: boolean } | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(postId)) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { data } = await supabase.from("posts").select("id, author_first, author_last, kind, body").eq("id", postId).maybeSingle();
  if (!data) return null;
  const media = (await dbFeatures()).media ? await supabase.from("posts").select("media").eq("id", postId).maybeSingle() : { data: null };
  return { id: data.id, author: `${data.author_first} ${data.author_last}`.trim(), kind: data.kind, body: String(data.body).slice(0, 220), hasMedia: Array.isArray((media.data as { media?: unknown[] } | null)?.media) && ((media.data as { media: unknown[] }).media.length > 0) };
}

// What a shared event looks like inside a chat bubble.
export async function eventPreview(eventId: string): Promise<{ id: string; title: string; starts_at: string; going: number; where: string } | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(eventId)) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { data } = await supabase.from("events").select("id, title, starts_at, rsvp_count, format, location").eq("id", eventId).maybeSingle();
  if (!data) return null;
  return { id: data.id, title: data.title, starts_at: data.starts_at, going: data.rsvp_count ?? 0, where: data.format === "Online" ? "Online" : data.location || data.format };
}

// What a shared project looks like inside a chat bubble.
export async function projectPreview(projectId: string): Promise<{ id: string; title: string; summary: string; owner: string; status: string } | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(projectId)) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { data } = await supabase.from("projects").select("id, title, summary, status, profiles(first_name, last_name)").eq("id", projectId).maybeSingle();
  if (!data) return null;
  const o = (data as unknown as { profiles: { first_name: string; last_name: string } | null }).profiles;
  return { id: data.id, title: data.title, summary: String(data.summary).slice(0, 180), owner: `${o?.first_name ?? ""} ${o?.last_name ?? ""}`.trim(), status: data.status === "completed" ? "Completed" : "In progress" };
}

// What a club looks like as a card (in Ember's answers).
export async function clubPreview(clubId: string): Promise<{ id: string; name: string; about: string; members: number; privacy: string; logo: string | null; accent: string | null } | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(clubId)) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const look = (await dbFeatures()).clubProfile;
  const { data } = await supabase.from("communities").select(`id, name, about, member_count, privacy${look ? ", logo_path, tagline, accent" : ""}`).eq("id", clubId).maybeSingle();
  if (!data) return null;
  const c = data as unknown as { id: string; name: string; about: string; member_count: number; privacy: string; logo_path?: string; tagline?: string; accent?: string };
  return { id: c.id, name: c.name, about: (c.tagline || c.about || "").slice(0, 160), members: c.member_count ?? 0, privacy: c.privacy, logo: c.logo_path || null, accent: c.accent || null };
}

// What a person looks like as a card (in Ember's answers).
export async function personPreview(personId: string): Promise<{ id: string; first: string; last: string; headline: string; avatar: string | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(personId)) return null;
  const { supabase, user } = await getViewer();
  if (!user) return null;
  const { media } = await dbFeatures();
  const { data } = await supabase.from("profiles").select(`id, first_name, last_name, headline${media ? ", avatar_path" : ""}`).eq("id", personId).maybeSingle();
  if (!data) return null;
  const p = data as unknown as { id: string; first_name: string; last_name: string; headline: string; avatar_path?: string | null };
  return { id: p.id, first: p.first_name, last: p.last_name, headline: p.headline, avatar: p.avatar_path ? mediaUrl(p.avatar_path) : null };
}
