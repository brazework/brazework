"use server";
import { revalidatePath } from "next/cache";
import { rank } from "@/lib/communities";
import { env } from "@/lib/env";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { clubDiscord } from "./announce";
import { DISCORD_WEBHOOK, sendDiscord, updateMessage } from "./discord";

// Club integrations (supabase/integrations.sql). Row-level security enforces admins-only changes;
// these actions add plain-English errors and a test message before anything is saved.

type R = { ok: boolean; message: string };
const ID = /^[A-Za-z0-9-]{1,64}$/;

async function officer(cid: string, min: number) {
  const { supabase, user } = await getViewer();
  if (!user || !ID.test(cid)) return null;
  const { data } = await supabase.from("community_members").select("role, communities(name)").eq("community_id", cid).eq("uid", user.id).maybeSingle();
  const row = data as unknown as { role: string; communities: { name: string } | null } | null;
  return row && rank(row.role) >= min ? { supabase, name: row.communities?.name ?? "your club" } : null;
}

export async function connectDiscord(cid: string, url: string, opts: { events: boolean; milestones: boolean; updates: boolean }): Promise<R> {
  const o = await officer(cid, 4);
  if (!o) return { ok: false, message: "Only the club's admins and owner can connect Discord." };
  const hook = url.trim();
  if (!DISCORD_WEBHOOK.test(hook)) return { ok: false, message: "Paste a Discord webhook link: Server settings → Integrations → Webhooks → Copy webhook URL." };
  // Prove the webhook works before saving it.
  const test = await sendDiscord(hook, { username: `Brazework · ${o.name}`.slice(0, 80), content: `Brazework is connected. ${o.name}'s events, verified milestones and weekly updates can now be announced here.`, allowed_mentions: { parse: [] } });
  if (!test.ok) return test;
  const { error } = await o.supabase.from("club_integrations").upsert({ community_id: cid, discord_webhook: hook, discord_events: opts.events, discord_milestones: opts.milestones, discord_updates: opts.updates });
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Connected. Check your Discord channel for the test message." };
}

export async function updateDiscordSettings(cid: string, opts: { events: boolean; milestones: boolean; updates: boolean }): Promise<R> {
  const o = await officer(cid, 4);
  if (!o) return { ok: false, message: "Only the club's admins and owner can change this." };
  const { error } = await o.supabase.from("club_integrations").update({ discord_events: opts.events, discord_milestones: opts.milestones, discord_updates: opts.updates }).eq("community_id", cid);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Saved." };
}

export async function disconnectDiscord(cid: string): Promise<R> {
  const o = await officer(cid, 4);
  if (!o) return { ok: false, message: "Only the club's admins and owner can disconnect Discord." };
  const { error } = await o.supabase.from("club_integrations").delete().eq("community_id", cid);
  if (error) return { ok: false, message: friendlyError(error) };
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Disconnected. Brazework won't post to that channel any more." };
}

// Officers share a post (like the weekly update) to the club's Discord.
export async function shareToDiscord(cid: string, text: string): Promise<R> {
  const o = await officer(cid, 3);
  if (!o) return { ok: false, message: "Only the club's moderators, admins and owner can post to its Discord." };
  const body = text.trim();
  if (!body) return { ok: false, message: "Nothing to share." };
  const d = await clubDiscord(o.supabase, cid);
  if (!d) return { ok: false, message: "This club hasn't connected Discord yet. An admin can do it under Manage → Integrations." };
  if (!d.discord_updates) return { ok: false, message: "Updates to Discord are turned off for this club." };
  return sendDiscord(d.discord_webhook, updateMessage(o.name, cid, body, env.siteUrl));
}
