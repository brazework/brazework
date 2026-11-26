import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// The landing page's builds (redesign 2026-11), modelled the way they'd come out of CAD: real
// proportions, machined parts, fasteners, harnesses, and materials that read as carbon, aluminium,
// FR-4 and steel. Units are decimetres-ish: each build fits a sphere of about 2.
//
// Each build returns its root group plus:
// - `anchors`: points the page labels with a callout (they move with the part they're on)
// - `animate(t)`: how it runs (joints, gears)
// - `shells`: the parts the section view cuts away, to show what's inside
// - `stress`: a 0..1 value per mesh for the stress view (higher near the loaded joints and roots)
// A mesh's `userData.keep` keeps its own material in the stress view; `userData.plain` draws no CAD
// edge lines on it (a thin tube, a glowing marker).

export type BuildId = "avionics" | "arm" | "gearbox" | "fsae" | "drone" | "bridge" | "pcb" | "rover" | "nn" | "cluster";
export type Built = {
  root: THREE.Group;
  anchors: Record<string, THREE.Object3D>;
  animate: (t: number) => void;
  shells: THREE.Mesh[];
  stress: Map<THREE.Mesh, (p: THREE.Vector3) => number>;
  // Extra room around it, for a build that moves outside where it starts (the arm).
  room?: number;
  // How the stage turns it: a full turntable, or a gentle sway for a part best seen face-on.
  turn?: "spin" | "sway";
  // The section view's cut, as a world-space plane normal through the build's axis.
  cut?: [number, number, number];
  // The camera's angle down from straight above, for a build best seen from higher up (a board).
  phi?: number;
  // Where the camera starts around it, for a build that reads from one side (a bridge).
  theta?: number;
  // For a build whose views mean something other than a cut (software: a cost map, a layer view).
  onMode?: (mode: "render" | "section" | "stress") => void;
};

const M = {
  carbon: () => new THREE.MeshPhysicalMaterial({ color: 0x17191c, metalness: 0.35, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.18 }),
  glass: () => new THREE.MeshStandardMaterial({ color: 0xd8d0bb, metalness: 0, roughness: 0.62 }),
  alu: () => new THREE.MeshStandardMaterial({ color: 0xc4c8ce, metalness: 1, roughness: 0.3 }),
  anod: () => new THREE.MeshStandardMaterial({ color: 0x3a4250, metalness: 0.85, roughness: 0.42 }),
  steel: () => new THREE.MeshStandardMaterial({ color: 0x9ea4ab, metalness: 1, roughness: 0.38 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: 0.4, roughness: 0.55 }),
  paint: () => new THREE.MeshStandardMaterial({ color: 0xe9e9e6, metalness: 0.05, roughness: 0.48 }),
  copper: () => new THREE.MeshStandardMaterial({ color: 0xb8683e, metalness: 1, roughness: 0.32 }),
  fr4: () => new THREE.MeshStandardMaterial({ color: 0x1c5a3a, metalness: 0.05, roughness: 0.5 }),
  chip: () => new THREE.MeshStandardMaterial({ color: 0x121315, metalness: 0.2, roughness: 0.55 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xd8ac52, metalness: 1, roughness: 0.25 }),
  lipo: () => new THREE.MeshStandardMaterial({ color: 0x2c5aa0, metalness: 0.1, roughness: 0.45 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0, roughness: 0.9 }),
  terminal: () => new THREE.MeshStandardMaterial({ color: 0x2f8a4a, metalness: 0, roughness: 0.55 }),
  wireR: () => new THREE.MeshStandardMaterial({ color: 0xb3261e, metalness: 0, roughness: 0.5 }),
  wireK: () => new THREE.MeshStandardMaterial({ color: 0x1d1d1f, metalness: 0, roughness: 0.5 }),
  powder: () => new THREE.MeshPhysicalMaterial({ color: 0xb8562b, metalness: 0.3, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
  concrete: () => new THREE.MeshStandardMaterial({ color: 0xa9a59c, metalness: 0, roughness: 0.95 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 1, roughness: 0.35 }),
  mask: () => new THREE.MeshPhysicalMaterial({ color: 0x14306a, metalness: 0, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.35 }),
  trace: () => new THREE.MeshPhysicalMaterial({ color: 0x2b4f9a, metalness: 0.1, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
  silk: () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0, roughness: 0.7 }),
  prop: () => new THREE.MeshPhysicalMaterial({ color: 0xe0702e, metalness: 0, roughness: 0.35, clearcoat: 0.8 }),
  tan: () => new THREE.MeshStandardMaterial({ color: 0xb59a72, metalness: 0, roughness: 0.6 }),
  honeycomb: () => new THREE.MeshStandardMaterial({ color: 0xd6d8da, metalness: 0.7, roughness: 0.5 }),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number] = [0, 0, 0], rot: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.rotation.set(...rot);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const anchor = (parent: THREE.Object3D, at: [number, number, number]) => { const o = new THREE.Object3D(); o.position.set(...at); parent.add(o); return o; };
// A revolved part from a half-profile [r, y], like a lathe would cut it.
const lathe = (pts: [number, number][], seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const hexNut = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 6);
const tube = (pts: [number, number, number][], r: number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 48, r, 10, false);

// ---------- Rocket avionics bay: dual-deploy flight computer in a 98 mm airframe ----------
function avionics(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const carbon = M.carbon(), alu = M.alu(), steel = M.steel(), glass = M.glass();

  // Shown the way it's assembled on the bench: the airframe halves slid off the coupler, and a window
  // cut in the coupler tube so the sled and the flight computer show. The section view cuts the rest.
  const win = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 128, 1, true, Math.PI * 0.32, Math.PI * 1.36);
  const upper = mesh(new THREE.CylinderGeometry(1, 1, 1.15, 128, 1, true), carbon, [0, 2.0, 0]);
  const lower = mesh(new THREE.CylinderGeometry(1, 1, 1.15, 128, 1, true), carbon, [0, -2.0, 0]);
  const band = mesh(win(1.004, 0.42), M.anod(), [0, 0, 0]);
  const coupler = mesh(win(0.965, 2.3), glass, [0, 0, 0]);
  for (const s of [upper, lower, band, coupler]) { shells.push(s); root.add(s); }
  stress.set(upper, (p) => 0.25 + 0.35 * Math.exp(-((p.y - 1.45) ** 2) * 6));
  stress.set(lower, (p) => 0.25 + 0.35 * Math.exp(-((p.y + 1.45) ** 2) * 6));
  stress.set(band, () => 0.55);
  stress.set(coupler, (p) => 0.35 + 0.5 * Math.exp(-((Math.abs(p.y) - 1.1) ** 2) * 18));
  // The shear pins and screws that hold it together, around the band.
  for (let i = 0; i < 4; i++) { const a = Math.PI * 0.5 + (i / 4) * Math.PI * 2; root.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 12), steel, [Math.sin(a) * 1.01, 0.9, Math.cos(a) * 1.01], [0, 0, Math.PI / 2])); }

  // Bulkheads: machined discs with a step and chamfer, an eyebolt on the outside of each.
  const bulk = lathe([[0, -0.07], [0.95, -0.07], [0.962, -0.055], [0.962, 0.02], [0.93, 0.04], [0.93, 0.07], [0, 0.07]]);
  for (const y of [1.1, -1.1]) {
    const b = mesh(bulk, alu, [0, y, 0], [y > 0 ? 0 : Math.PI, 0, 0]);
    root.add(b);
    stress.set(b, (p) => 0.45 + 0.5 * Math.exp(-(p.x * p.x + p.z * p.z) * 7));
    const eye = mesh(new THREE.TorusGeometry(0.13, 0.03, 16, 48), steel, [0, y + Math.sign(y) * 0.2, 0], [0, Math.PI / 2, 0]);
    root.add(eye);
    root.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 16), steel, [0, y + Math.sign(y) * 0.1, 0]));
    root.add(mesh(hexNut(0.075, 0.05), steel, [0, y + Math.sign(y) * 0.095, 0]));
  }

  // Two threaded rods carry the load between bulkheads; nuts on each face.
  for (const x of [-0.55, 0.55]) {
    const rod = mesh(new THREE.CylinderGeometry(0.032, 0.032, 2.42, 20), steel, [x, 0, -0.18]);
    root.add(rod);
    stress.set(rod, (p) => 0.6 + 0.35 * Math.abs(p.y) / 1.2);
    for (const y of [1.2, 1.0, -1.0, -1.2]) root.add(mesh(hexNut(0.07, 0.05), steel, [x, y, -0.18]));
  }

  // The sled between the rods, and the flight computer on it.
  const sled = mesh(new RoundedBoxGeometry(1.24, 1.86, 0.05, 2, 0.02), M.dark(), [0, 0, -0.12]);
  root.add(sled);
  stress.set(sled, (p) => 0.2 + 0.25 * Math.abs(p.y));
  const board = new THREE.Group();
  board.position.set(0, 0.32, -0.07);
  root.add(board);
  board.add(mesh(new RoundedBoxGeometry(0.98, 0.92, 0.032, 2, 0.01), M.fr4()));
  const chip = M.chip(), gold = M.gold();
  board.add(mesh(new THREE.BoxGeometry(0.24, 0.24, 0.035), chip, [-0.12, 0.12, 0.03])); // MCU
  const imu = mesh(new THREE.BoxGeometry(0.1, 0.1, 0.03), chip, [0.24, 0.22, 0.03]);
  board.add(imu);
  board.add(mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), chip, [0.26, 0.02, 0.03])); // barometer
  board.add(mesh(new THREE.BoxGeometry(0.16, 0.1, 0.03), chip, [-0.18, -0.16, 0.03])); // flash
  board.add(mesh(new THREE.BoxGeometry(0.22, 0.07, 0.05), gold, [0.14, -0.2, 0.035])); // GPS shield can
  // Pin headers along the top edge.
  const pin = new THREE.BoxGeometry(0.018, 0.018, 0.09);
  const pins = new THREE.InstancedMesh(pin, gold, 16);
  const tm = new THREE.Matrix4();
  for (let i = 0; i < 16; i++) { tm.makeTranslation(-0.38 + i * 0.05, 0.4, 0.05); pins.setMatrixAt(i, tm); }
  board.add(pins);
  // Pyro screw terminals along the bottom edge.
  const term = M.terminal();
  for (let i = 0; i < 4; i++) board.add(mesh(new THREE.BoxGeometry(0.14, 0.1, 0.1), term, [-0.33 + i * 0.22, -0.39, 0.06]));
  const pyro = anchor(board, [0, -0.39, 0.12]);
  // Passives: a scatter of tiny parts, as a real board has.
  const smd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.016, 0.012), M.chip(), 40);
  for (let i = 0; i < 40; i++) { tm.makeTranslation(-0.42 + (i % 10) * 0.09, -0.02 - Math.floor(i / 10) * 0.05 + (i % 3) * 0.008, 0.022); smd.setMatrixAt(i, tm); }
  board.add(smd);

  // LiPo under a strap, a key switch, and the harness up to the bulkhead.
  const lipo = mesh(new RoundedBoxGeometry(0.62, 0.42, 0.2, 3, 0.03), M.lipo(), [0, -0.55, -0.0]);
  root.add(lipo);
  root.add(mesh(new THREE.BoxGeometry(0.08, 0.5, 0.215), M.rubber(), [0, -0.55, -0.0]));
  root.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), steel, [0.42, -0.78, -0.06], [Math.PI / 2, 0, 0]));
  root.add(mesh(tube([[-0.25, -0.07, -0.02], [-0.45, -0.25, 0.1], [-0.6, -0.7, 0.2], [-0.5, -1.0, 0.05]], 0.018), M.wireR()));
  root.add(mesh(tube([[-0.2, -0.07, -0.02], [-0.38, -0.3, 0.12], [-0.52, -0.72, 0.24], [-0.42, -1.0, 0.08]], 0.018), M.wireK()));
  root.add(mesh(tube([[0.3, -0.07, -0.02], [0.5, 0.3, 0.2], [0.58, 0.8, 0.12], [0.45, 1.0, 0.0]], 0.018), M.wireR()));

  const anchors = { imu: anchor(board, [0.24, 0.22, 0.05]), pyro, frame: anchor(root, [-0.72, 2.3, 0.7]) };
  root.rotation.set(0.1, 0.35, 0);
  return { root, anchors, shells, stress, animate: () => {} };
}

