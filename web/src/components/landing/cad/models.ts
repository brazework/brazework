import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// The landing page's builds (redesign 2026-11), modelled the way they'd come out of CAD: real
// proportions, machined parts, fasteners, harnesses, and materials that read as carbon, aluminium,
// FR-4 and steel. Units are decimetres-ish: each build fits a sphere of about 2.
//
// Each build returns its root group plus:
// - `anchors`: points the page labels with a callout (they move with the part they're on)
// - `animate(t)`: how it runs (joints, gears)
// - `shells`: the parts the section view cuts away, to show what's inside
// - `stress`: a 0..1 value per mesh for the stress view (higher near the loaded joints and roots)

export type BuildId = "avionics" | "arm" | "gearbox";
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
    root, anchors, shells, stress, turn: "sway", cut: [-1, 0, 0],
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

export function buildModel(id: BuildId): Built {
  return id === "avionics" ? avionics() : id === "arm" ? arm() : gearbox();
}
