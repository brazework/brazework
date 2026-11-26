// A class's board (app/(app)/c/[id]/class-board.tsx): each project with its group and how its
// milestones stand, and the students on no project yet. Pure, and tested (tests/class-board.test.ts).

export type BoardProject = { id: string; title: string; owner_id: string; updated_at: string };
export type BoardMilestone = { project_id: string; owner_id: string; status: string };
export type BoardRow = { id: string; title: string; updated_at: string; team: string[]; verified: number; waiting: number };

const FACULTY = ["owner", "admin", "moderator"];

export function classBoard(
  projects: BoardProject[],
  milestones: BoardMilestone[],
  team: { project_id: string; uid: string }[],
  members: { uid: string; role: string }[],
): { rows: BoardRow[]; unassigned: string[]; verified: number; waiting: number } {
  const faculty = new Set(members.filter((m) => FACULTY.includes(m.role)).map((m) => m.uid));
  const rows = projects.map((p) => {
    // The group: the owner first, then teammates, each once. A professor who started the project for
    // a group isn't one of its students.
    const group = [p.owner_id, ...team.filter((t) => t.project_id === p.id).map((t) => t.uid)].filter((u, i, a) => a.indexOf(u) === i && !faculty.has(u));
    const mine = milestones.filter((m) => m.project_id === p.id);
    return {
      id: p.id, title: p.title, updated_at: p.updated_at, team: group,
      verified: mine.filter((m) => m.status === "verified").length,
      // Waiting on the professor: asked, or disputed after a refusal.
      waiting: mine.filter((m) => m.status === "pending" || m.status === "disputed").length,
    };
  });
  const placed = new Set(rows.flatMap((r) => r.team));
  const unassigned = members.filter((m) => !faculty.has(m.uid) && !placed.has(m.uid)).map((m) => m.uid);
  return { rows, unassigned, verified: rows.reduce((n, r) => n + r.verified, 0), waiting: rows.reduce((n, r) => n + r.waiting, 0) };
}