// ---------- Six-axis arm: a benchtop cobot with hollow-shaft joints ----------
function arm(): Built {
  const root = new THREE.Group();
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const shells: THREE.Mesh[] = [];
  const paint = M.paint(), dark = M.dark(), copper = M.copper(), steel = M.steel();
  const joint = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 64);
  const ring = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 64, 1, true);

  root.add(mesh(lathe([[0, 0], [0.82, 0], [0.84, 0.03], [0.84, 0.1], [0.8, 0.13], [0, 0.13]]), dark, [0, -1.5, 0]));
  // Bolts around the base flange.
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; root.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 6), steel, [Math.cos(a) * 0.7, -1.355, Math.sin(a) * 0.7])); }
  const col = mesh(lathe([[0, 0], [0.5, 0], [0.5, 0.05], [0.46, 0.08], [0.44, 0.55], [0, 0.55]]), paint, [0, -1.37, 0]);
  root.add(col);
  stress.set(col, (p) => 0.55 + 0.35 * (1 - (p.y + 1.37) / 0.6));

  const j1 = new THREE.Group(); j1.position.set(0, -0.82, 0); root.add(j1);
  j1.add(mesh(ring(0.452, 0.06), copper));
  const tower = mesh(new RoundedBoxGeometry(0.62, 0.62, 0.56, 4, 0.12), paint, [0, 0.28, 0]);
  j1.add(tower);
  stress.set(tower, (p) => 0.5 + 0.4 * Math.exp(-((p.y - 0.55) ** 2) * 10));

  const j2 = new THREE.Group(); j2.position.set(0, 0.48, 0.0); j1.add(j2);
  j2.add(mesh(joint(0.34, 0.76), dark, [0, 0, 0], [Math.PI / 2, 0, 0]));
  j2.add(mesh(ring(0.345, 0.05), copper, [0, 0, 0.36], [Math.PI / 2, 0, 0]));
  const upper = mesh(new RoundedBoxGeometry(0.42, 1.6, 0.38, 4, 0.14), paint, [0, 0.78, 0]);
  j2.add(upper);
  stress.set(upper, (p) => 0.35 + 0.62 * Math.max(0, 1 - (p.y + 0.0) / 1.6));
  j2.add(mesh(tube([[0.18, 0.1, -0.2], [0.24, 0.8, -0.22], [0.18, 1.45, -0.2]], 0.035), M.rubber()));

  const j3 = new THREE.Group(); j3.position.set(0, 1.56, 0); j2.add(j3);
  j3.add(mesh(joint(0.27, 0.6), dark, [0, 0, 0], [Math.PI / 2, 0, 0]));
  j3.add(mesh(ring(0.275, 0.04), copper, [0, 0, 0.29], [Math.PI / 2, 0, 0]));
  const fore = mesh(new RoundedBoxGeometry(0.32, 1.25, 0.3, 4, 0.11), paint, [0, 0.6, 0]);
  j3.add(fore);
  stress.set(fore, (p) => 0.25 + 0.45 * Math.max(0, 1 - p.y / 1.25));

  const j4 = new THREE.Group(); j4.position.set(0, 1.22, 0); j3.add(j4);
  j4.add(mesh(joint(0.17, 0.1), copper));
  const j5 = new THREE.Group(); j5.position.set(0, 0.17, 0); j4.add(j5);
  j5.add(mesh(joint(0.17, 0.4), dark, [0, 0, 0], [Math.PI / 2, 0, 0]));
  const wrist = mesh(new RoundedBoxGeometry(0.26, 0.32, 0.26, 3, 0.08), paint, [0, 0.2, 0]);
  j5.add(wrist);
  stress.set(wrist, () => 0.22);
  const j6 = new THREE.Group(); j6.position.set(0, 0.38, 0); j5.add(j6);
  j6.add(mesh(lathe([[0, 0], [0.15, 0], [0.15, 0.04], [0.12, 0.06], [0, 0.06]]), steel));
  // A parallel gripper with rubber pads.
  j6.add(mesh(new RoundedBoxGeometry(0.34, 0.1, 0.16, 2, 0.03), dark, [0, 0.1, 0]));
  const fingers = [-1, 1].map((s) => { const f = new THREE.Group(); f.position.set(s * 0.09, 0.15, 0); f.add(mesh(new THREE.BoxGeometry(0.05, 0.22, 0.1), steel, [0, 0.11, 0])); f.add(mesh(new THREE.BoxGeometry(0.02, 0.12, 0.09), M.rubber(), [-s * 0.035, 0.15, 0])); j6.add(f); return { f, s }; });

  const anchors = { j2: anchor(j2, [0, 0, 0.42]), elbow: anchor(j3, [0, 0, 0.32]), grip: anchor(j6, [0, 0.42, 0]) };
  root.position.y = -0.1;
  root.rotation.y = -0.4;
  return {
    root, anchors, shells, stress, room: 1.18,
    animate: (t) => {
      j1.rotation.y = 0.55 * Math.sin(t * 0.33);
      j2.rotation.z = -0.38 + 0.22 * Math.sin(t * 0.47);
      j3.rotation.z = 1.25 + 0.28 * Math.sin(t * 0.47 + 1.1);
      j4.rotation.y = 0.6 * Math.sin(t * 0.4);
      j5.rotation.z = 0.5 + 0.35 * Math.sin(t * 0.6 + 0.5);
      j6.rotation.y = t * 0.5;
      const open = 0.03 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.2));
      for (const { f, s } of fingers) f.position.x = s * (0.06 + open);
    },
  };
}

// ---------- Planetary gearbox: 12/18/48 teeth, 5:1, ring fixed in the housing ----------
// Tooth flanks are drawn as curves, close enough to an involute at this size.
function gearShape(z: number, m: number, bore: number) {
  const r = (z * m) / 2, ra = r + m, rf = r - 1.25 * m, p = (Math.PI * 2) / z;
  const s = new THREE.Shape();
  for (let i = 0; i < z; i++) {
    const c = i * p;
    const pts: [number, number][] = [[rf, c - 0.5 * p], [rf, c - 0.3 * p], [r * 0.985, c - 0.21 * p], [ra, c - 0.11 * p], [ra, c + 0.11 * p], [r * 0.985, c + 0.21 * p], [rf, c + 0.3 * p]];
    pts.forEach(([rad, a], k) => { const x = Math.cos(a) * rad, y = Math.sin(a) * rad; if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y); });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, bore, 0, Math.PI * 2, true); s.holes.push(hole);
  return s;
}
function ringShape(z: number, m: number, outer: number) {
  const r = (z * m) / 2, ri = r - m, rr = r + 1.25 * m, p = (Math.PI * 2) / z;
  const s = new THREE.Shape(); s.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  for (let i = 0; i < z; i++) {
    const c = i * p; // a tooth points inward at c
    const pts: [number, number][] = [[rr, c - 0.5 * p], [rr, c - 0.3 * p], [r * 1.012, c - 0.21 * p], [ri, c - 0.11 * p], [ri, c + 0.11 * p], [r * 1.012, c + 0.21 * p], [rr, c + 0.3 * p]];
    pts.forEach(([rad, a], k) => { const x = Math.cos(a) * rad, y = Math.sin(a) * rad; if (i === 0 && k === 0) h.moveTo(x, y); else h.lineTo(x, y); });
  }
  h.closePath();
  s.holes.push(h);
  return s;
}
const extrude = (shape: THREE.Shape, depth: number) => {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  return g;
};

