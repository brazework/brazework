// The 3D viewer's maths and labels (components/projects/model-viewer.tsx): where the camera sits for
// each view, how a model's size reads, and how far each part moves when a model is exploded.
// Pure (no three.js), so it's tested without a browser (tests/model-view.test.ts).

export type V3 = [number, number, number];
export type ViewId = "angled" | "front" | "side" | "top";

// The direction the camera sits in for each view, from the model's centre. Top is a hair off
// vertical: orbit controls lose their sense of "up" when the camera is exactly overhead.
export const VIEWS: readonly { id: ViewId; label: string; dir: V3 }[] = [
  { id: "angled", label: "Angled", dir: [1, 0.62, 1.1] },
  { id: "front", label: "Front", dir: [0, 0.08, 1] },
  { id: "side", label: "Side", dir: [1, 0.08, 0] },
  { id: "top", label: "Top", dir: [0, 1, 0.012] },
];

const FOV = 35; // the lens, in degrees (model-stage.ts uses the same)
/** How much of the picture the model may fill. (The readout and the controls sit outside the picture.) */
const FILL = 0.84;

/** How far back the camera has to be, looking along `dir` at the centre of a box of `size`, for the
 *  whole box to fit a frame of that aspect (width ÷ height). Every corner is checked, so a cube fits
 *  as well as a long thin part does. */
export function fitDistance(size: V3, dir: V3, aspect: number): number {
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1, d: V3 = [dir[0] / l, dir[1] / l, dir[2] / l];
  // The camera's right and up, for a camera at d looking at the origin with the world's up.
  let r: V3 = [d[2], 0, -d[0]];
  const rl = Math.hypot(r[0], r[2]);
  r = rl < 1e-6 ? [1, 0, 0] : [r[0] / rl, 0, r[2] / rl];
  const u: V3 = [d[1] * r[2] - d[2] * r[1], d[2] * r[0] - d[0] * r[2], d[0] * r[1] - d[1] * r[0]];
  const tan = Math.tan((FOV * Math.PI) / 360) * FILL, a = Math.max(aspect, 0.05);
  let need = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const c: V3 = [(sx * size[0]) / 2, (sy * size[1]) / 2, (sz * size[2]) / 2];
    const along = c[0] * d[0] + c[1] * d[1] + c[2] * d[2];
    const side = Math.abs(c[0] * r[0] + c[1] * r[1] + c[2] * r[2]), rise = Math.abs(c[0] * u[0] + c[1] * u[1] + c[2] * u[2]);
    need = Math.max(need, along + rise / tan, along + side / (tan * a));
  }
  return Math.max(need, 1e-6);
}

/** The camera's position for a view of a box of `size` centred on the origin, in a frame of that aspect. */
export function cameraFor(id: ViewId, size: V3, aspect: number): V3 {
  const dir = (VIEWS.find((v) => v.id === id) ?? VIEWS[0]).dir;
  const k = fitDistance(size, dir, aspect) / Math.hypot(dir[0], dir[1], dir[2]);
  return [dir[0] * k, dir[1] * k, dir[2] * k];
}

/** A length as people write one: two decimals under 10, one under 100, whole above; no trailing zeros. */
export function fmtDim(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : n.toFixed(0);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

// The unit a format's numbers are in, and what to multiply them by for the readout. glTF is metres by
// its spec (shown in mm when the model is under a metre); 3MF is millimetres unless it says otherwise;
// STL and OBJ carry no unit, so those stay the file's own numbers.
function unitOf(ext: string, [x, y, z]: V3): { k: number; unit: string } {
  const e = ext.toLowerCase();
  if (e === "glb" || e === "gltf") return Math.max(x, y, z) < 1 ? { k: 1000, unit: "mm" } : { k: 1, unit: "m" };
  return e === "3mf" ? { k: 1, unit: "mm" } : { k: 1, unit: "file units" };
}

/** A model's size as width × depth × height (x, z, y: the viewer stands models upright), with its unit. */
export function sizeLabel(ext: string, size: V3): { text: string; unit: string } {
  const { k, unit } = unitOf(ext, size);
  return { text: [size[0], size[2], size[1]].map((v) => fmtDim(v * k)).join(" × "), unit };
}

/** Each side's length as it's written on the blueprint: [along x, along y, along z], "160 mm" or,
 *  for a format with no unit, just "160". */
export function dimTexts(ext: string, size: V3): [string, string, string] {
  const { k, unit } = unitOf(ext, size), u = unit === "file units" ? "" : ` ${unit}`;
  return [size[0], size[1], size[2]].map((v) => `${fmtDim(v * k)}${u}`) as [string, string, string];
}

export type Look = "solid" | "ghost" | "blueprint";

export function trianglesLabel(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M triangles`;
  if (n >= 1000) return `${Math.round(n / 1000)}k triangles`;
  return `${n} triangle${n === 1 ? "" : "s"}`;
}

/** Above this many triangles the see-through view skips drawing every edge (it would freeze the tab). */
export const EDGE_LIMIT = 300_000;

/** How far each part moves when the model is exploded by `amount` (0 to 1): straight away from the
 *  average of the parts' centres, by amount × radius × 0.9. A part sitting on that average lifts. */
export function explodeOffsets(centers: V3[], amount: number, radius: number): V3[] {
  if (!centers.length) return [];
  const n = centers.length, mid = centers.reduce<V3>((a, c) => [a[0] + c[0] / n, a[1] + c[1] / n, a[2] + c[2] / n], [0, 0, 0]);
  const reach = amount * radius * 0.9;
  return centers.map((c) => {
    if (!reach) return [0, 0, 0];
    const d: V3 = [c[0] - mid[0], c[1] - mid[1], c[2] - mid[2]], l = Math.hypot(d[0], d[1], d[2]);
    return l < 1e-9 ? [0, reach, 0] : [(d[0] / l) * reach, (d[1] / l) * reach, (d[2] / l) * reach];
  });
}
