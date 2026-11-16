// The 3D viewer's maths and labels (lib/model-view.ts): where the camera sits for each view, how a
// model's size and triangle count read, and how far each part moves when a model is exploded.
import assert from "node:assert/strict";
import { test } from "node:test";
import { newestModels } from "@/lib/project-file-types";
import * as THREE from "three";
import { measure } from "@/components/projects/model-stage";
import { SAMPLES, SAMPLE_EXT, buildSample } from "@/components/projects/sample-models";
import { VIEWS, cameraFor, dimTexts, explodeOffsets, fitDistance, fmtDim, sizeLabel, trianglesLabel } from "@/lib/model-view";

const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);

test("each view looks from its own side, and Top looks straight down", () => {
  assert.deepEqual(VIEWS.map((v) => v.id), ["angled", "front", "side", "top"]);
  const cube: [number, number, number] = [2, 2, 2];
  const top = cameraFor("top", cube, 1.5), d = len(top);
  assert.ok(top[1] > 0 && Math.abs(top[0]) < 0.05 * d, "above the model");
  assert.ok(top[2] > 0 && top[2] < 0.05 * d, "a hair off vertical, so the controls keep their bearings");
  const front = cameraFor("front", cube, 1.5);
  assert.ok(front[2] > 0 && front[0] === 0);
  assert.ok(cameraFor("side", cube, 1.5)[0] > 0);
  assert.ok(len(cameraFor("angled", [4, 4, 4], 1.5)) > len(cameraFor("angled", cube, 1.5)), "a bigger model is framed from further away");
  for (const v of VIEWS) assert.ok(len(cameraFor(v.id, [0, 0, 0], 1.5)) > 0, `a zero-size model still gets a camera (${v.id})`);
});

test("the camera stands far enough back that every corner of the model is in the frame", () => {
  // Does a camera at `dist` along `dir`, with a 35° lens, see every corner of the box with room to spare?
  const fits = (size: [number, number, number], dir: [number, number, number], aspect: number, dist: number) => {
    const l = len(dir), d = dir.map((x) => x / l);
    let r = [d[2], 0, -d[0]]; const rl = Math.hypot(r[0], r[2]); r = rl < 1e-6 ? [1, 0, 0] : r.map((x) => x / rl);
    const u = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
    const tan = Math.tan((35 * Math.PI) / 360);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2], dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const depth = dist - dot(c, d);
      if (depth <= 0 || Math.abs(dot(c, u)) > depth * tan || Math.abs(dot(c, r)) > depth * tan * aspect) return false;
    }
    return true;
  };
  const shapes: [number, number, number][] = [[20, 20, 20], [200, 4, 30], [3, 90, 3], [0.16, 0.09, 0.157], [20, 0, 20]];
  for (const size of shapes) for (const v of VIEWS) for (const aspect of [16 / 7, 4 / 3, 0.6]) {
    const dist = fitDistance(size, v.dir, aspect);
    assert.ok(fits(size, v.dir, aspect, dist), `${size} from ${v.id} at ${aspect.toFixed(2)}`);
    assert.ok(!fits(size, v.dir, aspect, dist * 0.6), `${size} from ${v.id}: not standing needlessly far back`);
  }
  assert.ok(fitDistance([20, 20, 20], [0, 0, 1], 0.6) > fitDistance([20, 20, 20], [0, 0, 1], 1.5), "a narrow frame stands further back");
  assert.ok(fitDistance([0, 0, 0], [1, 1, 1], 1.5) > 0);
});

test("a dimension reads like a measurement: no false precision, never NaN", () => {
  assert.equal(fmtDim(0), "0");
  assert.equal(fmtDim(4.2), "4.2");
  assert.equal(fmtDim(4.256), "4.26");
  assert.equal(fmtDim(45.25), "45.3");
  assert.equal(fmtDim(45), "45");
  assert.equal(fmtDim(120.4), "120");
  assert.equal(fmtDim(Number.NaN), "0");
  assert.equal(fmtDim(-3), "0");
});

test("size is width × depth × height, in the unit the format carries", () => {
  // x is width, z is depth, y is height (the viewer stands every model upright).
  assert.deepEqual(sizeLabel("glb", [0.12, 0.045, 0.08]), { text: "120 × 80 × 45", unit: "mm" });
  assert.deepEqual(sizeLabel("gltf", [2, 1, 1.5]), { text: "2 × 1.5 × 1", unit: "m" });
  assert.deepEqual(sizeLabel("3mf", [60, 12.5, 40]), { text: "60 × 40 × 12.5", unit: "mm" });
  assert.deepEqual(sizeLabel("stl", [20, 20, 20]), { text: "20 × 20 × 20", unit: "file units" });
  assert.deepEqual(sizeLabel("OBJ", [20, 0, 20]), { text: "20 × 20 × 0", unit: "file units" }, "a flat outline shows 0, not NaN");
});