function gearbox(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const steel = M.steel(), alu = M.alu(), anod = M.anod(), copper = M.copper();
  const m = 0.05, Zs = 12, Zp = 18, Zr = 48;
  const rs = (Zs * m) / 2, rp = (Zp * m) / 2, orbit = rs + rp;
  const toothStress = (rRoot: number) => (p: THREE.Vector3) => { const d = Math.hypot(p.x, p.y); return 0.15 + 0.85 * Math.exp(-((d - rRoot) ** 2) * 160); };

  // Housing: a flanged cup behind the ring, with its bolt circle.
  const housing = mesh(lathe([[1.3, -0.42], [1.52, -0.42], [1.52, -0.3], [1.42, -0.28], [1.42, 0.24], [1.36, 0.26], [1.3, 0.26]], 128), anod, [0, 0, 0], [Math.PI / 2, 0, 0]);
  root.add(housing); shells.push(housing);
  stress.set(housing, (p) => 0.2 + 0.3 * Math.exp(-((p.z + 0.36) ** 2) * 40));
  const back = mesh(lathe([[0.2, -0.46], [1.31, -0.46], [1.31, -0.38], [0.2, -0.38]], 128), anod, [0, 0, 0], [Math.PI / 2, 0, 0]);
  root.add(back); shells.push(back);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const b = mesh(hexNut(0.045, 0.05), steel.clone(), [Math.cos(a) * 1.46, Math.sin(a) * 1.46, -0.3], [Math.PI / 2, 0, 0]); root.add(b); shells.push(b); }

  const ringGear = mesh(extrude(ringShape(Zr, m, 1.3), 0.4), steel, [0, 0, 0]);
  root.add(ringGear); shells.push(ringGear);
  stress.set(ringGear, toothStress((Zr * m) / 2 + 1.25 * m));

  const sun = mesh(extrude(gearShape(Zs, m, 0.08), 0.42), steel);
  root.add(sun);
  stress.set(sun, toothStress(rs - 1.25 * m));
  const input = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.7, 32), steel, [0, 0, 0.45], [Math.PI / 2, 0, 0]);
  root.add(input);

  const carrier = new THREE.Group(); root.add(carrier);
  const plate = mesh(lathe([[0.18, -0.03], [orbit + 0.24, -0.03], [orbit + 0.26, 0], [orbit + 0.24, 0.03], [0.18, 0.03]], 96), alu, [0, 0, -0.27], [Math.PI / 2, 0, 0]);
  carrier.add(plate);
  stress.set(plate, (p) => 0.3 + 0.55 * Math.exp(-((Math.hypot(p.x, p.y) - orbit) ** 2) * 30));
  const output = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 40), steel, [0, 0, -0.72], [Math.PI / 2, 0, 0]);
  carrier.add(output);
  stress.set(output, () => 0.7);
  carrier.add(mesh(new THREE.BoxGeometry(0.06, 0.05, 0.5), steel, [0, 0.16, -0.95])); // key
  const planets: { g: THREE.Mesh; base: number; phase: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const base = (k / 3) * Math.PI * 2;
    const g = mesh(extrude(gearShape(Zp, m, 0.07), 0.38), steel);
    carrier.add(g);
    stress.set(g, toothStress(rp - 1.25 * m));
    carrier.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.56, 24), copper, [Math.cos(base) * orbit, Math.sin(base) * orbit, -0.05], [Math.PI / 2, 0, 0]));
    // Mesh condition: a sun tooth points at each planet, so the planet faces it with a gap.
    planets.push({ g, base, phase: base + Math.PI + Math.PI / Zp });
  }

  const anchors = { ratio: anchor(carrier, [orbit + 0.24, 0, -0.27]), tooth: anchor(ringGear, [0, -1.22, 0.2]), shaft: anchor(carrier, [0, 0, -1.1]) };
  root.rotation.set(0.2, Math.PI - 0.5, 0);
  const wc = 0.3, ws = 5 * wc, wp = -(Zr / Zp - 1) * wc; // ring fixed: sun = 5 × carrier
  return {
    root, anchors, shells, stress, turn: "sway", cut: [-1, 0, 0], theta: 2.1,
    animate: (t) => {
      sun.rotation.z = ws * t;
      input.rotation.y = ws * t;
      carrier.rotation.z = wc * t;
      for (const p of planets) {
        // In the carrier's frame the planet sits still at `base` and spins at (ωp − ωc).
        p.g.position.set(Math.cos(p.base) * orbit, Math.sin(p.base) * orbit, -0.02);
        p.g.rotation.z = p.phase + (wp - wc) * t;
      }
    },
  };
}

// ---------- Shared pieces for the frames, trusses and boards below ----------
type V3 = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);
const vec = (p: V3) => new THREE.Vector3(...p);
const mirror = (p: V3): V3 => [p[0], p[1], -p[2]];
// A round tube from a to b, baked into place so its vertices are in the build's own frame (the
// stress view reads positions, and the frame is merged into one mesh).
function rodGeo(a: V3, b: V3, r: number, seg = 16) {
  const A = vec(a), B = vec(b), d = B.clone().sub(A);
  const g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
// A rectangular member from a to b: `up` is its depth in the plane it stands in, `across` its width
// out of that plane (a truss chord, a floor beam, a copper trace lying flat).
function barGeo(a: V3, b: V3, up: number, across: number) {
  const A = vec(a), B = vec(b), Y = B.clone().sub(A);
  const len = Y.length();
  Y.normalize();
  const Z = new THREE.Vector3().crossVectors(Y, UP);
  if (Z.lengthSq() < 1e-6) Z.set(0, 0, 1);
  Z.normalize();
  const X = new THREE.Vector3().crossVectors(Y, Z);
  const g = new THREE.BoxGeometry(up, len, across);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(X, Y, Z).setPosition((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2));
  return g;
}
const ball = (p: V3, r: number) => new THREE.SphereGeometry(r, 18, 12).translate(...p);
const merged = (geos: THREE.BufferGeometry[]) => { const g = mergeGeometries(geos, false); geos.forEach((x) => x.dispose()); return g; };
function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const hole = (x: number, y: number, r: number) => { const p = new THREE.Path(); p.absarc(x, y, r, 0, Math.PI * 2, true); return p; };
// A flat plate cut from a shape, lying on the XZ plane with its bottom at y.
function plateGeo(shape: THREE.Shape, t: number, y: number, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 20 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const near = (p: THREE.Vector3, q: V3, k: number) => Math.exp(-((p.x - q[0]) ** 2 + (p.y - q[1]) ** 2 + (p.z - q[2]) ** 2) * k);

// ---------- Formula SAE: a steel tube space frame with double-wishbone suspension ----------
// x is forward, y up, z across. Tubes are to scale (about 1 unit to 0.75 m), so the frame reads thin,
// as a real one does. The stress view is the torsion test: the front pickups twisted, the rear held.
function fsae(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const steel = M.steel(), dark = M.dark(), rubber = M.rubber(), anod = M.anod();

  const N = {
    fbB: [1.75, 0.22, 0.2], fbT: [1.75, 0.62, 0.2],
    fhB: [0.95, 0.18, 0.3], fhM: [0.95, 0.44, 0.32], fhU: [0.95, 0.72, 0.3], fhS: [0.95, 0.9, 0.24],
    mhB: [-0.25, 0.18, 0.36], mhM: [-0.25, 0.44, 0.37], mhU: [-0.25, 0.76, 0.36], mhH: [-0.26, 0.98, 0.34], mhS: [-0.27, 1.22, 0.3],
    rM: [-0.85, 0.2, 0.3], rU: [-0.85, 0.7, 0.3], rB: [-1.4, 0.22, 0.26], rT: [-1.4, 0.64, 0.26],
  } satisfies Record<string, V3>;
  type K = keyof typeof N;
  const sides: [K, K, number][] = [
    ["fbB", "fbT", 0.017], ["fbB", "fhB", 0.019], ["fbT", "fhU", 0.019], ["fbB", "fhU", 0.016], ["fhS", "fbT", 0.017],
    ["fhB", "mhB", 0.019], ["fhM", "mhM", 0.019], ["fhU", "mhU", 0.019], ["fhB", "mhM", 0.017],
    ["mhB", "rM", 0.018], ["rM", "rB", 0.018], ["mhU", "rU", 0.018], ["rU", "rT", 0.018], ["rM", "rU", 0.016],
    ["rB", "rT", 0.016], ["mhS", "rU", 0.018], ["mhM", "rM", 0.016], ["rM", "rT", 0.015],
  ];
  const across: K[] = ["fbB", "fbT", "fhB", "mhB", "mhH", "rB", "rT", "rM", "rU"];
  const geos: THREE.BufferGeometry[] = [];
  for (const [a, b, r] of sides) { geos.push(rodGeo(N[a], N[b], r)); geos.push(rodGeo(mirror(N[a]), mirror(N[b]), r)); }
  for (const k of across) geos.push(rodGeo(N[k], mirror(N[k]), 0.016));
  geos.push(rodGeo(N.fhB, mirror(N.mhB), 0.015), rodGeo(N.rB, mirror(N.rT), 0.015));
  // The two hoops, bent from one tube each.
  const hoop = (pts: V3[]) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...pts, ...pts.slice(0, -1).reverse().map(mirror)].map(vec)), 140, 0.024, 16, false);
  geos.push(hoop([N.fhB, N.fhM, N.fhU, N.fhS, [0.95, 0.96, 0]]));
  geos.push(hoop([N.mhB, N.mhM, N.mhU, N.mhH, N.mhS, [-0.29, 1.4, 0.2], [-0.3, 1.46, 0]]));
  for (const k of Object.keys(N) as K[]) { geos.push(ball(N[k], 0.026)); geos.push(ball(mirror(N[k]), 0.026)); }
  const frame = mesh(merged(geos), M.powder());
  root.add(frame);
  const hot: [V3, number][] = [[[1.25, 0.24, 0.24], 0.7], [[1.25, 0.56, 0.24], 0.55], [[-0.25, 0.18, 0.36], 0.55], [[-0.27, 1.22, 0.3], 0.4], [[0.95, 0.18, 0.3], 0.45], [[-1.15, 0.3, 0.27], 0.45]];
  stress.set(frame, (p) => clamp01(0.1 + 0.18 * Math.abs(p.z) / 0.37 + hot.reduce((s, [q, w]) => s + w * (near(p, q, 9) + near(p, mirror(q), 9)), 0)));

  // Nose and impact attenuator: the section view cuts the nose open to show the foam block.
  const nose = mesh(lathe([[0.37, 0], [0.36, 0.12], [0.32, 0.3], [0.24, 0.48], [0.12, 0.6], [0, 0.64]], 64), M.paint(), [1.78, 0.42, 0], [0, 0, -Math.PI / 2]);
  nose.scale.set(1, 1, 0.72);
  root.add(nose); shells.push(nose);
  stress.set(nose, (p) => 0.15 + 0.2 * Math.exp(-((p.x - 1.8) ** 2) * 20));
  root.add(mesh(new THREE.BoxGeometry(0.34, 0.3, 0.3), M.honeycomb(), [1.95, 0.42, 0]));
  root.add(mesh(new THREE.BoxGeometry(0.012, 0.42, 0.44), M.alu(), [1.76, 0.42, 0]));
  // Driver's cell: a seat, the steering column and wheel, and the floor.
  const seat = mesh(new RoundedBoxGeometry(0.5, 0.06, 0.5, 2, 0.025), dark, [0.12, 0.24, 0], [0, 0, 0.12]);
  root.add(seat);
  root.add(mesh(new RoundedBoxGeometry(0.06, 0.55, 0.48, 2, 0.025), dark, [-0.16, 0.52, 0], [0, 0, 0.32]));
  root.add(mesh(new THREE.BoxGeometry(2.0, 0.012, 0.6), M.carbon(), [0.6, 0.16, 0]));
  root.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 12), steel, [1.1, 0.56, 0], [0, 0, Math.PI / 2 - 0.52]));
  const wheelGroup = new THREE.Group(); wheelGroup.position.set(0.82, 0.73, 0); wheelGroup.rotation.z = 0.5; root.add(wheelGroup);
  const steer = new THREE.Group(); wheelGroup.add(steer);
  steer.add(mesh(new THREE.TorusGeometry(0.13, 0.016, 12, 48), rubber, [0, 0, 0], [0, Math.PI / 2, 0]));
  steer.add(mesh(new RoundedBoxGeometry(0.03, 0.12, 0.2, 2, 0.01), dark));
  // Engine bay: block, head, and the exhaust running back to the muffler.
  root.add(mesh(new RoundedBoxGeometry(0.5, 0.34, 0.36, 3, 0.04), M.dark(), [-0.7, 0.42, 0]));
  root.add(mesh(new RoundedBoxGeometry(0.32, 0.16, 0.3, 3, 0.03), M.alu(), [-0.62, 0.66, 0], [0, 0, 0.25]));
  root.add(mesh(tube([[-0.5, 0.6, 0.15], [-0.6, 0.62, 0.3], [-0.95, 0.55, 0.36], [-1.25, 0.6, 0.33]], 0.022), steel));
  root.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.36, 32), M.alu(), [-1.42, 0.6, 0.33], [0, 0, Math.PI / 2]));
  root.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 32), anod, [-1.15, 0.4, 0], [Math.PI / 2, 0, 0])); // differential
  root.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 40), steel, [-1.15, 0.4, 0.14], [Math.PI / 2, 0, 0])); // sprocket

  // Corners: upright, wheel and tyre, double wishbones and a pushrod to a rocker on the frame.
  const tyre = lathe([[0.27, -0.17], [0.37, -0.17], [0.405, -0.12], [0.415, 0], [0.405, 0.12], [0.37, 0.17], [0.27, 0.17]], 64);
  const rim = lathe([[0.26, -0.16], [0.272, -0.16], [0.272, 0.16], [0.26, 0.16], [0.21, 0.07], [0.07, 0.05], [0.07, 0.02], [0, 0.02]], 64);
  const susp: THREE.BufferGeometry[] = [];
  const fronts: THREE.Group[] = [];
  for (const [xa, zf, front] of [[1.25, 0.24, true], [-1.15, 0.28, false]] as const) {
    for (const s of [1, -1]) {
      const corner = new THREE.Group(); corner.position.set(xa, 0.41, s * 0.86); root.add(corner);
      if (front) fronts.push(corner);
      corner.add(mesh(tyre, rubber, [0, 0, s * 0.1], [Math.PI / 2, 0, 0]));
      corner.add(mesh(rim, anod, [0, 0, s * 0.1], [s > 0 ? Math.PI / 2 : -Math.PI / 2, 0, 0]));
      corner.add(mesh(new RoundedBoxGeometry(0.1, 0.34, 0.08, 2, 0.02), M.alu(), [0, 0, -s * 0.06]));
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; corner.add(mesh(hexNut(0.018, 0.03), steel, [Math.cos(a) * 0.045, Math.sin(a) * 0.045, s * 0.13], [Math.PI / 2, 0, 0])); }
      const z = s * 0.79, f = s * zf;
      susp.push(rodGeo([xa + 0.24, 0.24, f], [xa, 0.26, z], 0.011), rodGeo([xa - 0.22, 0.24, f], [xa, 0.26, z], 0.011));
      susp.push(rodGeo([xa + 0.2, 0.56, f], [xa, 0.56, z * 0.99], 0.011), rodGeo([xa - 0.2, 0.56, f], [xa, 0.56, z * 0.99], 0.011));
      susp.push(rodGeo([xa, 0.29, s * 0.74], [xa - 0.04, 0.7, s * (zf + 0.03)], 0.01));
      if (front) susp.push(rodGeo([xa + 0.13, 0.37, s * 0.2], [xa + 0.1, 0.37, s * 0.78], 0.009));
      susp.push(ball([xa - 0.04, 0.7, s * (zf + 0.03)], 0.03));
    }
  }
  // Front coilovers lying across the frame, spring and body.
  for (const s of [1, -1]) {
    susp.push(rodGeo([1.21, 0.72, s * 0.24], [1.21, 0.72, s * 0.04], 0.022));
    const coil: THREE.Vector3[] = [];
    for (let i = 0; i <= 120; i++) { const u = i / 120, a = u * Math.PI * 2 * 7; coil.push(new THREE.Vector3(1.21 + 0.036 * Math.cos(a), 0.72 + 0.036 * Math.sin(a), s * (0.06 + 0.15 * u))); }
    root.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 240, 0.007, 8, false), M.copper()));
  }
  susp.push(rodGeo([1.38, 0.37, 0.22], [1.38, 0.37, -0.22], 0.018));
  const arms = mesh(merged(susp), steel);
  root.add(arms);
  stress.set(arms, (p) => clamp01(0.25 + 0.6 * Math.exp(-((p.x - 1.25) ** 2) * 6) * (Math.abs(p.z) / 0.8)));

  const anchors = { hoop: anchor(root, [-0.3, 1.47, 0]), sis: anchor(root, [0.35, 0.44, 0.36]), push: anchor(root, [-1.17, 0.5, 0.5]) };
  root.rotation.y = 0.5;
  return {
    root, anchors, shells, stress, cut: [0, 0, -1], room: 0.86,
    animate: (t) => {
      const a = 0.16 * Math.sin(t * 0.5);
      for (const c of fronts) c.rotation.y = a;
      steer.rotation.x = -a * 6;
    },
  };
}

