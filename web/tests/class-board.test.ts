// A class's board (lib/class-board.ts): groups, what's verified and waiting, who has no project. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { classBoard } from "@/lib/class-board";

const members = [
  { uid: "prof", role: "owner" }, { uid: "ta", role: "moderator" },
  { uid: "ann", role: "member" }, { uid: "ben", role: "member" }, { uid: "cy", role: "member" },
];

test("each project lists its group once, without faculty, and counts verified and waiting", () => {
  const b = classBoard(
    [{ id: "p1", title: "Gearbox", owner_id: "ann", updated_at: "2026-11-20" }, { id: "p2", title: "Rover", owner_id: "prof", updated_at: "2026-11-21" }],
    [
      { project_id: "p1", owner_id: "ann", status: "verified" }, { project_id: "p1", owner_id: "ann", status: "pending" },
      { project_id: "p1", owner_id: "ben", status: "disputed" }, { project_id: "p1", owner_id: "ann", status: "refused" },
      { project_id: "p2", owner_id: "cy", status: "verified" },
    ],
    [{ project_id: "p1", uid: "ben" }, { project_id: "p1", uid: "ann" }, { project_id: "p2", uid: "cy" }],
    members,
  );
  assert.deepEqual(b.rows[0].team, ["ann", "ben"]);
  assert.deepEqual([b.rows[0].verified, b.rows[0].waiting], [1, 2]);
  // The professor started p2 for a group: the group is its students.
  assert.deepEqual(b.rows[1].team, ["cy"]);
  assert.deepEqual([b.verified, b.waiting], [2, 2]);
  assert.deepEqual(b.unassigned, []);
});

test("students on no project are listed; faculty never are", () => {
  const b = classBoard([{ id: "p1", title: "Gearbox", owner_id: "ann", updated_at: "2026-11-20" }], [], [], members);
  assert.deepEqual(b.unassigned, ["ben", "cy"]);
  assert.deepEqual(classBoard([], [], [], members).unassigned, ["ann", "ben", "cy"]);
});
