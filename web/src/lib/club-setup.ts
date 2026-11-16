// Club setup for officers (app/(app)/c/[id]/setup.tsx): how far along a club is, and which invite
// link to hand out. Pure, so it's tested without a database (tests/club-setup.test.ts).

export type InviteRow = { code: string; expires_at: string | null; max_uses: number | null; uses: number; revoked: boolean };

const DAY = 86_400_000;

// A link worth handing out: not revoked, not used up, and good for at least another day (a link that
// dies tonight would fail the members who open it tomorrow). Newest first, so the latest wins.
export function reusableInvite(rows: InviteRow[], now: number): InviteRow | null {
  return rows.find((r) => !r.revoked
    && (r.expires_at === null || Date.parse(r.expires_at) > now + DAY)
    && (r.max_uses === null || r.uses < r.max_uses)) ?? null;
}

export type Step = { id: string; done: boolean };
// How far setup is: done of total, the next step to do, and whether there's anything left to show.
export function setupProgress<T extends Step>(steps: T[]): { done: number; total: number; next: T | null; complete: boolean } {
  const done = steps.filter((s) => s.done).length;
  return { done, total: steps.length, next: steps.find((s) => !s.done) ?? null, complete: steps.length > 0 && done === steps.length };
}

export const inviteUrl = (origin: string, code: string) => `${origin.replace(/\/+$/, "")}/join/${code}`;

// The message an officer pastes into the club's existing group chat, with the link in it.
export const inviteMessage = (clubName: string, url: string) =>
  `We're moving ${clubName} to Brazework: events, chat and the work we build, in one place, and your projects get verified by the club. Join here: ${url}`;

export const STARTER_RULES = "Be kind and assume good intent.\nShare your work, including what didn't go to plan.\nCredit teammates and sources.\nKeep it on topic; take side chats to messages.\nNo spam or self-promotion without context.";
