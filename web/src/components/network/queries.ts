import { createClient, getViewer } from "@/lib/supabase/server";
import type { Person, PersonInfo, Relationship } from "@/lib/network";

// Server-only reads for the network (Server Components only: this imports next/headers).
// Ported from public/js/network.js.

export type ConnectionRow = {
  id: string;
  from_id: string;
  to_id: string;
  users: string[];
  status: "pending" | "accepted";
  note: string;
  people: Record<string, PersonInfo>;
  created_at: string;
  accepted_at: string | null;
};

export type FollowRow = {
  follower: string;
  target: string;
  follower_info: PersonInfo;
  target_info: PersonInfo;
  created_at: string;
};

export const CONNECTION_COLS = "id, from_id, to_id, users, status, note, people, created_at, accepted_at";
export const FOLLOW_COLS = "follower, target, follower_info, target_info, created_at";

export function toPerson(id: string, info: PersonInfo | null | undefined): Person {
  return {
    id,
    firstName: info?.firstName ?? "",
    lastName: info?.lastName ?? "",
    headline: info?.headline ?? "",
    field: info?.field ?? "",
    accountType: info?.accountType ?? "",
  };
}

// The other person in a connection record.
export function otherOf(conn: ConnectionRow, me: string): Person {
  const id = (conn.users ?? []).find((u) => u !== me) ?? (conn.from_id === me ? conn.to_id : conn.from_id);
  return toPerson(id, conn.people?.[id]);
}

const pair = (a: string, b: string) => `and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`;

// Where the signed-in person stands with `otherId`: none, sent, received or connected, and whether
// they follow them. Pass this to <ConnectButtons relationship={...} />. Null when signed out or it's you.
export async function getRelationship(otherId: string): Promise<Relationship | null> {
  const { supabase, user } = await getViewer();
  if (!user || user.id === otherId) return null;
  const [c, f] = await Promise.all([
    supabase.from("connections").select("id, from_id, status, note").or(pair(user.id, otherId)).limit(1),
    supabase.from("follows").select("target").eq("follower", user.id).eq("target", otherId),
  ]);
  if (c.error || f.error) return null;
  const conn = c.data?.[0] as { id: string; from_id: string; status: string; note: string } | undefined;
  const status: Relationship["status"] = !conn ? "none" : conn.status === "accepted" ? "connected" : conn.from_id === user.id ? "sent" : "received";
  return { status, connId: conn?.id ?? null, note: conn?.note ?? "", following: (f.data?.length ?? 0) > 0 };
}

// Connections, followers and following for any member (null when a count can't be read).
export async function getNetworkCounts(uid: string) {
  const supabase = await createClient();
  const n = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    const { count, error } = await q;
    return error ? null : (count ?? 0);
  };
  const head = (t: string) => supabase.from(t).select("*", { count: "exact", head: true });
  const [connections, followers, following] = await Promise.all([
    n(head("connections").contains("users", [uid]).eq("status", "accepted")),
    n(head("follows").eq("target", uid)),
    n(head("follows").eq("follower", uid)),
  ]);
  return { connections, followers, following };
}

// Pending invitations for the signed-in person (for a nav badge).
export async function getPendingRequestCount(): Promise<number> {
  const { supabase, user } = await getViewer();
  if (!user) return 0;
  const { count, error } = await supabase.from("connections").select("*", { count: "exact", head: true }).eq("to_id", user.id).eq("status", "pending");
  return error ? 0 : (count ?? 0);
}