// ---------- Quadcopter: a 5-inch true-X frame, motors, props, the flight stack and its battery ----------
// About 1 unit to 100 mm. It hovers: the props turn and the body rides a little up and down.
function drone(): Built {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  // Cut plate reads matte, not like the rolled tube of an airframe.
  const carbon = new THREE.MeshPhysicalMaterial({ color: 0x1b1d21, metalness: 0.25, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.55 });
  const steel = M.steel(), copper = M.copper(), dark = M.dark(), chip = M.chip();
  // Where the floor is, so it hangs in the air above its shadow.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial());
  floor.visible = false; floor.position.y = -0.62; root.add(floor);

  // Four arms, each cut from 5 mm plate with a lightening slot and the motor's bolt pattern.
  const R = 1.1, pad = 0.165;
  const arm = new THREE.Shape();
  const a0 = Math.PI - Math.asin(0.115 / pad);
  arm.moveTo(0.1, -0.12); arm.lineTo(R - pad * Math.cos(Math.asin(0.115 / pad)), -0.115);
  arm.absarc(R, 0, pad, -a0, a0, false);
  arm.lineTo(0.1, 0.125); arm.closePath();
  arm.holes.push(hole(R, 0, 0.04));
  for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2; arm.holes.push(hole(R + Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.014)); }
  const slot = new THREE.Path();
  slot.moveTo(0.38, 0.032); slot.lineTo(0.72, 0.032); slot.absarc(0.72, 0, 0.032, Math.PI / 2, -Math.PI / 2, true);
  slot.lineTo(0.38, -0.032); slot.absarc(0.38, 0, 0.032, -Math.PI / 2, -Math.PI * 1.5, true);
  arm.holes.push(slot);
  const armStress = (p: THREE.Vector3) => { const d = Math.hypot(p.x, p.z); return clamp01(0.12 + 0.85 * Math.max(0, 1 - (d - 0.2) / 0.85) ** 1.6); };
  const motors: { g: THREE.Group; dir: number }[] = [];
  const bell = lathe([[0.03, 0.04], [0.148, 0.04], [0.153, 0.055], [0.153, 0.17], [0.135, 0.19], [0.07, 0.2], [0.035, 0.205], [0, 0.205]], 64);
  const base = lathe([[0, 0], [0.13, 0], [0.145, 0.012], [0.145, 0.04], [0, 0.04]], 64);
  // One prop blade: a rounded planform with its chord pitched up, three to a hub.
  const blade = new THREE.Shape();
  const span = 0.6, steps = 16, lead: [number, number][] = [], trail: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, x = 0.05 + u * span, c = 0.045 + 0.085 * Math.sin(Math.PI * Math.min(1, u * 1.15) ** 0.75) * (1 - 0.55 * u);
    lead.push([x, c * 0.42]); trail.push([x, -c * 0.58]);
  }
  blade.moveTo(...trail[0]); trail.forEach((p) => blade.lineTo(...p));
  blade.absarc(lead[steps][0] - 0.0, (lead[steps][1] + trail[steps][1]) / 2, (lead[steps][1] - trail[steps][1]) / 2, -Math.PI / 2, Math.PI / 2, false);
  [...lead].reverse().forEach((p) => blade.lineTo(...p));
  blade.closePath();
  const blades: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.ExtrudeGeometry(blade, { depth: 0.012, bevelEnabled: false, curveSegments: 12 });
    g.translate(0, 0, -0.006); g.rotateX(-Math.PI / 2 + 0.32); g.rotateY((k / 3) * Math.PI * 2);
    blades.push(g);
  }
  const prop = mergeGeometries(blades, false);
  blades.forEach((g) => g.dispose());
  const propMat = M.prop();

  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const g = new THREE.ExtrudeGeometry(arm, { depth: 0.055, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: 24 });
    g.rotateX(-Math.PI / 2); g.rotateY(a);
    const m = mesh(g, carbon);
    body.add(m); stress.set(m, armStress);
    const mg = new THREE.Group(); mg.position.set(Math.cos(a) * R, 0.06, -Math.sin(a) * R); body.add(mg);
    mg.add(mesh(base, dark));
    const spin = new THREE.Group(); mg.add(spin);
    const b = mesh(bell, copper); spin.add(b); stress.set(b, () => 0.18);
    spin.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.32, 16), steel, [0, 0.2, 0]));
    spin.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 32), M.prop(), [0, 0.24, 0]));
    spin.add(mesh(prop, propMat, [0, 0.245, 0]));
    spin.add(mesh(hexNut(0.03, 0.035), steel, [0, 0.29, 0]));
    motors.push({ g: spin, dir: k % 2 ? 1 : -1 });
  }

  // Bottom plate, the arm lock above it, standoffs, and the top plate with the battery on it.
  const lower = mesh(plateGeo(roundRect(0.58, 0.86, 0.09), 0.03, -0.035), carbon);
  body.add(lower);
  stress.set(lower, (p) => clamp01(0.2 + 0.55 * Math.exp(-((Math.abs(p.x) - 0.2) ** 2 + (Math.abs(p.z) - 0.28) ** 2) * 18)));
  body.add(mesh(plateGeo(roundRect(0.5, 0.5, 0.08), 0.022, 0.06), carbon));
  for (const x of [-0.2, 0.2]) for (const z of [-0.3, 0.3]) body.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.36, 6), copper, [x, 0.26, z]));
  const top = mesh(plateGeo(roundRect(0.52, 0.8, 0.08), 0.02, 0.44), carbon);
  body.add(top); shells.push(top); stress.set(top, () => 0.2);
  const lipo = mesh(new RoundedBoxGeometry(0.66, 0.24, 0.36, 3, 0.04), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.1, roughness: 0.5 }), [-0.04, 0.585, 0]);
  body.add(lipo); shells.push(lipo);
  const label = mesh(new THREE.BoxGeometry(0.2, 0.245, 0.365), new THREE.MeshStandardMaterial({ color: 0xe3b23c, metalness: 0, roughness: 0.55 }), [0.12, 0.585, 0]);
  body.add(label); shells.push(label);
  const strap = mesh(new THREE.BoxGeometry(0.07, 0.26, 0.38), M.rubber(), [-0.16, 0.583, 0]);
  body.add(strap); shells.push(strap);
  body.add(mesh(tube([[-0.37, 0.6, 0.05], [-0.48, 0.5, 0.08], [-0.4, 0.3, 0.06], [-0.18, 0.2, 0.04]], 0.016), M.wireR()));
  body.add(mesh(tube([[-0.37, 0.6, -0.03], [-0.5, 0.48, -0.04], [-0.42, 0.28, -0.05], [-0.18, 0.2, -0.04]], 0.016), M.wireK()));

  // The stack: a 4-in-1 ESC under the flight controller, on rubber-mounted standoffs.
  const pcb = new THREE.MeshStandardMaterial({ color: 0x15191c, metalness: 0.1, roughness: 0.5 });
  for (const [y, kind] of [[0.12, "esc"], [0.25, "fc"]] as const) {
    body.add(mesh(new RoundedBoxGeometry(0.34, 0.018, 0.34, 2, 0.006), pcb, [0, y, 0]));
    if (kind === "esc") for (const [x, z] of [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]]) body.add(mesh(new THREE.BoxGeometry(0.07, 0.02, 0.05), chip, [x, y + 0.019, z]));
    else {
      body.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), chip, [0, y + 0.019, 0]));
      body.add(mesh(new THREE.BoxGeometry(0.04, 0.016, 0.04), chip, [0.09, y + 0.017, -0.08]));
      body.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), M.paint(), [-0.12, y + 0.024, 0.1]));
    }
  }
  body.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 24), M.dark(), [0.06, 0.07, 0.15], [Math.PI / 2, 0, 0])); // low-ESR cap
  const fcAnchor = anchor(body, [0.0, 0.28, 0]);
  // The camera up front in its mount, tilted up 25°.
  const cam = new THREE.Group(); cam.position.set(0.34, 0.24, 0); cam.rotation.z = 0.44; body.add(cam);
  cam.add(mesh(new RoundedBoxGeometry(0.19, 0.19, 0.19, 2, 0.025), dark));
  cam.add(mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.09, 32), M.anod(), [0.13, 0, 0], [0, 0, Math.PI / 2]));
  cam.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 32), new THREE.MeshPhysicalMaterial({ color: 0x0b1020, metalness: 0.3, roughness: 0.05, clearcoat: 1 }), [0.178, 0, 0], [0, 0, Math.PI / 2]));
  for (const z of [-0.115, 0.115]) body.add(mesh(new RoundedBoxGeometry(0.24, 0.26, 0.025, 2, 0.01), M.rubber(), [0.34, 0.2, z]));
  // Antennas off the back: the video stub and two receiver wires.
  body.add(mesh(tube([[-0.24, 0.22, 0], [-0.4, 0.3, 0], [-0.58, 0.5, 0]], 0.014), M.dark()));
  body.add(mesh(new THREE.SphereGeometry(0.045, 24, 16), M.dark(), [-0.6, 0.53, 0]));
  for (const s of [1, -1]) body.add(mesh(tube([[-0.24, 0.16, s * 0.12], [-0.42, 0.2, s * 0.3], [-0.6, 0.34, s * 0.46]], 0.007), M.paint()));

  const anchors = { arm: anchor(body, [Math.cos(Math.PI / 4) * 0.55, 0.06, -Math.sin(Math.PI / 4) * 0.55]), motor: anchor(motors[2].g, [0, 0.3, 0]), stack: fcAnchor };
  root.rotation.y = 0.25;
  return {
    root, anchors, shells, stress, cut: [0, 0, -1], room: 0.8, phi: 0.92,
    animate: (t) => {
      for (const m of motors) m.g.rotation.y = m.dir * t * 7;
      body.position.y = 0.035 * Math.sin(t * 1.3);
      body.rotation.z = 0.025 * Math.sin(t * 0.9);
    },
  };
}

