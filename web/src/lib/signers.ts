// Who can sign your work, said before you ask. The database decides (supabase/verification.sql): a
// milestone is verified by an officer of the club it's sent to (moderator, admin or owner) who isn't
// on the project. Nobody can sign their own work. This reads the club's officers so the ask form
// can name them, or say plainly that nobody can sign yet and what to do. Pure, and tested
// (tests/signers.test.ts).

export type MemberRow = { community_id: string; uid: string; role: string; first_name: string; last_name: string };
const OFFICER = new Set(["moderator", "admin", "owner"]);

/** Club id → the officers who could sign your work there ("First L."), you left out. */
export function signersFor(rows: MemberRow[], me: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const r of rows) {
    if (!OFFICER.has(r.role) || r.uid === me) continue;
    const name = `${r.first_name} ${r.last_name ? `${r.last_name[0]}.` : ""}`.trim() || "An officer";
    out.set(r.community_id, [...(out.get(r.community_id) ?? []), name]);
  }
  return out;
}

/** One line for the ask form: who signs, or why nobody can yet and the two ways forward. */
export function signerNote(club: string, signers: string[]): { ok: boolean; text: string } {
  if (!signers.length) return { ok: false, text: `You're the only officer in ${club}, and you can't sign your own work. Make another member an officer, or ask someone who saw it instead.` };
  const shown = signers.slice(0, 2).join(", "), more = signers.length - 2;
  return { ok: true, text: `${more > 0 ? `${shown} and ${more} more officer${more === 1 ? "" : "s"}` : signers.length === 2 ? signers.join(" or ") : shown} can sign this. They'll see it on Today.` };
}
