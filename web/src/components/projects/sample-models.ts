import type * as THREE_NS from "three";

// Example models, built in code (no file to download): what the landing page shows in the 3D viewer,
// one per kind of build. Each is in metres, like a glTF, so the viewer's size readout is right, and
// each top-level group is one part, which is what "Explode" pulls apart.
// Example objects with made-up results, not anyone's real design; the page says so.

type Three = typeof THREE_NS;
type V3 = [number, number, number];
type Group = THREE_NS.Group;
type Mat = THREE_NS.Material;

/** The examples, in the order the landing page offers them: the field, the build, and the kind of
 *  milestone someone in that field would post and who would sign it. */
export const SAMPLES = [
  { id: "robot", field: "Robotics", name: "Line-following robot", milestone: "Beat the course in 41.2 seconds", by: "Rocketry Club" },
  { id: "rocket", field: "Aerospace", name: "Certification rocket", milestone: "Flew to 1,140 m and was recovered intact", by: "Rocketry Club" },
  { id: "gearbox", field: "Mechanical", name: "Reduction gearbox", milestone: "Ran two hours under load without slipping", by: "Formula Racing Team" },
  { id: "board", field: "Electronics", name: "Battery management board", milestone: "Passed bring-up with every cell balanced", by: "Solar Car Team" },
  { id: "bridge", field: "Civil", name: "Balsa truss bridge", milestone: "Held 48 kg while weighing 62 g", by: "Civil Engineering Society" },
  { id: "helix", field: "Biology", name: "DNA double helix model", milestone: "Printed and used in the BIO 101 lab", by: "Dr. Lee, Biology" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];
/** The format a sample's numbers are in, for the size readout (lib/model-view.ts, sizeLabel). */
export const SAMPLE_EXT = "glb";

export function buildSample(THREE: Three, id: SampleId): THREE_NS.Object3D {
  const k = kit(THREE, SAMPLES.find((s) => s.id === id)?.name ?? "Example");
  ({ robot, rocket, gearbox, board, bridge, helix })[id](THREE, k);
  return k.root;
}

// The few shapes every model is made of.
function kit(THREE: Three, name: string) {
  const root = new THREE.Group();
  root.name = name;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const mesh = (g: Group, geo: THREE_NS.BufferGeometry, m: Mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const between = (g: Group, geo: THREE_NS.BufferGeometry, axis: THREE_NS.Vector3, a: V3, b: V3, m: Mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), o = new THREE.Mesh(geo, m);
    o.position.copy(A).add(B).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(axis, B.clone().sub(A).normalize());
    g.add(o);
    return o;
  };
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return {
    root,
    part: (n: string) => { const g = new THREE.Group(); g.name = n; root.add(g); return g; },
    mat: (color: number, roughness: number, metalness = 0, extra: THREE_NS.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }),
    add: mesh,
    box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
    cyl: (r: number, h: number, seg = 40, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg),
    /** A square bar from a to b. */
    beam: (g: Group, a: V3, b: V3, t: number, m: Mat) => between(g, new THREE.BoxGeometry(dist(a, b), t, t), X, a, b, m),
    /** A round rod from a to b. */
    rod: (g: Group, a: V3, b: V3, r: number, m: Mat, seg = 16) => between(g, new THREE.CylinderGeometry(r, r, dist(a, b), seg), Y, a, b, m),
  };
}
type Kit = ReturnType<typeof kit>;