// ---------- Truss bridge: a Pratt truss on two abutments, loaded at midspan ----------
// The stress view is the truss's own statics for the midspan load: chords carry the bending moment
// (most at midspan, top in compression, bottom in tension), diagonals the shear, and the middle
// vertical carries nothing (a zero-force member, as the hand calculation says).
function bridge(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const steel = M.steel();
  const L = 2.2, n = 8, panel = (2 * L) / n, yb = 0.6, yt = 1.3, w = 0.45;
  const xs = Array.from({ length: n + 1 }, (_, i) => -L + i * panel);
  const top: THREE.BufferGeometry[] = [], bottom: THREE.BufferGeometry[] = [], diag: THREE.BufferGeometry[] = [], vert: THREE.BufferGeometry[] = [], plates: THREE.BufferGeometry[] = [];
  for (const z of [w, -w]) {
    for (let i = 0; i < n; i++) bottom.push(barGeo([xs[i], yb, z], [xs[i + 1], yb, z], 0.075, 0.07));
    for (let i = 1; i < n - 1; i++) top.push(barGeo([xs[i], yt, z], [xs[i + 1], yt, z], 0.075, 0.07));
    diag.push(barGeo([xs[0], yb, z], [xs[1], yt, z], 0.07, 0.065), barGeo([xs[n], yb, z], [xs[n - 1], yt, z], 0.07, 0.065));
    for (let i = 1; i < n / 2; i++) diag.push(barGeo([xs[i], yt, z], [xs[i + 1], yb, z], 0.05, 0.05));
    for (let i = n / 2; i < n - 1; i++) diag.push(barGeo([xs[i + 1], yt, z], [xs[i], yb, z], 0.05, 0.05));
    for (let i = 1; i < n; i++) vert.push(barGeo([xs[i], yb, z], [xs[i], yt, z], 0.055, 0.05));
    // Gusset plates on both faces at every joint.
    for (let i = 0; i <= n; i++) for (const y of i === 0 || i === n ? [yb] : [yb, yt]) for (const f of [1, -1]) plates.push(new THREE.BoxGeometry(0.2, 0.17, 0.008).translate(xs[i], y + (y === yb ? 0.035 : -0.035), z + f * 0.04));
  }
  const add = (geos: THREE.BufferGeometry[], f: (p: THREE.Vector3) => number, mat: THREE.Material = steel, shell = true) => { const m = mesh(merged(geos), mat); root.add(m); stress.set(m, f); if (shell) shells.push(m); return m; };
  const moment = (p: THREE.Vector3) => clamp01(0.1 + 0.88 * (1 - Math.abs(p.x) / L));
  add(top, moment); add(bottom, moment); add(plates, (p) => clamp01(0.15 + 0.6 * (1 - Math.abs(p.x) / L)));
  add(diag, (p) => (Math.abs(p.x) > L - panel * 0.9 ? 0.62 : 0.52));
  add(vert, (p) => (Math.abs(p.x) < 0.05 ? 0.04 : 0.4));

  // Floor beams at each bottom joint, a grating deck on them, and the top laterals.
  const beams: THREE.BufferGeometry[] = [], laterals: THREE.BufferGeometry[] = [];
  for (const x of xs) beams.push(barGeo([x, yb - 0.01, w], [x, yb - 0.01, -w], 0.08, 0.06));
  for (let i = 1; i < n - 1; i++) laterals.push(rodGeo([xs[i], yt + 0.02, w], [xs[i + 1], yt + 0.02, -w], 0.012), rodGeo([xs[i], yt + 0.02, -w], [xs[i + 1], yt + 0.02, w], 0.012));
  for (let i = 1; i < n; i++) laterals.push(barGeo([xs[i], yt, w], [xs[i], yt, -w], 0.04, 0.04));
  add(beams, (p) => clamp01(0.12 + 0.7 * Math.exp(-p.x * p.x * 18)), steel, false);
  add(laterals, () => 0.14, steel, false);
  const deck = mesh(new THREE.BoxGeometry(2 * L + 0.1, 0.025, 2 * w - 0.08), M.dark(), [0, yb + 0.045, 0]);
  root.add(deck); shells.push(deck); stress.set(deck, (p) => clamp01(0.1 + 0.55 * Math.exp(-p.x * p.x * 2.5)));

  // Bearings on concrete abutments: a pin at one end, a roller at the other.
  const concrete = M.concrete();
  for (const s of [-1, 1]) {
    root.add(mesh(new THREE.BoxGeometry(0.62, yb - 0.08, 1.36), concrete, [s * (L + 0.2), (yb - 0.08) / 2, 0]));
    for (const z of [w, -w]) {
      root.add(mesh(new THREE.BoxGeometry(0.2, 0.025, 0.16), steel, [s * L, yb - 0.068, z]));
      if (s < 0) root.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 24), steel, [s * L, yb - 0.04, z], [Math.PI / 2, 0, 0]));
      else for (const dx of [-0.05, 0.05]) root.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 24), steel, [s * L + dx, yb - 0.035, z], [Math.PI / 2, 0, 0]));
    }
  }
  // The test load: plates stacked at midspan, and the arrow that says where it acts.
  const weights = M.dark();
  for (let i = 0; i < 3; i++) root.add(mesh(lathe([[0.03, 0], [0.24, 0], [0.25, 0.01], [0.25, 0.05], [0.24, 0.06], [0.03, 0.06]], 64), weights, [0, yb + 0.058 + i * 0.065, 0]));
  const arrow = new THREE.Group(); arrow.position.set(0, yb + 0.95, 0); root.add(arrow);
  const glow = new THREE.MeshStandardMaterial({ color: 0xe58a5c, emissive: 0xb8562b, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.4 });
  arrow.add(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 16), glow, [0, 0.12, 0]));
  arrow.add(mesh(new THREE.ConeGeometry(0.07, 0.15, 32), glow, [0, -0.15, 0], [Math.PI, 0, 0]));

  const anchors = { top: anchor(root, [-1.1, yt + 0.04, w + 0.04]), bottom: anchor(root, [1.1, yb - 0.04, w + 0.04]), load: anchor(arrow, [0, 0.34, 0]) };
  return {
    root, anchors, shells, stress, turn: "sway", cut: [0, 0, -1], room: 0.88, theta: 0.45,
    animate: (t) => { arrow.position.y = yb + 0.95 + 0.04 * Math.sin(t * 2.2); },
  };
}

