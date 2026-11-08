"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_TOPICS } from "@/lib/forge";
import { COMMUNITY_FIELDS, LIMITS, autoModVerdict, can, cleanName, communityError, normalizeAutomod, parseWords, rank, type Role } from "@/lib/communities";
import { dbFeatures } from "@/lib/db-features";
import { validMedia } from "@/lib/media";
import { getViewer } from "@/lib/supabase/server";

export type Result = { ok: boolean; message: string };
export type JoinResult = Result & { state?: "member" | "requested" | "none" };

const cidSchema = z.string().trim().min(1).max(64);

function revalidateCommunity(cid: string) {
  revalidatePath("/communities");
  revalidatePath(`/c/${cid}`);
  revalidatePath(`/c/${cid}/manage`);
}

/* ---------- Create ---------- */

export type CreateState = { ok: boolean; message: string };

const createSchema = z.object({
  name: z
    .string()
    .transform(cleanName)
    .pipe(z.string().min(3, "Give your community a name (at least 3 characters).").max(LIMITS.name, "Names can be up to 60 characters.")),
  about: z.string().trim().min(1, "Add a sentence about what the community is for.").max(LIMITS.about, "Keep the description under 500 characters."),
  field: z.string().refine((f) => COMMUNITY_FIELDS.includes(f), "Choose a main field."),
  type: z.enum(["field", "study", "project", "school"], { message: "Choose a type." }),
  privacy: z.enum(["public", "approval"], { message: "Choose who can join." }),
  topics: z
    .array(z.string().refine((t) => ALL_TOPICS.includes(t), "Pick topics from the list."))
    .max(LIMITS.topics, "Pick up to 3 topics.")
    .transform((t) => [...new Set(t)]),
  rules: z.string().trim().max(LIMITS.rules, "Rules can be up to 1,500 characters."),
});

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