// Robotics: a line-following robot. x is across, z is front (+) to back (−).
function robot(THREE: Three, { part, add, box, cyl, mat }: Kit) {
  const M = {
    acrylic: mat(0x2b2f37, 0.16, 0.1), rubber: mat(0x0e0e10, 0.92), hub: mat(0xf2c21a, 0.45), motor: mat(0xe7b416, 0.5), steel: mat(0xc9ced6, 0.25, 1),
    brass: mat(0xc0994f, 0.3, 1), board: mat(0x0d6b57, 0.5, 0.1), sensorBoard: mat(0x1b3a8f, 0.5, 0.1), chip: mat(0x15161a, 0.55), gold: mat(0xd9b24c, 0.3, 1),
    holder: mat(0x24262c, 0.7), cell: mat(0x2f8f4e, 0.4, 0.3), led: mat(0xff4433, 0.4, 0, { emissive: 0xff2a1a, emissiveIntensity: 2.2 }),
  };
  // Chassis: a smoked acrylic plate, rounded, narrowing to the nose where the sensors sit.
  const plate = new THREE.Shape();
  const W = 0.055, B = -0.07, F = 0.085, N = 0.03, r = 0.012;
  plate.moveTo(-W + r, B); plate.lineTo(W - r, B); plate.quadraticCurveTo(W, B, W, B + r);
  plate.lineTo(W, 0.03); plate.lineTo(N, F - r); plate.quadraticCurveTo(N, F, N - r, F);
  plate.lineTo(-N + r, F); plate.quadraticCurveTo(-N, F, -N, F - r); plate.lineTo(-W, 0.03);
  plate.lineTo(-W, B + r); plate.quadraticCurveTo(-W, B, -W + r, B);
  const plateGeo = new THREE.ExtrudeGeometry(plate, { depth: 0.004, bevelEnabled: true, bevelSize: 0.0008, bevelThickness: 0.0008, bevelSegments: 2, curveSegments: 10 });
  plateGeo.rotateX(Math.PI / 2); // drawn flat; lay it down (its y becomes z)
  add(part("Chassis"), plateGeo, M.acrylic, 0, 0.036, 0);

  // Two drive wheels on gear motors, slung under the plate at the back.
  for (const side of [-1, 1]) {
    const wheel = part(side < 0 ? "Left wheel" : "Right wheel");
    add(wheel, new THREE.TorusGeometry(0.0265, 0.008, 20, 64), M.rubber, side * 0.071, 0.0345, -0.03).rotation.y = Math.PI / 2;
    add(wheel, cyl(0.0195, 0.012), M.hub, side * 0.071, 0.0345, -0.03).rotation.z = Math.PI / 2;
    add(wheel, cyl(0.006, 0.018), M.steel, side * 0.071, 0.0345, -0.03).rotation.z = Math.PI / 2;
    const motor = part(side < 0 ? "Left motor" : "Right motor");
    add(motor, box(0.036, 0.019, 0.022), M.motor, side * 0.04, 0.0225, -0.03);
    add(motor, cyl(0.0095, 0.026, 28), M.steel, side * 0.04, 0.0225, -0.0535).rotation.x = Math.PI / 2;
  }
  // A ball caster under the nose.
  const caster = part("Caster");
  add(caster, cyl(0.0075, 0.017, 28), M.steel, 0, 0.0235, 0.058);
  add(caster, new THREE.SphereGeometry(0.0075, 28, 20), M.steel, 0, 0.0075, 0.058);
  // The controller board, on four brass standoffs.
  const ctrl = part("Controller board");
  for (const [x, z] of [[-0.03, -0.045], [0.03, -0.045], [-0.03, 0.012], [0.03, 0.012]]) add(ctrl, cyl(0.0024, 0.014, 6), M.brass, x, 0.043, z);
  add(ctrl, box(0.068, 0.0016, 0.066), M.board, 0, 0.0508, -0.0165);
  add(ctrl, box(0.011, 0.0022, 0.011), M.chip, 0.004, 0.0527, -0.012);
  add(ctrl, box(0.007, 0.0016, 0.005), M.chip, -0.018, 0.0524, 0.004);
  add(ctrl, box(0.012, 0.0055, 0.014), M.steel, -0.02, 0.0543, -0.042);
  add(ctrl, box(0.05, 0.008, 0.0026), M.chip, 0.004, 0.0556, 0.0135);
  add(ctrl, box(0.0026, 0.008, 0.04), M.chip, 0.031, 0.0556, -0.02);
  add(ctrl, cyl(0.0032, 0.007, 20), M.steel, 0.02, 0.0551, -0.04);
  // The battery holder, with two cells, at the back.
  const battery = part("Battery");
  add(battery, box(0.062, 0.006, 0.034), M.holder, 0, 0.0745, -0.03);
  for (const z of [-0.0385, -0.0215]) add(battery, cyl(0.007, 0.05, 28), M.cell, 0, 0.0845, z).rotation.z = Math.PI / 2;
  for (const x of [-0.027, 0.027]) add(battery, box(0.003, 0.016, 0.034), M.holder, x, 0.0825, -0.03);
  for (const [x, z] of [[-0.024, -0.043], [0.024, -0.043], [-0.024, -0.017], [0.024, -0.017]]) add(battery, cyl(0.002, 0.021, 6), M.brass, x, 0.0612, z);
  // The sensor bar: five infrared sensors looking down at the line, under the nose.
  const bar = part("Sensor bar");
  add(bar, box(0.074, 0.0016, 0.013), M.sensorBoard, 0, 0.0185, 0.073);
  for (let i = 0; i < 5; i++) {
    add(bar, box(0.0055, 0.0045, 0.0075), M.chip, (i - 2) * 0.0155, 0.0155, 0.073);
    add(bar, new THREE.SphereGeometry(0.0011, 10, 8), M.led, (i - 2) * 0.0155, 0.0198, 0.0775);
  }
  for (const x of [-0.03, 0.03]) add(bar, cyl(0.002, 0.0165, 6), M.brass, x, 0.0275, 0.071);
  add(bar, box(0.016, 0.0006, 0.0006), M.gold, 0, 0.0195, 0.069);
}