// ---------- Circuit board: a sensor node, 65 × 45 mm, four layers, on standoffs ----------
// About 1 unit to 25 mm. Traces run under the mask at 45°; the stress view here is the board's heat
// (the buck converter is the hot spot). The section view opens the RF shield, the USB-C shell and
// the MCU's package to the die and its bond wires.
function pcb(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const steel = M.steel(), chip = M.chip(), gold = M.gold(), tan = M.tan();
  const B = 0.3, T = B + 0.064;
  const heat = (p: THREE.Vector3) => clamp01(0.08 + 0.85 * Math.exp(-((p.x - 0.5) ** 2 + (p.z - 0.6) ** 2) * 5) + 0.45 * Math.exp(-((p.x + 0.35) ** 2 + p.z ** 2) * 7) + 0.3 * Math.exp(-((p.x - 0.7) ** 2 + p.z ** 2) * 8));
  const part = (geo: THREE.BufferGeometry, mat: THREE.Material, at: V3, hot = true, shell = false) => { const m = mesh(geo, mat, at); root.add(m); if (hot) stress.set(m, heat); if (shell) shells.push(m); return m; };

  const outline = roundRect(2.6, 1.8, 0.1);
  for (const x of [-1.15, 1.15]) for (const y of [-0.75, 0.75]) outline.holes.push(hole(x, y, 0.055));
  part(plateGeo(outline, 0.064, B, 0), M.mask(), [0, 0, 0]);
  const brass = M.brass();
  for (const x of [-1.15, 1.15]) for (const z of [-0.75, 0.75]) {
    root.add(mesh(hexNut(0.07, B), brass, [x, B / 2, z]));
    root.add(mesh(lathe([[0, 0], [0.065, 0], [0.065, 0.02], [0.05, 0.035], [0, 0.035]], 32), steel, [x, T, z]));
  }

  // Traces: polylines at 45°, a round pad at each bend, merged into one layer under the mask.
  const traces: THREE.BufferGeometry[] = [];
  const route = (pts: [number, number][], wd = 0.016) => {
    for (let i = 0; i < pts.length - 1; i++) traces.push(barGeo([pts[i][0], T + 0.002, pts[i][1]], [pts[i + 1][0], T + 0.002, pts[i + 1][1]], 0.004, wd));
    for (const [x, z] of pts) traces.push(new THREE.CylinderGeometry(wd / 2, wd / 2, 0.004, 12).translate(x, T + 0.002, z));
  };
  const vias: [number, number][] = [];
  // USB-C to the MCU: the differential pair.
  route([[-1.05, 0.03], [-0.85, 0.03], [-0.8, 0.08], [-0.6, 0.08]]);
  route([[-1.05, -0.03], [-0.83, -0.03], [-0.76, 0.04], [-0.6, 0.04]]);
  // MCU to the radio, fanning out from the pin pitch.
  for (let k = 0; k < 6; k++) { const zp = -0.055 + k * 0.022, z = -0.16 + k * 0.064, d = Math.abs(z - zp); route([[-0.1, zp], [0.02, zp], [0.02 + d, z], [0.35, z]]); }
  // MCU to the header, fanning out to the 2.54 mm pitch.
  for (let k = 0; k < 10; k++) { const xp = -0.5 + k * 0.033, xh = -0.8 + k * 0.1, d = Math.abs(xh - xp); route([[xp, 0.25], [xp, 0.29], [xh, 0.29 + d], [xh, 0.6]]); vias.push([xp, 0.29]); }
  // Crystal, LEDs, the screw terminal, and power from the buck converter.
  route([[-0.67, -0.35], [-0.47, -0.35], [-0.47, -0.25]]); route([[-0.67, -0.3], [-0.52, -0.3], [-0.52, -0.25]]);
  for (let k = 0; k < 3; k++) { const z = -0.12 - k * 0.03, x = -1.15 + k * 0.1; route([[-0.6, z], [x + 0.2 + k * 0.03, z], [x, z - 0.2 - k * 0.03], [x, -0.52]]); }
  for (let k = 0; k < 4; k++) { const x = -0.45 + k * 0.05, z = -0.5 - k * 0.04; route([[x, -0.25], [x, z + 0.1 - k * 0.02], [x + 0.1, z], [0.92, z]]); vias.push([0.6, z]); }
  route([[0.6, 0.5], [0.6, 0.27]], 0.04); route([[0.36, 0.52], [0.36, 0.42], [0.22, 0.42]], 0.03);
  const traceMesh = part(merged(traces), M.trace(), [0, 0, 0]);
  traceMesh.castShadow = false;
  const viaMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 0.068, 12), gold, vias.length);
  const tm = new THREE.Matrix4();
  vias.forEach(([x, z], i) => { tm.makeTranslation(x, B + 0.034, z); viaMesh.setMatrixAt(i, tm); });
  root.add(viaMesh);

  // Silkscreen outlines around the main parts.
  const silk: THREE.BufferGeometry[] = [];
  const box = (x: number, z: number, w: number, d: number) => { const h = 0.003, y = T + 0.0045; silk.push(barGeo([x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], h, 0.01), barGeo([x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], h, 0.01), barGeo([x - w / 2, y, z - d / 2], [x - w / 2, y, z + d / 2], h, 0.01), barGeo([x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], h, 0.01)); };
  box(-0.35, 0, 0.6, 0.6); box(-0.35, 0.67, 1.06, 0.26); box(0.7, 0, 0.78, 0.58); box(0.62, 0.62, 0.34, 0.34);
  part(merged(silk), M.silk(), [0, 0, 0], false);

  // The MCU: a 64-pin QFP whose package opens in the section view to its die and bond wires.
  part(new THREE.BoxGeometry(0.42, 0.05, 0.42), chip, [-0.35, T + 0.027, 0], true, true);
  root.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 16), M.dark(), [-0.5, T + 0.053, -0.15]));
  root.add(mesh(new THREE.BoxGeometry(0.16, 0.012, 0.16), M.alu(), [-0.35, T + 0.022, 0]));
  const wires: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 8; k++) { const z = -0.07 + k * 0.02; for (const s of [-1, 1]) wires.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([vec([-0.35 + s * 0.075, T + 0.03, z]), vec([-0.35 + s * 0.13, T + 0.045, z * 1.4]), vec([-0.35 + s * 0.19, T + 0.02, z * 1.9])]), 12, 0.0025, 5, false)); }
  root.add(mesh(merged(wires), gold));
  const pin = new THREE.BoxGeometry(0.06, 0.012, 0.011);
  const pins = new THREE.InstancedMesh(pin, steel, 64);
  const q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  for (let side = 0; side < 4; side++) for (let i = 0; i < 16; i++) {
    const o = -0.165 + i * 0.022, a = (side * Math.PI) / 2, r = 0.24;
    const x = -0.35 + Math.cos(a) * r - Math.sin(a) * o, z = Math.sin(a) * r + Math.cos(a) * o;
    q.setFromAxisAngle(UP, -a);
    tm.compose(new THREE.Vector3(x, T + 0.008, z), q, sc);
    pins.setMatrixAt(side * 16 + i, tm);
  }
  root.add(pins);

  // USB-C at the edge (its shell opens to the tongue), the crystal, LEDs and a button.
  part(new RoundedBoxGeometry(0.3, 0.12, 0.34, 2, 0.05), steel, [-1.22, T + 0.062, 0], true, true);
  root.add(mesh(new THREE.BoxGeometry(0.24, 0.025, 0.2), chip, [-1.22, T + 0.062, 0]));
  const contacts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.004, 0.008), gold, 12);
  for (let i = 0; i < 12; i++) { tm.makeTranslation(-1.24, T + 0.076, -0.088 + i * 0.016); contacts.setMatrixAt(i, tm); }
  root.add(contacts);
  part(new RoundedBoxGeometry(0.16, 0.05, 0.07, 2, 0.015), steel, [-0.75, T + 0.025, -0.36]);
  for (let k = 0; k < 3; k++) root.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.035), new THREE.MeshStandardMaterial({ color: k ? 0xf0f0ea : 0x7cf29a, emissive: k ? 0x000000 : 0x2ad66a, emissiveIntensity: 0.8, roughness: 0.3 }), [-1.15 + k * 0.1, T + 0.015, -0.56]));
  root.add(mesh(new THREE.BoxGeometry(0.14, 0.04, 0.14), steel, [-1.12, T + 0.02, 0.45]));
  root.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 24), M.dark(), [-1.12, T + 0.06, 0.45]));

  // The radio module: its own board, a shield can (opens in section) and a meander antenna.
  part(new THREE.BoxGeometry(0.72, 0.03, 0.52), new THREE.MeshStandardMaterial({ color: 0x1b1e22, roughness: 0.5 }), [0.72, T + 0.015, 0]);
  part(new THREE.BoxGeometry(0.5, 0.09, 0.44), new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.22 }), [0.62, T + 0.075, 0], true, true);
  root.add(mesh(new THREE.BoxGeometry(0.2, 0.035, 0.2), chip, [0.6, T + 0.048, 0]));
  const ant: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) { const z = -0.2 + k * 0.1, y = T + 0.032; ant.push(barGeo([0.93, y, z], [1.03, y, z], 0.003, 0.014)); if (k < 4) ant.push(barGeo([k % 2 ? 0.93 : 1.03, y, z], [k % 2 ? 0.93 : 1.03, y, z + 0.1], 0.003, 0.014)); }
  root.add(mesh(merged(ant), gold));

  // Buck converter (the hot spot): inductor, regulator, bulk capacitor; the header and terminal.
  part(new RoundedBoxGeometry(0.26, 0.14, 0.26, 3, 0.03), new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.35, roughness: 0.5 }), [0.62, T + 0.07, 0.62]);
  part(new THREE.BoxGeometry(0.12, 0.03, 0.1), chip, [0.36, T + 0.015, 0.62]);
  part(lathe([[0, 0], [0.11, 0], [0.115, 0.01], [0.115, 0.25], [0.105, 0.265], [0, 0.265]], 48), M.alu(), [1.07, T, 0.6]);
  root.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.004, 48), M.dark(), [1.07, T + 0.267, 0.6]));
  const header = part(new THREE.BoxGeometry(1.0, 0.1, 0.2), M.rubber(), [-0.35, T + 0.05, 0.67], false);
  header.castShadow = true;
  const hp = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.24, 0.025), gold, 20);
  for (let i = 0; i < 20; i++) { tm.makeTranslation(-0.8 + (i % 10) * 0.1, T + 0.12, 0.62 + Math.floor(i / 10) * 0.1); hp.setMatrixAt(i, tm); }
  root.add(hp);
  part(new THREE.BoxGeometry(0.26, 0.2, 0.2), M.terminal(), [1.05, T + 0.1, -0.6]);
  for (const x of [0.99, 1.11]) root.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 24), steel, [x, T + 0.205, -0.6]));

  // Passives: decoupling around the MCU and the radio, a few by the regulator.
  const spots: [number, number, number][] = [];
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + 0.2; spots.push([-0.35 + Math.cos(a) * 0.36, Math.sin(a) * 0.36, a]); }
  for (let k = 0; k < 6; k++) spots.push([0.3 + k * 0.05, -0.32, Math.PI / 2], [0.3 + k * 0.05, 0.32, Math.PI / 2]);
  for (let k = 0; k < 5; k++) spots.push([0.22 + k * 0.045, 0.78, 0]);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.022, 0.022), tan, spots.length);
  const res = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.016, 0.022), chip, spots.length);
  spots.forEach(([x, z, a], i) => {
    q.setFromAxisAngle(UP, a);
    tm.compose(new THREE.Vector3(x, T + 0.011, z), q, sc); caps.setMatrixAt(i, tm);
    tm.compose(new THREE.Vector3(x + Math.sin(a) * 0.05, T + 0.008, z + Math.cos(a) * 0.05), q, sc); res.setMatrixAt(i, tm);
  });
  root.add(caps, res);

  const anchors = { mcu: anchor(root, [-0.35, T + 0.06, -0.12]), buck: anchor(root, [0.62, T + 0.15, 0.62]), usb: anchor(root, [-1.36, T + 0.07, 0]) };
  return { root, anchors, shells, stress, turn: "sway", cut: [0, 0, -1], phi: 0.92, animate: () => {} };
}

