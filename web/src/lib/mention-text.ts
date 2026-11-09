// @mentions in post text (supabase/mentions.sql). A post stores who it mentions as [{ id, name }];
// the text keeps the plain "@First Last". These helpers are shared by the composer and the feed.

export type Mention = { id: string; name: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Only the people whose "@Name" is still in the text (they may have been deleted while editing).
export function keepMentioned(body: string, picked: Mention[]): Mention[] {
  const seen = new Set<string>();
  return picked.filter((m) => body.includes(`@${m.name}`) && !seen.has(m.id) && seen.add(m.id)).slice(0, 10);
}

// The text split into plain pieces and mentions, longest names first so "@Ana Lee" wins over "@Ana".
export function mentionParts(body: string, mentions: Mention[] | null | undefined): (string | Mention)[] {
  const list = (Array.isArray(mentions) ? mentions : []).filter((m) => m && typeof m.name === "string" && m.name && typeof m.id === "string");
  if (!list.length) return [body];
  const byName = new Map(list.map((m) => [m.name, m]));
  const re = new RegExp(`@(${[...byName.keys()].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const out: (string | Mention)[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(byName.get(m[1])!);
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

// The "@query" being typed right before the caret, if any: a word or two after an "@" that starts
// the text or follows a space.
export function mentionQuery(text: string, caret: number): { start: number; q: string } | null {
  const m = /(^|\s)@([\p{L}'-]{0,30}(?: [\p{L}'-]{0,30})?)$/u.exec(text.slice(0, caret));
  return m ? { start: m.index + m[1].length, q: m[2] } : null;
}
