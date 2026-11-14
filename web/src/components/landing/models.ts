// The 3D models on the landing page's project cards: one per kind of build, as wireframes you can
// turn (model-3d.tsx draws them). Each is just line segments and dots in a box of about ±1, built
// from a few shapes below. Same family as the orb and the globe: no library, black and white.
// Pure, and tested (tests/models.test.ts). Example objects, not anyone's real design.

export type V3 = readonly [number, number, number];
export type Model = { edges: [V3, V3][]; dots: V3[] };

const TAU = Math.PI * 2;
const model = (): Model => ({ edges: [], dots: [] });
const line = (m: Model, a: V3, b: V3) => { m.edges.push([a, b]); };
// A run of points joined end to end (closed: the last joins the first).
const path = (m: Model, pts: V3[], closed = false) => { for (let i = 0; i < pts.length - 1; i++) line(m, pts[i], pts[i + 1]); if (closed && pts.length > 2) line(m, pts[pts.length - 1], pts[0]); };
// A box by its centre and size.
function box(m: Model, [cx, cy, cz]: V3, [w, h, d]: V3) {
  const x = [cx - w / 2, cx + w / 2], y = [cy - h / 2, cy + h / 2], z = [cz - d / 2, cz + d / 2];
  for (const a of [0, 1]) for (const b of [0, 1]) {
    line(m, [x[0], y[a], z[b]], [x[1], y[a], z[b]]);
    line(m, [x[a], y[0], z[b]], [x[a], y[1], z[b]]);
    line(m, [x[a], y[b], z[0]], [x[a], y[b], z[1]]);
  }
}
// A flat outline in the x–y plane, pushed through z into a solid: both faces, and a rib every `rib` points.
function extrude(m: Model, outline: [number, number][], z0: number, z1: number, rib = 1) {
  path(m, outline.map(([x, y]) => [x, y, z0] as V3), true);
  path(m, outline.map(([x, y]) => [x, y, z1] as V3), true);
  outline.forEach(([x, y], i) => { if (i % rib === 0) line(m, [x, y, z0], [x, y, z1]); });
}
const ring = (r: number, n: number, cx = 0, cy = 0): [number, number][] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * TAU), cy + r * Math.sin((i / n) * TAU)]);
// A gear's outline: `teeth` teeth between the root and tip radius, turned by `turn` so two can mesh.
function gear(teeth: number, root: number, tip: number, cx: number, cy: number, turn = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let t = 0; t < teeth; t++) for (const [f, r] of [[0, root], [0.2, tip], [0.5, tip], [0.7, root]] as const) {
    const a = ((t + f) / teeth) * TAU + turn;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// Aerospace: a tapered, swept wing. An airfoil section at five stations along the span, joined by spars.
function wing(): Model {
  const m = model();
  const foil = (chord: number, x0: number, z: number): V3[] => {
    const up: V3[] = [], down: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, th = 0.6 * (0.2969 * Math.sqrt(t) - 0.126 * t - 0.3516 * t * t + 0.2843 * t ** 3 - 0.1015 * t ** 4), camber = 0.08 * (1 - (2 * t - 0.8) ** 2);
      up.push([x0 + t * chord, (camber + th) * chord, z]);
      down.push([x0 + t * chord, (camber - th) * chord, z]);
    }
    return [...up, ...down.reverse()];
  };
  const stations = [0, 1, 2, 3, 4].map((k) => foil(1.1 - k * 0.16, -0.6 + k * 0.1, -0.9 + k * 0.45));
  stations.forEach((s) => path(m, s, true));
  for (const i of [0, 3, 6, 10, 14, 18]) path(m, stations.map((s) => s[i]));
  return m;
}

// Mechanical: a 3.2:1 gear pair on two shafts.
function gearbox(): Model {
  const m = model();
  extrude(m, gear(16, 0.58, 0.68, -0.28, 0), -0.12, 0.12, 2);
  extrude(m, gear(5, 0.15, 0.25, 0.62, 0, Math.PI + TAU / 20), -0.12, 0.12, 2);
  extrude(m, ring(0.14, 12, -0.28, 0), -0.75, 0.75, 3);
  extrude(m, ring(0.07, 10, 0.62, 0), -0.55, 0.55, 5);
  ring(0.4, 6, -0.28, 0).forEach(([x, y]) => extrude(m, ring(0.07, 8, x, y), -0.12, 0.12, 4));
  return m;
}

// Electrical: a board with a controller, a row of cell-balancer parts, capacitors and traces.
function board(): Model {
  const m = model(), top = 0.03;
  box(m, [0, 0, 0], [1.9, 0.06, 1.3]);
  box(m, [-0.25, top + 0.05, -0.05], [0.42, 0.1, 0.42]);
  for (let i = 0; i < 6; i++) box(m, [-0.75 + i * 0.3, top + 0.03, 0.45], [0.16, 0.06, 0.1]);
  for (const x of [0.45, 0.72]) {
    const cap = ring(0.09, 10).map(([a, b]) => [x + a, top, -0.35 + b] as V3), lid = cap.map(([a, , c]) => [a, top + 0.28, c] as V3);
    path(m, cap, true); path(m, lid, true); cap.forEach((p, i) => { if (i % 2 === 0) line(m, p, lid[i]); });
  }
  box(m, [0.78, top + 0.07, 0.3], [0.22, 0.14, 0.34]);
  for (let i = 0; i < 6; i++) path(m, [[-0.75 + i * 0.3, top, 0.4], [-0.75 + i * 0.3, top, 0.22], [-0.4 + i * 0.06, top, 0.16]]);
  path(m, [[-0.04, top, -0.05], [0.3, top, -0.05], [0.45, top, -0.26]]);
  for (const x of [-0.85, 0.85]) for (const z of [-0.55, 0.55]) m.dots.push([x, top, z]);
  return m;
}