// ---------- Software, drawn as the system it runs ----------
// The three views mean what they would to whoever built it: the stress view becomes the system's own
// heat (a planner's cost map, a network's activations, a cluster's load), and the section view opens
// the hardware it runs on or the model's layers. Glowing parts (the path, requests in flight) keep
// their colour in every view (`userData.keep`).
const glowMat = (color: number, emissive: number, intensity = 0.7) => new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: intensity, metalness: 0.1, roughness: 0.4 });
const keep = <T extends THREE.Object3D>(o: T, plain = true) => { o.userData.keep = true; if (plain) o.userData.plain = true; return o; };

// ---------- Rover autonomy: A* on a cost map, lidar, a loop through a cluttered yard ----------
function rover(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  // Obstacles: rocks and crates, as [x, z, radius].
  const obstacles: [number, number, number, "rock" | "crate"][] = [[-0.9, -0.6, 0.32, "rock"], [0.5, -1.05, 0.26, "crate"], [0.85, 0.35, 0.36, "rock"], [-0.35, 0.95, 0.24, "crate"], [-1.55, 0.55, 0.22, "rock"], [1.65, -0.25, 0.2, "crate"], [0.0, -0.05, 0.18, "rock"]];
  const cost = (p: THREE.Vector3) => {
    let c = 0;
    for (const [x, z, r] of obstacles) { const d = Math.hypot(p.x - x, p.z - z) - r; c = Math.max(c, d <= 0 ? 1 : Math.max(0, 1 - d / 0.55) ** 1.6 * 0.92); }
    return c;
  };
  // The yard: a gently uneven patch of ground.
  const ground = new THREE.PlaneGeometry(4.6, 3.6, 92, 72);
  ground.rotateX(-Math.PI / 2);
  const gp = ground.getAttribute("position");
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i); gp.setY(i, 0.03 * Math.sin(x * 2.1) * Math.cos(z * 1.7) + 0.015 * Math.sin(x * 5 + z * 3)); }
  ground.computeVertexNormals();
  const yard = mesh(ground, new THREE.MeshStandardMaterial({ color: 0x8c8577, roughness: 0.95, metalness: 0 }));
  yard.userData.plain = true;
  root.add(yard); stress.set(yard, cost);
  const rock = M.dark(), crate = new THREE.MeshStandardMaterial({ color: 0xa0784a, roughness: 0.8 });
  for (const [x, z, r, kind] of obstacles) {
    const g = kind === "rock" ? new THREE.IcosahedronGeometry(r, 1) : new RoundedBoxGeometry(r * 1.5, r * 1.3, r * 1.5, 2, 0.02);
    if (kind === "rock") { const a = g.getAttribute("position"); for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * (1 + 0.15 * Math.sin(i * 1.7)), a.getY(i) * 0.7, a.getZ(i) * (1 + 0.12 * Math.cos(i * 2.3))); g.computeVertexNormals(); }
    const o = mesh(g, kind === "rock" ? rock : crate, [x, kind === "rock" ? r * 0.45 : r * 0.65, z], [0, x * 3, 0]);
    root.add(o); stress.set(o, () => 1);
  }
  // The planned loop (what A* found, smoothed), its waypoints and the goal.
  const loop = new THREE.CatmullRomCurve3([[-1.9, -1.2], [-0.25, -0.7], [0.6, -0.45], [1.6, 0.55], [0.2, 1.3], [-0.85, 0.15], [-1.95, -0.25]].map(([x, z]) => new THREE.Vector3(x, 0.05, z)), true, "centripetal");
  const path = keep(mesh(new THREE.TubeGeometry(loop, 240, 0.022, 12, true), glowMat(0xe58a5c, 0xb8562b, 0.9)));
  path.castShadow = false; root.add(path);
  for (let i = 0; i < 10; i++) { const q = loop.getPointAt(i / 10); root.add(keep(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24), glowMat(0xffffff, 0xe58a5c, 0.4), [q.x, 0.05, q.z]))); }
  // The rover: rocker-bogie-ish chassis, its body (opens in section to the computer), the lidar mast.
  const bot = new THREE.Group(); root.add(bot);
  const body = mesh(new RoundedBoxGeometry(0.62, 0.17, 0.42, 3, 0.04), M.paint(), [0, 0.27, 0]);
  bot.add(body); shells.push(body); stress.set(body, () => 0.2);
  bot.add(mesh(new THREE.BoxGeometry(0.5, 0.02, 0.34), M.fr4(), [0, 0.22, 0]));
  bot.add(mesh(new THREE.BoxGeometry(0.2, 0.06, 0.16), M.alu(), [0.06, 0.26, 0]));
  for (let i = 0; i < 6; i++) bot.add(mesh(new THREE.BoxGeometry(0.008, 0.05, 0.16), M.alu(), [-0.03 + i * 0.035, 0.31, 0]));
  bot.add(mesh(new RoundedBoxGeometry(0.2, 0.07, 0.24, 2, 0.015), M.lipo(), [-0.17, 0.26, 0]));
  const wheels: THREE.Mesh[] = [];
  for (const x of [-0.24, 0.24]) for (const z of [-0.26, 0.26]) {
    const w = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 32), M.rubber(), [x, 0.1, z], [Math.PI / 2, 0, 0]);
    bot.add(w); wheels.push(w);
    bot.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.085, 24), M.anod(), [x, 0.1, z], [Math.PI / 2, 0, 0]));
  }
  for (const z of [-0.23, 0.23]) bot.add(mesh(tube([[-0.24, 0.1, z], [0, 0.2, z], [0.24, 0.1, z]], 0.014), M.alu()));
  bot.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), M.alu(), [0.16, 0.46, 0]));
  const lidar = new THREE.Group(); lidar.position.set(0.16, 0.6, 0); bot.add(lidar);
  lidar.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.07, 32), M.dark()));
  lidar.add(mesh(new THREE.CylinderGeometry(0.057, 0.057, 0.02, 32), new THREE.MeshPhysicalMaterial({ color: 0x0b1020, roughness: 0.1, clearcoat: 1 }), [0, 0.01, 0]));
  bot.add(mesh(new RoundedBoxGeometry(0.06, 0.05, 0.1, 2, 0.01), M.dark(), [0.32, 0.3, 0]));
  // The lidar's returns: points on whatever it can see, re-drawn as it turns.
  const N = 900, pts = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cloud = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.038, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
  cloud.geometry.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  cloud.geometry.setAttribute("color", new THREE.BufferAttribute(col, 3));
  root.add(cloud);
  const ray = new THREE.Raycaster(), hits = root.children.filter((o) => (o as THREE.Mesh).isMesh && o !== yard && o !== path) as THREE.Mesh[];
  const tint = new THREE.Color(), origin = new THREE.Vector3(), dir = new THREE.Vector3();
  let next = 0;
  const scan = (yaw: number, from: THREE.Vector3) => {
    for (let k = 0; k < 18; k++) {
      const a = yaw + (k / 18) * 0.5, el = -0.02 - (k % 6) * 0.045;
      origin.copy(from); dir.set(Math.cos(a), el, Math.sin(a)).normalize();
      ray.set(origin, dir); ray.far = 2.4;
      // Rays are cast in the world; the points live in the build's own frame (it's moved to centre it).
      const hit = ray.intersectObjects(hits, false)[0];
      const local = root.worldToLocal(origin.clone()), toGround = local.y / -dir.y;
      // No return within range (a ray that would land past it): nothing to draw.
      if (!hit && !(toGround > 0 && toGround < 2.4)) continue;
      const p = hit ? root.worldToLocal(hit.point.clone()) : local.addScaledVector(dir, toGround);
      const i = next++ % N;
      pts[i * 3] = p.x; pts[i * 3 + 1] = Math.max(0.02, p.y); pts[i * 3 + 2] = p.z;
      tint.set(hit ? 0x5eead4 : 0x6ea8ff);
      col[i * 3] = tint.r; col[i * 3 + 1] = tint.g; col[i * 3 + 2] = tint.b;
    }
    cloud.geometry.attributes.position.needsUpdate = true;
    cloud.geometry.attributes.color.needsUpdate = true;
  };
  const place = (u: number) => {
    const q = loop.getPointAt(u), t = loop.getTangentAt(u);
    bot.position.set(q.x, 0.01, q.z);
    bot.rotation.y = Math.atan2(-t.z, t.x);
  };
  place(0);
  root.updateMatrixWorld(true);
  for (let i = 0; i < 50; i++) scan(i * 0.5, lidar.getWorldPosition(new THREE.Vector3()));
  const anchors = { path: anchor(root, [1.55, 0.06, 0.6]), lidar: anchor(lidar, [0, 0.05, 0]), cost: anchor(root, [0.85, 0.5, 0.35]) };
  let last = -1;
  return {
    root, anchors, shells, stress, theta: 0.5, phi: 0.95, room: 0.84,
    onMode: (m) => { body.visible = m !== "section"; cloud.visible = m !== "stress"; },
    animate: (t) => {
      const u = (t * 0.035) % 1;
      place(u);
      for (const w of wheels) w.rotation.y = -t * 4;
      lidar.rotation.y = t * 6;
      if (Math.floor(t * 30) !== last) { last = Math.floor(t * 30); bot.updateMatrixWorld(true); scan(t * 6, lidar.getWorldPosition(origin.clone())); }
    },
  };
}

