// The landing page's 3D models (components/landing/models.ts): every project's art has one, each
// fits its box, and the projection turns and places points the way the drawing expects. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { MODELS, project } from "@/components/landing/models";

test("there is a model for every kind of build on the project deck", () => {
  assert.deepEqual(Object.keys(MODELS).sort(), ["aerospace", "ai", "biomedical", "civil", "cs", "electrical", "mechanical"]);
});

test("each model has lines to draw, fits a box of about ±1.2, and is light enough to draw every frame", () => {
  for (const [id, make] of Object.entries(MODELS)) {
    const m = make();
    assert.ok(m.edges.length >= 30, `${id} has ${m.edges.length} edges`);
    assert.ok(m.edges.length <= 700, `${id} has ${m.edges.length} edges (too many to draw every frame)`);
    for (const p of [...m.edges.flat(), ...m.dots]) for (const v of p) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.2, `${id} has a point at ${p}`);
  }
});

test("projection: straight on leaves a point where it is; a quarter turn brings the side to the front", () => {
  const [x, y, near] = project([0.5, 0.25, 0], 0, 0);
  assert.ok(Math.abs(x - 0.5) < 1e-9 && Math.abs(y + 0.25) < 1e-9 && Math.abs(near) < 1e-9, "screen y points down");
  const [x2, , near2] = project([1, 0, 0], Math.PI / 2, 0);
  assert.ok(Math.abs(x2) < 1e-9 && Math.abs(near2 + 1) < 1e-9, "the point is now straight behind the centre");
  const front = project([0.5, 0, 1], 0, 0)[0], back = project([0.5, 0, -1], 0, 0)[0];
  assert.ok(front > back, "nearer things are drawn larger");
});
