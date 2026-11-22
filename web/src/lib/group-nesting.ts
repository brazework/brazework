// Messages → Groups, one row per club (FIX-248): a club's team chats fold under its club chat instead of
// each taking a row. Pure, and tested (tests/group-nesting.test.ts).

type Chat = { id: string; kind: "club" | "event" | "team"; community_id: string | null; unread: boolean };
export type GroupRow<T extends Chat> = { chat: T; teams: T[]; teamUnread: boolean };

// Rows in the list's order (newest first). A club row carries its team chats (newest first) and moves up
// to the newest activity among them; a team chat whose club chat isn't in the list stays a row of its own.
export function nestGroups<T extends Chat & { lastAt: string | null }>(chats: T[]): GroupRow<T>[] {
  const clubOf = new Map<string, T>();
  for (const c of chats) if (c.kind === "club" && c.community_id) clubOf.set(c.community_id, c);
  const teamsOf = new Map<string, T[]>();
  const rows: GroupRow<T>[] = [];
  for (const c of chats) {
    if (c.kind === "team" && c.community_id && clubOf.has(c.community_id)) {
      teamsOf.set(c.community_id, [...(teamsOf.get(c.community_id) ?? []), c]);
      continue;
    }
    rows.push({ chat: c, teams: [], teamUnread: false });
  }
  for (const r of rows) {
    const teams = r.chat.kind === "club" && r.chat.community_id ? teamsOf.get(r.chat.community_id) ?? [] : [];
    r.teams = teams;
    r.teamUnread = teams.some((t) => t.unread);
  }
  const latest = (r: GroupRow<T>) => Math.max(Date.parse(r.chat.lastAt ?? "") || 0, ...r.teams.map((t) => Date.parse(t.lastAt ?? "") || 0));
  return rows.map((r, i) => ({ r, i })).sort((a, b) => latest(b.r) - latest(a.r) || a.i - b.i).map(({ r }) => r);
}