// ---------- A convolutional network: a weld photo in, crack / porosity / OK out ----------
function network(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  // The input: an 8 × 8 patch of the photo, a bright weld bead with a dark crack across it.
  const px = new THREE.InstancedMesh(new THREE.BoxGeometry(0.035, 0.11, 0.11), new THREE.MeshStandardMaterial({ roughness: 0.6 }), 64);
  const tm = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), k = i % 8, y = (3.5 - r) * 0.125, z = (k - 3.5) * 0.125;
    tm.makeTranslation(-2.25, 0.9 + y, z); px.setMatrixAt(i, tm);
    const bead = Math.exp(-((r - 3.5) ** 2) / 5), crack = Math.abs(r - (k * 0.55 + 1.6)) < 0.6 ? 0.55 : 1;
    c.setRGB(0.18 + 0.7 * bead * crack, 0.16 + 0.6 * bead * crack, 0.15 + 0.45 * bead * crack, THREE.SRGBColorSpace); px.setColorAt(i, c);
  }
  root.add(keep(px));
  // Feature maps: conv 1 (4 maps), conv 2 (8 maps), each a slab, stacked like the diagram in the paper.
  const slab = new THREE.MeshPhysicalMaterial({ color: 0x3a4250, metalness: 0.2, roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.92 });
  const act = (phase: number, freq: number) => (p: THREE.Vector3) => clamp01(0.5 + 0.45 * Math.sin(p.y * freq + phase) * Math.cos(p.z * freq * 0.8 + phase * 1.7));
  const maps: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) { const m = mesh(new RoundedBoxGeometry(0.05, 0.8, 0.8, 2, 0.012), slab, [-1.35 + i * 0.1, 0.9, 0]); root.add(m); maps.push(m); shells.push(m); stress.set(m, act(i * 1.3, 7)); }
  for (let i = 0; i < 8; i++) { const m = mesh(new RoundedBoxGeometry(0.04, 0.52, 0.52, 2, 0.01), slab, [-0.3 + i * 0.075, 0.9, 0]); root.add(m); maps.push(m); shells.push(m); stress.set(m, act(i * 0.9, 11)); }
  // Flattened, then a dense layer, then the three classes.
  const node = new THREE.SphereGeometry(1, 24, 16);
  const flat: THREE.Vector3[] = [], dense: THREE.Vector3[] = [], out: THREE.Vector3[] = [];
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x8d939c, metalness: 0.6, roughness: 0.32 });
  for (let i = 0; i < 14; i++) { const p = new THREE.Vector3(0.75, 0.9 + (i - 6.5) * 0.085, 0); flat.push(p); const m = mesh(node, nodeMat, [p.x, p.y, p.z]); m.scale.setScalar(0.032); root.add(m); stress.set(m, () => 0.2 + 0.6 * ((i * 7) % 5) / 4); }
  for (let i = 0; i < 9; i++) { const p = new THREE.Vector3(1.45, 0.9 + (i - 4) * 0.13, 0); dense.push(p); const m = mesh(node, nodeMat, [p.x, p.y, p.z]); m.scale.setScalar(0.045); root.add(m); stress.set(m, () => 0.15 + 0.8 * ((i * 5) % 4) / 3); }
  const outs: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) { const p = new THREE.Vector3(2.15, 0.9 + (1 - i) * 0.3, 0); out.push(p); const m = mesh(node, i === 0 ? glowMat(0xe58a5c, 0xb8562b, 0.9) : nodeMat, [p.x, p.y, p.z]); m.scale.setScalar(0.075); if (i === 0) keep(m); else stress.set(m, () => (i === 1 ? 0.12 : 0.06)); root.add(m); outs.push(m); }
  // Connections: receptive fields as pyramids between the maps, all-to-all between dense layers.
  const seg: number[] = [];
  const line = (a: THREE.Vector3, b: THREE.Vector3) => seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (const [cy, cz] of [[0.2, -0.15], [-0.1, 0.2]]) {
    const apex1 = v(-1.35, 0.9 + cy * 0.8, cz * 0.8);
    for (const [dy, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) line(v(-2.23, 0.9 + cy + dy * 0.19, cz + dz * 0.19), apex1);
    const apex2 = v(-0.3, 0.9 + cy * 0.5, cz * 0.5);
    for (const [dy, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) line(v(-1.05, 0.9 + cy * 0.8 + dy * 0.12, cz * 0.8 + dz * 0.12), apex2);
  }
  for (const a of flat) for (const b of dense) line(a, b);
  for (const a of dense) for (const b of out) line(a, b);
  for (let i = 0; i < 14; i++) line(v(0.25, 0.9 + (i - 6.5) * 0.03, 0), flat[i]);
  const wires = new THREE.BufferGeometry(); wires.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  root.add(new THREE.LineSegments(wires, new THREE.LineBasicMaterial({ color: 0x8f9098, transparent: true, opacity: 0.22, depthWrite: false })));
  // A forward pass: pulses run from the photo to the answer, over and over.
  const P = 28, pulse = keep(new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 12, 8), glowMat(0xffd9bf, 0xe58a5c, 1.2), P));
  root.add(pulse);
  const lanes = Array.from({ length: P }, (_, i) => ({ y: ((i * 37) % 17) / 17 - 0.5, z: ((i * 23) % 13) / 13 - 0.5, o: i / P, d: (i * 11) % 9, k: i % 3 === 0 ? 0 : (i % 3) }));
  const at = new THREE.Vector3();
  const along = (u: number, L: (typeof lanes)[number]) => {
    const xs = [-2.25, -1.35, -0.3, 0.75, 1.45, 2.15];
    const seg = Math.min(4, Math.floor(u * 5)), f = u * 5 - seg;
    const ys = [L.y * 0.8, L.y * 0.6, L.y * 0.4, (L.d - 4.5) * 0.085, (L.d - 4) * 0.13, (1 - L.k) * 0.3];
    const zs = [L.z * 0.8, L.z * 0.6, L.z * 0.4, 0, 0, 0];
    return at.set(xs[seg] + (xs[seg + 1] - xs[seg]) * f, 0.9 + ys[seg] + (ys[seg + 1] - ys[seg]) * f, zs[seg] + (zs[seg + 1] - zs[seg]) * f);
  };
  const anchors = { input: anchor(root, [-2.25, 1.4, 0.45]), conv: anchor(root, [-1.2, 1.32, 0.4]), output: anchor(outs[0], [0, 1.2, 0]) };
  return {
    root, anchors, shells, stress, turn: "sway", theta: 0.75, cut: [0, 0, -1], room: 0.82,
    animate: (t) => {
      for (let i = 0; i < P; i++) { const L = lanes[i]; along((t * 0.18 + L.o) % 1, L); tm.makeTranslation(at.x, at.y, at.z); pulse.setMatrixAt(i, tm); }
      pulse.instanceMatrix.needsUpdate = true;
      outs[0].scale.setScalar(0.075 * (1 + 0.12 * Math.sin(t * 3)));
    },
  };
}

// ---------- A backend under load: a load balancer, four app servers, Postgres and its replica ----------
// Requests flow as light along the links; every so often one app server is killed, goes red, and the
// load balancer routes around it (the milestone is that nothing failed while it did).
function cluster(): Built {
  const root = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  const stress = new Map<THREE.Mesh, (p: THREE.Vector3) => number>();
  const chassis = new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.45, roughness: 0.55 });
  const bezel = M.dark(), fanMat = M.chip();
  const leds: { mat: THREE.MeshStandardMaterial; down?: boolean }[] = [];
  // One rack server: the case (opens in section), a bezel with drive bays and a status light, and the
  // board, CPU heatsink, memory and fans inside.
  const server = (at: [number, number, number], w: number, h: number, load: number, down = false) => {
    const g = new THREE.Group(); g.position.set(...at); root.add(g);
    const box = mesh(new RoundedBoxGeometry(w, h, 0.62, 2, 0.015), chassis, [0, h / 2, 0]);
    g.add(box); shells.push(box); stress.set(box, () => load);
    g.add(mesh(new THREE.BoxGeometry(w - 0.04, 0.012, 0.56), M.fr4(), [0, 0.02, 0]));
    g.add(mesh(new THREE.BoxGeometry(0.14, h * 0.55, 0.14), M.alu(), [0.02, 0.03 + h * 0.28, -0.02]));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.012, h * 0.45, 0.2), M.dark(), [-0.16 - i * 0.03, 0.03 + h * 0.23, -0.02]));
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(h * 0.32, h * 0.32, 0.03, 24), fanMat, [-w / 2 + 0.12 + i * (w - 0.24) / 2, h / 2, -0.25], [Math.PI / 2, 0, 0]));
    const face = mesh(new THREE.BoxGeometry(w, h, 0.02), bezel, [0, h / 2, 0.32]);
    g.add(face); stress.set(face, () => load);
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(w * 0.13, h * 0.42, 0.012), M.chip(), [-w / 2 + 0.1 + i * w * 0.16, h / 2, 0.335]));
    const mat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1, roughness: 0.3 });
    leds.push({ mat, down });
    g.add(keep(mesh(new THREE.BoxGeometry(0.035, 0.035, 0.012), mat, [w / 2 - 0.08, h / 2, 0.336])));
    return g;
  };
  const gen = server([-2.15, 0, 0], 0.5, 0.16, 0.3);
  const lb = server([-1.15, 0, 0], 0.62, 0.16, 0.55);
  const apps = [-1.05, -0.35, 0.35, 1.05].map((z, i) => server([0.15, 0, z], 0.62, 0.16, 0.62 + 0.08 * (i % 2), i === 2));
  const db = server([1.35, 0, 0], 0.7, 0.3, 0.88);
  const rep = server([2.3, 0, 0], 0.7, 0.3, 0.32);
  const port = (g: THREE.Group, side: number, h = 0.16) => new THREE.Vector3(g.position.x + side * 0.36, h / 2, g.position.z);
  // Links between them, raised a little, and the requests that run along each one.
  const links: { curve: THREE.CatmullRomCurve3; app?: number; speed: number }[] = [];
  const link = (a: THREE.Vector3, b: THREE.Vector3, app?: number, speed = 0.5) => {
    const mid = a.clone().lerp(b, 0.5); mid.y += 0.22;
    const curve = new THREE.CatmullRomCurve3([a, mid, b]);
    const m = mesh(new THREE.TubeGeometry(curve, 40, 0.008, 8, false), new THREE.MeshStandardMaterial({ color: 0x5b6270, roughness: 0.6 }));
    m.userData.plain = true; root.add(m);
    links.push({ curve, app, speed });
  };
  link(port(gen, 1), port(lb, -1), undefined, 0.7);
  apps.forEach((g, i) => { link(port(lb, 1), port(g, -1), i); link(port(g, 1), port(db, -1, 0.3), i, 0.4); });
  link(port(db, 1, 0.3), port(rep, -1, 0.3), undefined, 0.25);
  const per = 5, req = keep(new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), glowMat(0xffd9bf, 0xe58a5c, 1.3), links.length * per));
  root.add(req);
  const tm = new THREE.Matrix4(), hidden = new THREE.Matrix4().makeScale(0, 0, 0), q = new THREE.Vector3();
  const anchors = { lb: anchor(lb, [0, 0.17, 0.3]), p99: anchor(apps[1], [0.31, 0.16, 0.3]), db: anchor(db, [0, 0.31, 0.3]) };
  return {
    root, anchors, shells, stress, turn: "sway", theta: 0.55, phi: 1.0, cut: [0, 0, -1], room: 0.84,
    animate: (t) => {
      const killed = t % 14 > 8 && t % 14 < 11.5;
      leds.forEach((l, i) => {
        const off = l.down && killed;
        l.mat.color.set(off ? 0xf87171 : 0x4ade80); l.mat.emissive.set(off ? 0xdc2626 : 0x22c55e);
        l.mat.emissiveIntensity = off ? 1.2 : 0.5 + 0.5 * Math.abs(Math.sin(t * (6 + i)));
      });
      links.forEach((L, j) => {
        for (let k = 0; k < per; k++) {
          const i = j * per + k;
          if (killed && L.app === 2) { req.setMatrixAt(i, hidden); continue; }
          L.curve.getPointAt((t * L.speed + k / per) % 1, q);
          tm.makeTranslation(q.x, q.y, q.z); req.setMatrixAt(i, tm);
        }
      });
      req.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildModel(id: BuildId): Built {
  switch (id) {
    case "avionics": return avionics();
    case "arm": return arm();
    case "gearbox": return gearbox();
    case "fsae": return fsae();
    case "drone": return drone();
    case "bridge": return bridge();
    case "pcb": return pcb();
    case "rover": return rover();
    case "nn": return network();
    case "cluster": return cluster();
  }
}