// Aerospace: a mid-power rocket, standing on its fins.
function rocket(THREE: Three, { part, add, cyl, mat }: Kit) {
  const white = mat(0xf1f2f4, 0.42), red = mat(0xd3372c, 0.36), black = mat(0x1a1b1f, 0.5), metal = mat(0x8d939c, 0.35, 1);
  const R = 0.027;
  const body = part("Body tube");
  add(body, cyl(R, 0.65, 48), white, 0, 0.375, 0);
  add(body, cyl(R + 0.0006, 0.014, 48), black, 0, 0.5, 0);
  add(body, cyl(R + 0.0006, 0.05, 48), red, 0, 0.6, 0);
  for (const y of [0.16, 0.44]) add(body, cyl(0.0045, 0.032, 16), white, R + 0.004, y, 0);
  // The nose cone: a curve spun around the axis.
  const profile = Array.from({ length: 21 }, (_, i) => new THREE.Vector2(R * Math.pow(1 - (i / 20) ** 2, 0.62), (i / 20) * 0.2));
  add(part("Nose cone"), new THREE.LatheGeometry(profile, 48), red, 0, 0.7, 0);
  // Three swept fins.
  const fin = new THREE.Shape();
  fin.moveTo(0, 0.14); fin.lineTo(0, 0); fin.lineTo(0.078, -0.045); fin.lineTo(0.078, 0.02); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.003, bevelEnabled: false });
  finGeo.translate(R - 0.001, 0, -0.0015);
  const fins = part("Fins");
  for (let i = 0; i < 3; i++) add(fins, finGeo, red, 0, 0.055, 0).rotation.y = (i / 3) * Math.PI * 2 + 0.3;
  const motor = part("Motor");
  add(motor, cyl(0.02, 0.05, 32), metal, 0, 0.045, 0);
  add(motor, cyl(0.017, 0.022, 32, 0.011), black, 0, 0.011, 0);
}

