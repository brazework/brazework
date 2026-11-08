"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ALL_TOPICS } from "@/lib/forge";
import { COMMUNITY_FIELDS, LIMITS, cleanName, communityError } from "@/lib/communities";
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