// Creates the community with you as owner, in one step (create_community RPC), then opens it.
export async function createCommunity(_prev: CreateState, form: FormData): Promise<CreateState> {
  const parsed = createSchema.safeParse({
    name: str(form.get("name")),
    about: str(form.get("about")),
    field: str(form.get("field")),
    type: str(form.get("type")),
    privacy: str(form.get("privacy")),
    topics: form.getAll("topics").map(String),
    rules: str(form.get("rules")),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to create a community." };
  const d = parsed.data;

  const taken = await supabase.from("communities").select("id").eq("name_lower", d.name.toLowerCase()).limit(1);
  if (taken.error) return { ok: false, message: communityError(taken.error) };
  if (taken.data.length) return { ok: false, message: "A community with that name already exists. Try another name." };

  const { data: id, error } = await supabase.rpc("create_community", {
    p_name: d.name,
    p_about: d.about,
    p_field: d.field,
    p_type: d.type,
    p_privacy: d.privacy,
    p_topics: d.topics,
    p_rules: d.rules,
  });
  if (error || typeof id !== "string") return { ok: false, message: error ? communityError(error) : "Something went wrong. Try again." };
  revalidatePath("/communities");
  redirect(`/c/${id}?created=1`);
}

/* ---------- Join, request, withdraw, leave ---------- */

// Public: join right away. Approval required: send a request. The database fills in your name
// and moves the member count, and refuses anyone who's banned.
export async function joinCommunity(cidRaw: string): Promise<JoinResult> {
  const cid = cidSchema.safeParse(cidRaw);
  if (!cid.success) return { ok: false, message: "That community doesn't exist." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to join." };

  const { data: c, error: cErr } = await supabase.from("communities").select("id, name, privacy").eq("id", cid.data).maybeSingle();
  if (cErr) return { ok: false, message: communityError(cErr) };
  if (!c) return { ok: false, message: "That community doesn't exist any more." };

  const { error } =
    c.privacy === "public"
      ? await supabase.from("community_members").insert({ community_id: c.id, uid: user.id, role: "member" })
      : await supabase.from("community_requests").insert({ community_id: c.id });
  if (error && error.code !== "23505") {
    const { data: banned } = await supabase.rpc("am_banned", { cid: c.id });
    return { ok: false, message: banned === true ? "You've been banned from this community, so you can't join it." : communityError(error) };
  }
  revalidateCommunity(c.id);
  return c.privacy === "public"
    ? { ok: true, message: `Welcome to ${c.name}.`, state: "member" }
    : { ok: true, message: "Request sent. You'll be in once a moderator approves it.", state: "requested" };
}

export async function withdrawRequest(cidRaw: string): Promise<JoinResult> {
  const cid = cidSchema.safeParse(cidRaw);
  if (!cid.success) return { ok: false, message: "That community doesn't exist." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { error } = await supabase.from("community_requests").delete().eq("community_id", cid.data).eq("uid", user.id);
  if (error) return { ok: false, message: communityError(error) };
  revalidateCommunity(cid.data);
  return { ok: true, message: "Request withdrawn.", state: "none" };
}

export async function leaveCommunity(cidRaw: string): Promise<JoinResult> {
  const cid = cidSchema.safeParse(cidRaw);
  if (!cid.success) return { ok: false, message: "That community doesn't exist." };
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again." };
  const { data: me } = await supabase.from("community_members").select("role, communities(name)").eq("community_id", cid.data).eq("uid", user.id).maybeSingle();
  if (!me) return { ok: true, message: "You're not a member any more.", state: "none" };
  if (me.role === "owner") return { ok: false, message: "Owners can't leave their own community." };
  const { data, error } = await supabase.from("community_members").delete().eq("community_id", cid.data).eq("uid", user.id).select("uid");
  if (error) return { ok: false, message: communityError(error) };
  if (!data.length) return { ok: false, message: "You don't have permission to do that." };
  revalidateCommunity(cid.data);
  const rel = me.communities as unknown as { name?: string } | { name?: string }[] | null;
  const name = (Array.isArray(rel) ? rel[0]?.name : rel?.name) || "the community";
  return { ok: true, message: `You left ${name}.`, state: "none" };
}

/* ---------- Posting (with auto-moderation) ---------- */


export async function postInCommunity(cidRaw: string, body: string, kind: string, tags: string[], mediaRaw: unknown = []): Promise<Result & { held?: boolean }> {
  const cid = cidSchema.safeParse(cidRaw);
  const text = body.trim();
  if (!cid.success) return { ok: false, message: "That community doesn't exist." };
  if (!text) return { ok: false, message: "Write something first." };
  if (text.length > 3000) return { ok: false, message: "Posts can be up to 3,000 characters." };
  if (!["update", "question", "result", "project"].includes(kind)) return { ok: false, message: "Pick a post type." };
  const cleanTags = tags.filter((t) => ALL_TOPICS.includes(t)).slice(0, 3);
  const { supabase, user } = await getViewer();
  if (!user) return { ok: false, message: "Log in again to post." };
  const [{ data: c }, { data: me }] = await Promise.all([
    supabase.from("communities").select("automod").eq("id", cid.data).maybeSingle(),
    supabase.from("community_members").select("role, joined_at").eq("community_id", cid.data).eq("uid", user.id).maybeSingle(),
  ]);
  if (!me) return { ok: false, message: "Join this community to post." };
  // Same rules as the vanilla app: matching posts wait for a moderator.
  const verdict = autoModVerdict(c?.automod, me, text, Date.now());
  const row: Record<string, unknown> = { body: text, kind, tags: cleanTags, community_id: cid.data, status: verdict.status };
  if (Array.isArray(mediaRaw) && mediaRaw.length) {
    const media = validMedia(mediaRaw, user.id);
    if (!media || !(await dbFeatures()).media) return { ok: false, message: "Something's wrong with those attachments. Remove them and try again." };
    row.media = media;
  }
  const { error } = await supabase.from("posts").insert(row);
  if (error) return { ok: false, message: communityError(error) };
  revalidateCommunity(cid.data);
  revalidatePath("/feed");
  return { ok: true, message: verdict.note ?? "", held: verdict.status === "held" };
}

/* ---------- Moderation (the database re-checks every rank) ---------- */

async function myRole(cid: string) {
  const { supabase, user } = await getViewer();
  if (!user) return { supabase, user: null, role: null as Role | null };
  const { data } = await supabase.from("community_members").select("role").eq("community_id", cid).eq("uid", user.id).maybeSingle();
  return { supabase, user, role: (data?.role as Role | undefined) ?? null };
}
const denied: Result = { ok: false, message: "You don't have permission to do that." };

export async function approvePost(cid: string, postId: string): Promise<Result> {
  const { supabase, role } = await myRole(cid);
  if (!can(role, "review")) return denied;
  const { data, error } = await supabase.from("posts").update({ status: "visible" }).eq("id", postId).eq("community_id", cid).select("id");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return denied;
  revalidateCommunity(cid);
  return { ok: true, message: "Post published." };
}

export async function removeCommunityPost(cid: string, postId: string): Promise<Result> {
  const { supabase, user, role } = await myRole(cid);
  if (!user) return denied;
  const { data, error } = await supabase.from("posts").delete().eq("id", postId).eq("community_id", cid).select("id");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return can(role, "removePosts") ? { ok: false, message: "That post was already removed." } : denied;
  revalidateCommunity(cid);
  return { ok: true, message: "Post removed." };
}

export async function approveJoin(cid: string, uid: string): Promise<Result> {
  const { supabase, role } = await myRole(cid);
  if (!can(role, "approve")) return denied;
  const { error } = await supabase.rpc("approve_request", { p_cid: cid, p_uid: uid });
  if (error) return { ok: false, message: communityError(error) };
  revalidateCommunity(cid);
  return { ok: true, message: "Approved." };
}

export async function declineJoin(cid: string, uid: string): Promise<Result> {
  const { supabase, role } = await myRole(cid);
  if (!can(role, "approve")) return denied;
  const { error } = await supabase.from("community_requests").delete().eq("community_id", cid).eq("uid", uid);
  if (error) return { ok: false, message: communityError(error) };
  revalidateCommunity(cid);
  return { ok: true, message: "Declined." };
}

// Everyone can only act on people below their own role.
export async function setMemberRole(cid: string, uid: string, current: Role, next: Role): Promise<Result> {
  const { supabase, user, role } = await myRole(cid);
  if (!user || !can(role, "roles") || uid === user.id) return denied;
  if (rank(current) >= rank(role) || rank(next) >= rank(role)) return { ok: false, message: "You can only assign roles below your own." };
  const { data, error } = await supabase.from("community_members").update({ role: next }).eq("community_id", cid).eq("uid", uid).select("uid");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return denied;
  revalidateCommunity(cid);
  return { ok: true, message: "Role updated." };
}

export async function removeMember(cid: string, uid: string, current: Role, ban: boolean): Promise<Result> {
  const { supabase, user, role } = await myRole(cid);
  if (!user || !can(role, "removeMembers") || uid === user.id || rank(current) >= rank(role)) return denied;
  if (ban) {
    const { error } = await supabase.from("community_bans").insert({ community_id: cid, uid });
    if (error && error.code !== "23505") return { ok: false, message: communityError(error) };
  }
  const { data, error } = await supabase.from("community_members").delete().eq("community_id", cid).eq("uid", uid).select("uid");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return denied;
  revalidateCommunity(cid);
  return { ok: true, message: ban ? "Removed and banned." : "Removed." };
}

export async function unbanMember(cid: string, uid: string): Promise<Result> {
  const { supabase, role } = await myRole(cid);
  if (!can(role, "removeMembers")) return denied;
  const { error } = await supabase.from("community_bans").delete().eq("community_id", cid).eq("uid", uid);
  if (error) return { ok: false, message: communityError(error) };
  revalidateCommunity(cid);
  return { ok: true, message: "Unbanned." };
}

export async function updateCommunitySettings(_prev: CreateState, form: FormData): Promise<CreateState> {
  const cid = str(form.get("cid"));
  const { supabase, role } = await myRole(cid);
  if (!can(role, "editInfo")) return denied;
  const about = str(form.get("about")).trim();
  const rules = str(form.get("rules")).trim();
  const privacy = str(form.get("privacy"));
  if (!about || about.length > LIMITS.about) return { ok: false, message: "Add a description under 500 characters." };
  if (rules.length > LIMITS.rules) return { ok: false, message: "Rules can be up to 1,500 characters." };
  if (privacy !== "public" && privacy !== "approval") return { ok: false, message: "Choose who can join." };
  const changes: Record<string, unknown> = { about, rules, privacy };
  if (can(role, "automod")) {
    const wordsText = str(form.get("words"));
    if (wordsText.length > LIMITS.wordsText) return { ok: false, message: "The word list is too long." };
    changes.automod = normalizeAutomod({ words: parseWords(wordsText), holdNewLinks: form.get("holdNewLinks") === "on" });
  }
  const { data, error } = await supabase.from("communities").update(changes).eq("id", cid).select("id");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return denied;
  revalidateCommunity(cid);
  return { ok: true, message: "Saved." };
}

// Club cover (supabase/media.sql): uploaded by an admin into their own folder.
export async function setCommunityCover(cid: string, path: string): Promise<Result> {
  const { supabase, user, role } = await myRole(cid);
  if (!user || !can(role, "editInfo")) return denied;
  if (path && !new RegExp(`^${user.id}/[A-Za-z0-9._-]+$`).test(path)) return { ok: false, message: "That file couldn't be used." };
  const { data, error } = await supabase.from("communities").update({ cover_path: path }).eq("id", cid).select("id");
  if (error) return { ok: false, message: error.code === "42703" ? "Photos aren't turned on yet." : communityError(error) };
  if (!data?.length) return denied;
  revalidateCommunity(cid);
  return { ok: true, message: path ? "Cover updated." : "Cover removed." };
}

/* ---------- Invite links (supabase/invites.sql) ---------- */

export type Invite = { code: string; created_at: string; expires_at: string | null; max_uses: number | null; uses: number; revoked: boolean };

export async function createInvite(cid: string, days: number | null, maxUses: number | null): Promise<Result & { code?: string }> {
  const { supabase, user, role } = await myRole(cid);
  if (!user || !can(role, "approve")) return denied;
  if (days !== null && ![1, 7, 30].includes(days)) return { ok: false, message: "Choose how long the link lasts." };
  if (maxUses !== null && ![10, 25, 100].includes(maxUses)) return { ok: false, message: "Choose a use limit." };
  const expires_at = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString();
  const { data, error } = await supabase.from("community_invites").insert({ community_id: cid, expires_at, max_uses: maxUses }).select("code").single();
  if (error) return { ok: false, message: communityError(error) };
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Link created.", code: data.code as string };
}

export async function revokeInvite(cid: string, code: string): Promise<Result> {
  const { supabase, user, role } = await myRole(cid);
  if (!user || !can(role, "approve")) return denied;
  const { data, error } = await supabase.from("community_invites").update({ revoked: true }).eq("code", code).eq("community_id", cid).select("code");
  if (error) return { ok: false, message: communityError(error) };
  if (!data?.length) return denied;
  revalidatePath(`/c/${cid}/manage`);
  return { ok: true, message: "Link turned off." };
}