// Mechanical: a 3:1 gear pair on two shafts, between two plates.
function gearbox(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const plateM = mat(0xaeb4be, 0.38, 0.85), base = mat(0x3a3f47, 0.45, 0.6), steel = mat(0xc9ced6, 0.28, 1), bronze = mat(0xb8864b, 0.36, 1), brass = mat(0xc0994f, 0.3, 1), dark = mat(0x1d1f24, 0.5, 0.4);
  // A gear's outline: each tooth rises from the root circle to the tip circle and back.
  const outline = (teeth: number, root: number, tip: number, turn: number, holes: [number, number, number][]) => {
    const s = new THREE.Shape();
    for (let t = 0; t < teeth; t++) for (const [f, r] of [[0, root], [0.2, tip], [0.5, tip], [0.7, root]] as const) {
      const a = ((t + f) / teeth) * Math.PI * 2 + turn, x = r * Math.cos(a), y = r * Math.sin(a);
      if (t === 0 && f === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    s.closePath();
    for (const [hx, hy, hr] of holes) { const h = new THREE.Path(); h.absarc(hx, hy, hr, 0, Math.PI * 2, true); s.holes.push(h); }
    return s;
  };
  const gearGeo = (s: THREE_NS.Shape, w: number) => { const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: true, bevelSize: 0.0005, bevelThickness: 0.0005, bevelSegments: 1, curveSegments: 24 }); g.translate(0, 0, -w / 2); return g; };
  const Y0 = 0.058, XP = -0.036, XG = 0.02; // shaft height; pinion and gear centres (56 mm apart)
  // The pinion's tooth points at the gear; the gear is turned so a gap meets it.
  add(part("Pinion"), gearGeo(outline(12, 0.0113, 0.0166, (-0.35 / 12) * Math.PI * 2, [[0, 0, 0.004]]), 0.012), steel, XP, Y0, 0);
  const lightening = Array.from({ length: 6 }, (_, i): [number, number, number] => [0.024 * Math.cos((i / 6) * Math.PI * 2), 0.024 * Math.sin((i / 6) * Math.PI * 2), 0.0065]);
  add(part("Gear"), gearGeo(outline(36, 0.0393, 0.0446, Math.PI - (17.85 / 36) * Math.PI * 2, [[0, 0, 0.005], ...lightening]), 0.01), bronze, XG, Y0, 0);
  const input = part("Input shaft"), output = part("Output shaft");
  rod(input, [XP, Y0, -0.062], [XP, Y0, 0.04], 0.004, steel, 24);
  add(input, cyl(0.008, 0.018, 24), dark, XP, Y0, -0.056).rotation.x = Math.PI / 2;
  rod(output, [XG, Y0, -0.04], [XG, Y0, 0.066], 0.005, steel, 24);
  for (const z of [-0.031, 0.031]) {
    add(input, cyl(0.009, 0.007, 28), steel, XP, Y0, z).rotation.x = Math.PI / 2;
    add(output, cyl(0.011, 0.007, 28), steel, XG, Y0, z).rotation.x = Math.PI / 2;
  }
  const housing = part("Housing");
  add(housing, box(0.15, 0.008, 0.086), base, -0.004, 0.004, 0);
  // The back plate is aluminium; the front one is clear, so the gears show.
  add(housing, box(0.14, 0.104, 0.005), plateM, -0.004, 0.06, -0.031);
  add(housing, box(0.14, 0.104, 0.005), mat(0xd6ecf7, 0.08, 0, { transparent: true, opacity: 0.26 }), -0.004, 0.06, 0.031);
  for (const [x, y] of [[-0.068, 0.018], [0.06, 0.018], [-0.068, 0.104], [0.06, 0.104]]) rod(housing, [x, y, -0.031], [x, y, 0.031], 0.003, brass, 12);
}