test("triangle counts are rounded the way people say them", () => {
  assert.equal(trianglesLabel(312), "312 triangles");
  assert.equal(trianglesLabel(1), "1 triangle");
  assert.equal(trianglesLabel(48_200), "48k triangles");
  assert.equal(trianglesLabel(1_240_000), "1.2M triangles");
  assert.equal(trianglesLabel(0), "0 triangles");
});

test("exploding moves each part away from the middle, and a part in the middle goes up", () => {
  const centers: [number, number, number][] = [[1, 0, 0], [-1, 0, 0]];
  assert.deepEqual(explodeOffsets(centers, 0, 2), [[0, 0, 0], [0, 0, 0]]);
  const [a, b] = explodeOffsets(centers, 1, 2);
  assert.ok(a[0] > 0 && b[0] < 0 && Math.abs(a[0] + b[0]) < 1e-9, "opposite ways, the same distance");
  assert.ok(Math.abs(len(a) - 2 * 0.9) < 1e-9, "amount × radius × 0.9");
  const three = explodeOffsets([[0, 0, 0], [1, 0, 0], [-1, 0, 0]], 1, 1);
  assert.ok(three[0][1] > 0 && three[0][0] === 0, "the centred part lifts");
  assert.deepEqual(explodeOffsets([], 1, 1), []);
  assert.deepEqual(explodeOffsets([[3, 3, 3]], 1, 1), [[0, 0.9, 0]], "one part on its own centre lifts too");
});

test("a Build card opens the project's newest 3D model, and only a model", () => {
  const rows = [
    { project_id: "a", name: "notes.pdf", path: "a/notes.pdf" },
    { project_id: "a", name: "Chassis v3.STL", path: "a/chassis-v3.stl" },
    { project_id: "a", name: "chassis-v2.stl", path: "a/chassis-v2.stl" },
    { project_id: "b", name: "photo.jpg", path: "b/photo.jpg" },
    { project_id: "c", name: "arm.glb", path: null },
    { project_id: "c", name: "arm-old.3mf", path: "c/arm-old.3mf" },
  ];
  const m = newestModels(rows);
  assert.equal(m.get("a")?.path, "a/chassis-v3.stl", "rows come newest first; the first model wins");
  assert.equal(m.has("b"), false, "a project with no model gets no button");
  assert.equal(m.get("c")?.path, "c/arm-old.3mf", "a row with no stored file is skipped");
  assert.equal(newestModels([]).size, 0);
});

test("the blueprint writes each side's length with its unit, or bare numbers when the file has none", () => {
  assert.deepEqual(dimTexts("glb", [0.16, 0.0915, 0.157]), ["160 mm", "91.5 mm", "157 mm"]);
  assert.deepEqual(dimTexts("glb", [2, 1, 1.5]), ["2 m", "1 m", "1.5 m"]);
  assert.deepEqual(dimTexts("3mf", [60, 12.5, 40]), ["60 mm", "12.5 mm", "40 mm"]);
  assert.deepEqual(dimTexts("stl", [20, 20, 20]), ["20", "20", "20"]);
});

test("there is an example for software, computer science and every other kind of build", () => {
  const fields = SAMPLES.map((s) => s.field);
  for (const f of ["Robotics", "Software", "Computer science", "Data & AI", "Mathematics", "Physics", "Chemistry", "Biology", "Environment", "Space", "Medicine", "Business", "Design", "Media", "Social science", "Education"]) assert.ok(fields.includes(f as (typeof fields)[number]), f);
  assert.equal(SAMPLES.length, 20);
});

test("every example on the landing page builds: several parts, a sensible size, something to post", () => {
  assert.equal(new Set(SAMPLES.map((s) => s.id)).size, SAMPLES.length);
  assert.equal(new Set(SAMPLES.map((s) => s.field)).size, SAMPLES.length, "one example per field");
  for (const s of SAMPLES) {
    const m = measure(THREE, buildSample(THREE, s.id));
    assert.ok(m.parts > 1, `${s.id} has parts to pull apart`);
    assert.ok(m.triangles > 100 && m.triangles < 60_000, `${s.id}: ${m.triangles} triangles`);
    assert.ok(m.size.every((v) => v > 0.005 && v < 2.5), `${s.id} is between 5 mm and 2.5 m on every side: ${m.size}`);
    assert.match(sizeLabel(SAMPLE_EXT, m.size).unit, /^(mm|m)$/);
    for (const v of [s.name, s.milestone, s.by]) assert.ok(v.trim().length > 3, s.id);
  }
});
