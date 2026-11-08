"use server";
import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// Network mutations, ported from public/js/network.js. Reusable from any page (the profile page
// drops in components/network/connect-buttons.tsx, which calls these).
// Connections are two-way and start as a request; follows are one-way. Sending a request also
// follows that person and accepting follows them back. Decline, withdraw and remove are the same
// thing: the connection row goes away. Row-level security in supabase/schema.sql enforces who can do what.

export type ActionResult = { ok: boolean; message: string };

// The person fields the database copies onto connections.people and follows.*_info (person_info()).
export type PersonInfo = { firstName?: string; lastName?: string; headline?: string; field?: string; accountType?: "student" | "professional" };
export type Person = { id: string; firstName: string; lastName: string; headline: string; field: string; accountType: string };

// Where the viewer stands with someone else.
export type Relationship = {
  status: "none" | "sent" | "received" | "connected";
  connId: string | null;
  note: string;
  following: boolean;
};

const memberId = z.guid("That member couldn't be found.");
const connId = z.string().trim().min(1, "That request couldn't be found.").max(64);
const noteSchema = z.string().trim().max(300, "Notes can be up to 300 characters.");

const signedOut: ActionResult = { ok: false, message: "Log in again to do that." };

// Re-render the network page, and whatever page the action came from (a profile, the feed...).
function done(message = ""): ActionResult {
  revalidatePath("/network");
  refresh();
  return { ok: true, message };
}

type Sb = Awaited<ReturnType<typeof getViewer>>["supabase"];
// Following someone you already follow is fine.
async function followQuietly(supabase: Sb, target: string) {
  return supabase.from("follows").upsert({ target }, { onConflict: "follower,target", ignoreDuplicates: true });
}

export async function sendConnectionRequest(otherId: string, note = ""): Promise<ActionResult> {
  const id = memberId.safeParse(otherId);
  const n = noteSchema.safeParse(note ?? "");
  if (!id.success) return { ok: false, message: id.error.issues[0]?.message ?? "Check that member." };
  if (!n.success) return { ok: false, message: n.error.issues[0]?.message ?? "Check your note." };
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  if (user.id === id.data) return { ok: false, message: "You can't connect with yourself." };
  const { error } = await supabase.from("connections").insert({ to_id: id.data, note: n.data });
  if (error) {
    // connections_pair_idx: there can only ever be one connection or request between two people.
    if (error.code === "23505") return { ok: false, message: "You already have a connection or a pending request with this member." };
    return { ok: false, message: friendlyError(error) };
  }
  await followQuietly(supabase, id.data);
  return done("Request sent.");
}

// Accept (only the person who received it can) or decline (either person) a pending request.
export async function respondToRequest(requestId: string, accept: boolean): Promise<ActionResult> {
  const id = connId.safeParse(requestId);
  if (!id.success) return { ok: false, message: id.error.issues[0]?.message ?? "Check that request." };
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  if (!accept) {
    const { error } = await supabase.from("connections").delete().eq("id", id.data);
    if (error) return { ok: false, message: friendlyError(error) };
    return done();
  }
  // Row-level security skips rows you can't change without an error, so check something changed.
  const { data, error } = await supabase
    .from("connections")
    .update({ status: "accepted" })
    .eq("id", id.data)
    .eq("to_id", user.id)
    .eq("status", "pending")
    .select("from_id");
  if (error) return { ok: false, message: friendlyError(error) };
  if (!data?.length) return { ok: false, message: "That request was withdrawn or already answered." };
  await followQuietly(supabase, data[0].from_id as string);
  return done("You're now connected.");
}

// "Accept all" on the invitations tab.
export async function acceptAllRequests(): Promise<ActionResult> {
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  const { data, error } = await supabase
    .from("connections")
    .update({ status: "accepted" })
    .eq("to_id", user.id)
    .eq("status", "pending")
    .select("from_id");
  if (error) return { ok: false, message: friendlyError(error) };
  const ids = (data ?? []).map((r) => r.from_id as string);
  if (ids.length) {
    await supabase.from("follows").upsert(ids.map((target) => ({ target })), { onConflict: "follower,target", ignoreDuplicates: true });
  }
  return done(ids.length === 1 ? "Accepted 1 invitation." : `Accepted ${ids.length} invitations.`);
}

// Withdraw a sent request, or remove an accepted connection.
export async function removeConnection(connectionId: string): Promise<ActionResult> {
  const id = connId.safeParse(connectionId);
  if (!id.success) return { ok: false, message: id.error.issues[0]?.message ?? "Check that connection." };
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  const { error } = await supabase.from("connections").delete().eq("id", id.data);
  if (error) return { ok: false, message: friendlyError(error) };
  return done();
}

export async function toggleFollow(targetId: string, follow: boolean): Promise<ActionResult> {
  const id = memberId.safeParse(targetId);
  if (!id.success) return { ok: false, message: id.error.issues[0]?.message ?? "Check that member." };
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  if (user.id === id.data) return { ok: false, message: "You can't follow yourself." };
  const { error } = follow
    ? await followQuietly(supabase, id.data)
    : await supabase.from("follows").delete().eq("follower", user.id).eq("target", id.data);
  if (error) return { ok: false, message: friendlyError(error) };
  return done();
}

// Counts a view of someone else's profile: once per viewer, per profile, per day, never your own
// (record_profile_view() in supabase/activity.sql decides). Never gets in the way of the page, so
// it never throws and doesn't re-render anything.
export async function recordProfileView(profileId: string): Promise<void> {
  const id = memberId.safeParse(profileId);
  if (!id.success) return;
  try {
    const { supabase, user } = await getViewer();
    if (!user || user.id === id.data) return;
    await supabase.rpc("record_profile_view", { p_profile: id.data });
  } catch {
    // Analytics only.
  }
}

// Opens (or starts) a conversation with someone and goes to it, like the vanilla "Message" buttons.
// Not connected yet: start_conversation() makes it a message request, or refuses if they don't allow it.
export async function messageMember(otherId: string): Promise<ActionResult> {
  const id = memberId.safeParse(otherId);
  if (!id.success) return { ok: false, message: id.error.issues[0]?.message ?? "Check that member." };
  const { supabase, user } = await getViewer();
  if (!user) return signedOut;
  const { data, error } = await supabase.rpc("start_conversation", { p_other: id.data });
  if (error || !data) return { ok: false, message: friendlyError(error) };
  redirect(`/messages/${encodeURIComponent(String(data))}`);
}