// Electronics: a battery management board.
function board(THREE: Three, { part, add, box, cyl, mat }: Kit) {
  const pcb = mat(0x0c5c4c, 0.5, 0.1), chip = mat(0x15161a, 0.55), steel = mat(0xc9ced6, 0.28, 1), gold = mat(0xd9b24c, 0.3, 1), cap = mat(0x1f2a44, 0.4, 0.2),
    cream = mat(0xe9e6dc, 0.6), term = mat(0x2e8b57, 0.55), copper = mat(0xb5683a, 0.35, 1);
  const led = (c: number) => mat(c, 0.4, 0, { emissive: c, emissiveIntensity: 1.8 });
  const T = 0.0016; // the board's top surface
  const b = part("Board");
  add(b, box(0.09, T, 0.055), pcb, 0, T / 2, 0);
  for (const [x, z] of [[-0.041, -0.0235], [0.041, -0.0235], [-0.041, 0.0235], [0.041, 0.0235]]) add(b, new THREE.TorusGeometry(0.0022, 0.0006, 8, 24), gold, x, T, z).rotation.x = Math.PI / 2;
  // Copper pours to the power terminals.
  add(b, box(0.03, 0.0002, 0.012), copper, 0.026, T + 0.0001, 0.016);
  const ctrl = part("Controller");
  add(ctrl, box(0.012, 0.0018, 0.012), chip, -0.014, T + 0.0009, -0.002);
  for (const x of [-0.034, -0.03]) add(ctrl, box(0.0026, 0.0012, 0.006), chip, x, T + 0.0006, 0.012);
  add(ctrl, box(0.007, 0.0015, 0.005), chip, -0.03, T + 0.00075, -0.012);
  add(ctrl, box(0.005, 0.0012, 0.0032), steel, -0.002, T + 0.0006, -0.016);
  const power = part("Power stage");
  for (let i = 0; i < 4; i++) {
    add(power, box(0.0065, 0.0023, 0.009), chip, 0.012 + i * 0.009, T + 0.00115, -0.006);
    add(power, box(0.0065, 0.0005, 0.004), steel, 0.012 + i * 0.009, T + 0.00025, -0.0135);
  }
  add(power, box(0.012, 0.0012, 0.006), steel, 0.024, T + 0.0006, 0.008);
  for (const x of [0.0172, 0.0308]) add(power, box(0.0016, 0.0014, 0.0062), gold, x, T + 0.0007, 0.008);
  for (const x of [-0.002, 0.008]) { add(power, cyl(0.004, 0.009, 28), cap, x, T + 0.0045, 0.014); add(power, cyl(0.0034, 0.0003, 28), steel, x, T + 0.00915, 0.014); }
  const conn = part("Connectors");
  add(conn, box(0.034, 0.006, 0.006), cream, -0.022, T + 0.003, -0.0235);
  for (let i = 0; i < 7; i++) add(conn, box(0.0007, 0.004, 0.0007), gold, -0.0355 + i * 0.0045, T + 0.004, -0.0235);
  for (const x of [0.028, 0.039]) { add(conn, box(0.0095, 0.0095, 0.0085), term, x, T + 0.00475, 0.0215); add(conn, cyl(0.0026, 0.0006, 16), steel, x, T + 0.0098, 0.0215); }
  add(conn, box(0.013, 0.0025, 0.0052), chip, -0.03, T + 0.00125, 0.0225);
  for (let i = 0; i < 5; i++) for (const z of [0.0212, 0.0238]) add(conn, box(0.0006, 0.0085, 0.0006), gold, -0.035 + i * 0.0025, T + 0.00425, z);
  const lights = part("Indicators");
  [0x35d07f, 0x35d07f, 0xffb020].forEach((c, i) => add(lights, box(0.0016, 0.0008, 0.0009), led(c), 0.004 + i * 0.004, T + 0.0004, -0.022));
}