// Civil: a Warren truss bridge: two sides, a deck, and bracing across the top.
function bridge(): Model {
  const m = model(), n = 6, L = 1.9, h = 0.5, w = 0.34;
  for (const z of [-w, w]) {
    const lower = Array.from({ length: n + 1 }, (_, i) => [-L / 2 + (i * L) / n, -h / 2, z] as V3);
    const upper = Array.from({ length: n }, (_, i) => [-L / 2 + ((i + 0.5) * L) / n, h / 2, z] as V3);
    path(m, lower); path(m, upper);
    upper.forEach((u, i) => { line(m, lower[i], u); line(m, u, lower[i + 1]); });
    m.dots.push(...lower, ...upper);
  }
  for (let i = 0; i <= n; i++) line(m, [-L / 2 + (i * L) / n, -h / 2, -w], [-L / 2 + (i * L) / n, -h / 2, w]);
  for (let i = 0; i < n; i++) line(m, [-L / 2 + ((i + 0.5) * L) / n, h / 2, -w], [-L / 2 + ((i + 0.5) * L) / n, h / 2, w]);
  return m;
}

// Software: three tiers (app, service, data) joined top to bottom, with a route drawn on the top one.
function stack(): Model {
  const m = model();
  [0.5, 0, -0.5].forEach((y, k) => {
    box(m, [0, y, 0], [1.5 - k * 0.12, 0.1, 1.0 - k * 0.08]);
    if (k < 2) for (const [x, z] of [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]]) line(m, [x, y - 0.05, z], [x, y - 0.45, z]);
  });
  const route: V3[] = [[-0.6, 0.56, 0.3], [-0.3, 0.56, 0.05], [-0.05, 0.56, 0.2], [0.25, 0.56, -0.2], [0.6, 0.56, -0.3]];
  path(m, route); m.dots.push(...route);
  for (let i = 0; i < 4; i++) line(m, [-0.55 + i * 0.36, -0.44, -0.4], [-0.55 + i * 0.36, -0.44, 0.4]);
  return m;
}

// Biomedical: a round skin patch with its sensor in the middle, a strap, and a pulse trace across it.
function patch(): Model {
  const m = model();
  const disc = (r: number, y: number, n = 28) => ring(r, n).map(([x, z]) => [x, y, z] as V3);
  const a = disc(0.62, -0.05), b = disc(0.62, 0.05);
  path(m, a, true); path(m, b, true); a.forEach((p, i) => { if (i % 4 === 0) line(m, p, b[i]); });
  path(m, disc(0.22, 0.05, 16), true); path(m, disc(0.12, 0.11, 12), true);
  m.dots.push([0, 0.11, 0], [-0.4, 0.05, 0.3], [0.4, 0.05, 0.3], [0, 0.05, -0.45]);
  for (const z of [-0.2, 0.2]) path(m, Array.from({ length: 13 }, (_, i) => { const t = (i / 12) * Math.PI; return [1.1 * Math.cos(t), -0.05 - 0.42 * Math.sin(t), z] as V3; }));
  const beat = [0, 0, 0.05, -0.04, 0.3, -0.16, 0.02, 0.07, 0, 0];
  path(m, beat.map((y, i) => [-0.5 + (i * 1.0) / (beat.length - 1), 0.06 + y, 0.33] as V3));
  return m;
}

// AI / ML: a small network: layers of nodes, every node wired to the next layer.
function network(): Model {
  const m = model();
  const layers = [9, 6, 6, 3].map((n, k, all) => Array.from({ length: n }, (_, i) => {
    const cols = n === 3 ? 1 : 3, r = Math.floor(i / cols), c = i % cols, rows = Math.ceil(n / cols);
    return [-0.9 + (k * 1.8) / (all.length - 1), (r - (rows - 1) / 2) * 0.42, (c - (cols - 1) / 2) * 0.42] as V3;
  }));
  layers.forEach((layer, k) => {
    m.dots.push(...layer);
    if (k < layers.length - 1) for (const a of layer) for (const b of layers[k + 1]) line(m, a, b);
  });
  return m;
}

// Keyed by the same ids as the flat drawings (schematics.tsx), so a project names its art once.
export const MODELS: Record<string, () => Model> = { aerospace: wing, mechanical: gearbox, electrical: board, civil: bridge, cs: stack, biomedical: patch, ai: network };

// Turn a point by yaw (around the upright axis) then pitch (tipping toward the viewer), and place it
// on the screen with a little perspective. Returns x, y in model units and how near it is (-1 far … 1 near).
export function project([x, y, z]: V3, yaw: number, pitch: number): [number, number, number] {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
  const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
  const k = 3.2 / (3.2 - z2);
  return [x1 * k, -y2 * k, z2];
}