// Civil: a balsa Warren truss with a test load at mid-span.
function bridge(THREE: Three, { part, add, box, cyl, beam, mat }: Kit) {
  const balsa = mat(0xdcbf8f, 0.82), deckM = mat(0xead7b0, 0.85), grey = mat(0x6c727c, 0.6, 0.3), iron = mat(0x2b2e34, 0.5, 0.8), steel = mat(0xc9ced6, 0.3, 1);
  const L = 0.6, H = 0.1, W = 0.08, P = 0.1, t = 0.006;
  const low = (i: number, z: number): V3 => [-L / 2 + i * P, 0, z], high = (i: number, z: number): V3 => [-L / 2 + P / 2 + i * P, H, z];
  for (const [name, z] of [["Left truss", -W / 2], ["Right truss", W / 2]] as const) {
    const g = part(name);
    beam(g, low(0, z), low(6, z), t, balsa);
    beam(g, high(0, z), high(5, z), t, balsa);
    for (let i = 0; i < 6; i++) { beam(g, low(i, z), high(i, z), t * 0.8, balsa); beam(g, high(i, z), low(i + 1, z), t * 0.8, balsa); }
  }
  const deck = part("Deck");
  for (let i = 0; i <= 6; i++) beam(deck, low(i, -W / 2), low(i, W / 2), t * 0.8, balsa);
  add(deck, box(L, 0.0018, W - 0.012), deckM, 0, 0.0045, 0);
  const top = part("Top bracing");
  for (let i = 0; i < 6; i++) beam(top, high(i, -W / 2), high(i, W / 2), t * 0.7, balsa);
  for (let i = 0; i < 5; i++) beam(top, high(i, i % 2 ? W / 2 : -W / 2), high(i + 1, i % 2 ? -W / 2 : W / 2), t * 0.55, balsa);
  const sup = part("Supports");
  // Two piers, tall enough for the load to hang between them.
  for (const x of [-L / 2 + 0.01, L / 2 - 0.01]) add(sup, box(0.03, 0.09, W + 0.03), grey, x, -0.048, 0);
  // The test load: weights hung from a bar across the deck.
  const load = part("Test load");
  add(load, box(0.012, 0.008, W + 0.02), steel, 0, 0.0095, 0);
  add(load, cyl(0.0016, 0.05, 12), steel, 0, -0.02, 0);
  for (let i = 0; i < 3; i++) add(load, cyl(0.03, 0.011, 40), iron, 0, -0.05 - i * 0.012, 0);
}

// Biology: a double helix on a stand, the kind a lab prints to teach base pairing.
function helix(THREE: Three, { part, add, cyl, rod, mat }: Kit) {
  const blue = mat(0x2f6fde, 0.4), orange = mat(0xe8833a, 0.4), stand = mat(0x2a2d34, 0.55, 0.2);
  const pairs = [[mat(0x34a36b, 0.45), mat(0xd94f4f, 0.45)], [mat(0xe2b93b, 0.45), mat(0x7a5cd6, 0.45)]];
  const R = 0.03, Y0 = 0.016, Y1 = 0.2, TURNS = 1.7;
  const at = (t: number, phase: number): V3 => [R * Math.cos(t * TURNS * Math.PI * 2 + phase), Y0 + t * (Y1 - Y0), R * Math.sin(t * TURNS * Math.PI * 2 + phase)];
  const strands = [part("Strand A"), part("Strand B")];
  [0, Math.PI].forEach((phase, k) => {
    const curve = new THREE.CatmullRomCurve3(Array.from({ length: 61 }, (_, i) => new THREE.Vector3(...at(i / 60, phase))));
    add(strands[k], new THREE.TubeGeometry(curve, 180, 0.0034, 12), k ? orange : blue);
  });
  const rungs = part("Base pairs");
  for (let i = 0; i < 17; i++) {
    const t = (i + 0.5) / 17, a = at(t, 0), b = at(t, Math.PI), mid: V3 = [0, a[1], 0], [m1, m2] = pairs[i % 2];
    rod(rungs, a, mid, 0.0022, i % 4 < 2 ? m1 : m2);
    rod(rungs, mid, b, 0.0022, i % 4 < 2 ? m2 : m1);
    add(strands[0], new THREE.SphereGeometry(0.0052, 16, 12), blue, ...a);
    add(strands[1], new THREE.SphereGeometry(0.0052, 16, 12), orange, ...b);
  }
  const base = part("Stand");
  add(base, cyl(0.046, 0.008, 56), stand, 0, 0.004, 0);
  add(base, cyl(0.004, 0.012, 16), stand, 0, 0.012, 0);
}
