import type * as THREE_NS from "three";

// Example models, built in code (no file to download): what the landing page shows in the 3D viewer,
// one for every field the app offers (lib/forge.ts, TOPICS), engineering split into its trades. Each is in metres, like a glTF, so the viewer's size readout is right, and
// each top-level group is one part, which is what "Explode" pulls apart.
// Example objects with made-up results, not anyone's real design; the page says so.

type Three = typeof THREE_NS;
type V3 = [number, number, number];
type Group = THREE_NS.Group;
type Mat = THREE_NS.Material;

/** The examples, in the order the landing page offers them: the field, the build, and the kind of
 *  milestone someone in that field would post and who would sign it. */
export const SAMPLES = [
  // Engineering
  { id: "robot", field: "Robotics", name: "Line-following robot", milestone: "Beat the course in 41.2 seconds", by: "Rocketry Club" },
  { id: "rocket", field: "Aerospace", name: "Certification rocket", milestone: "Flew to 1,140 m and was recovered intact", by: "Rocketry Club" },
  { id: "gearbox", field: "Mechanical", name: "Reduction gearbox", milestone: "Ran two hours under load without slipping", by: "Formula Racing Team" },
  { id: "board", field: "Electronics", name: "Battery management board", milestone: "Passed bring-up with every cell balanced", by: "Solar Car Team" },
  { id: "bridge", field: "Civil", name: "Balsa truss bridge", milestone: "Held 48 kg while weighing 62 g", by: "Civil Engineering Society" },
  // Computing
  { id: "phone", field: "Software", name: "Campus shuttle tracker app", milestone: "Shipped to 2,100 weekly riders", by: "Software Engineering Club" },
  { id: "cluster", field: "Computer science", name: "Four-node compute cluster", milestone: "Sorted 10 GB across four nodes in 94 seconds", by: "Computing Society" },
  { id: "network", field: "Data & AI", name: "Crop disease classifier", milestone: "Reached 94% accuracy on the field-trial photos", by: "AI Society" },
  // Sciences
  { id: "knot", field: "Mathematics", name: "Trefoil knot model", milestone: "Presented at the undergraduate math seminar", by: "Math Society" },
  { id: "pendulum", field: "Physics", name: "Double pendulum rig", milestone: "Tracked 200 runs and measured where chaos sets in", by: "Physics Society" },
  { id: "crystal", field: "Chemistry", name: "Salt crystal lattice model", milestone: "Grew a 14 mm single crystal over three weeks", by: "Chemistry Club" },
  { id: "helix", field: "Biology", name: "DNA double helix model", milestone: "Printed and used in the BIO 101 lab", by: "Dr. Lee, Biology" },
  { id: "weather", field: "Environment", name: "Campus weather station", milestone: "Logged 90 days of readings without a gap", by: "Environmental Science Club" },
  { id: "cubesat", field: "Space", name: "CubeSat structure", milestone: "Passed the vibration test at launch levels", by: "Space Systems Lab" },
  { id: "hand", field: "Medicine", name: "3D-printed prosthetic hand", milestone: "Gripped and lifted a 500 g bottle in testing", by: "Biomedical Engineering Society" },
  // Business, arts and society
  { id: "cart", field: "Business", name: "Campus coffee cart", milestone: "Sold 1,200 cups in its first month", by: "Entrepreneurship Club" },
  { id: "chair", field: "Design", name: "Flat-pack plywood chair", milestone: "Held 120 kg in the load test", by: "Industrial Design Studio" },
  { id: "camera", field: "Media", name: "Documentary short", milestone: "Screened to 300 people at the fall showcase", by: "Film Club" },
  { id: "chart", field: "Social science", name: "Campus rent survey", milestone: "412 responses, published and cited by the student senate", by: "Economics Society" },
  { id: "blocks", field: "Education", name: "Tactile fraction kit", milestone: "Used in three fourth-grade classes this term", by: "Education Society" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];
/** The format a sample's numbers are in, for the size readout (lib/model-view.ts, sizeLabel). */
export const SAMPLE_EXT = "glb";

export function buildSample(THREE: Three, id: SampleId): THREE_NS.Object3D {
  const k = kit(THREE, SAMPLES.find((s) => s.id === id)?.name ?? "Example");
  ({ robot, rocket, gearbox, board, bridge, phone, cluster, network, knot, pendulum, crystal, helix, weather, cubesat, hand, cart, chair, camera, chart, blocks })[id](THREE, k);
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

// Software: the app itself, running on a phone in a stand. The screen is built from raised blocks,
// so it reads in blueprint and comes apart from the phone when exploded.
function phone(THREE: Three, { root, mat, box, cyl }: Kit) {
  const body = mat(0x1c1d21, 0.35, 0.6), glass = mat(0xf6f6f3, 0.25, 0, { emissive: 0xf6f6f3, emissiveIntensity: 0.25 }), ink = mat(0x1f1f1d, 0.5),
    map = mat(0xdcebdf, 0.6, 0, { emissive: 0xdcebdf, emissiveIntensity: 0.2 }), road = mat(0xffffff, 0.6), route = mat(0x2f6fde, 0.4, 0, { emissive: 0x2f6fde, emissiveIntensity: 0.6 }),
    stop = mat(0xe5484d, 0.4, 0, { emissive: 0xe5484d, emissiveIntensity: 0.5 }), card = mat(0xffffff, 0.5, 0, { emissive: 0xffffff, emissiveIntensity: 0.2 }), line = mat(0xb9bbb6, 0.6), ok = mat(0x15803d, 0.5), standM = mat(0xc9ced6, 0.3, 1);
  // Everything is laid out flat (the screen faces +z), then leaned back in its stand.
  const lean = new THREE.Group();
  lean.rotation.x = -0.3; lean.position.set(0, 0.012, 0);
  root.add(lean);
  const part = (n: string) => { const g = new THREE.Group(); g.name = n; lean.add(g); return g; };
  const at = (g: Group, geo: THREE_NS.BufferGeometry, m: Mat, x: number, y: number, z: number) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const W = 0.072, H = 0.152, r = 0.011;
  const outline = new THREE.Shape();
  outline.moveTo(-W / 2 + r, 0); outline.lineTo(W / 2 - r, 0); outline.quadraticCurveTo(W / 2, 0, W / 2, r); outline.lineTo(W / 2, H - r); outline.quadraticCurveTo(W / 2, H, W / 2 - r, H);
  outline.lineTo(-W / 2 + r, H); outline.quadraticCurveTo(-W / 2, H, -W / 2, H - r); outline.lineTo(-W / 2, r); outline.quadraticCurveTo(-W / 2, 0, -W / 2 + r, 0);
  const device = part("Phone");
  at(device, new THREE.ExtrudeGeometry(outline, { depth: 0.008, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0006, bevelSegments: 2, curveSegments: 10 }), body, 0, 0, -0.008);
  at(device, box(0.0015, 0.014, 0.003), standM, W / 2 + 0.0004, 0.1, -0.004);
  const ui = part("Screen");
  const Z = 0.0008;
  at(ui, box(W - 0.006, H - 0.006, 0.0006), glass, 0, H / 2, Z);
  at(ui, box(W - 0.006, 0.016, 0.0006), ink, 0, H - 0.011, Z + 0.0006);                    // the header
  at(ui, box(0.02, 0.0028, 0.0004), card, -0.018, H - 0.011, Z + 0.0011);
  at(ui, box(W - 0.012, 0.062, 0.0006), map, 0, H - 0.054, Z + 0.0006);                    // the map
  at(ui, box(W - 0.014, 0.004, 0.0004), road, 0, H - 0.046, Z + 0.0011);
  at(ui, box(0.004, 0.06, 0.0004), road, 0.012, H - 0.054, Z + 0.0011);
  at(ui, box(0.036, 0.0022, 0.0005), route, -0.008, H - 0.046, Z + 0.0015);                // the shuttle's route
  at(ui, box(0.0022, 0.03, 0.0005), route, 0.012, H - 0.062, Z + 0.0015);
  for (const [x, y] of [[-0.025, H - 0.046], [0.012, H - 0.046], [0.012, H - 0.076]]) at(ui, cyl(0.0024, 0.0006, 20), stop, x, y, Z + 0.0019).rotation.x = Math.PI / 2;
  for (let i = 0; i < 3; i++) {                                                              // arrival times
    const y = H - 0.098 - i * 0.016;
    at(ui, box(W - 0.012, 0.013, 0.0006), card, 0, y, Z + 0.0006);
    at(ui, box(0.026, 0.0022, 0.0004), ink, -0.016, y + 0.002, Z + 0.0011);
    at(ui, box(0.018, 0.0016, 0.0004), line, -0.02, y - 0.0025, Z + 0.0011);
    at(ui, box(0.01, 0.006, 0.0004), i === 0 ? ok : line, 0.022, y, Z + 0.0011);
  }
  const stand = part("Stand");
  at(stand, box(0.086, 0.004, 0.012), standM, 0, -0.004, 0.002);
  at(stand, box(0.086, 0.012, 0.003), standM, 0, 0.002, 0.008);
  at(stand, box(0.06, 0.07, 0.004), standM, 0, 0.03, -0.012);
  const foot = new THREE.Mesh(box(0.09, 0.005, 0.085), standM);                              // the foot stays level on the desk
  foot.position.set(0, 0.0025, -0.012);
  const base = new THREE.Group(); base.name = "Base"; base.add(foot); root.add(base);
}

// Computer science: four single-board computers stacked in a frame, with a fan and a network switch.
function cluster(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const pcb = mat(0x157a4a, 0.5, 0.1), chip = mat(0x15161a, 0.5), steel = mat(0xc9ced6, 0.28, 1), brass = mat(0xc0994f, 0.3, 1), clear = mat(0xd6ecf7, 0.08, 0, { transparent: true, opacity: 0.3 }),
    dark = mat(0x22252b, 0.5, 0.3), cable = mat(0x2f6fde, 0.6), led = mat(0x35d07f, 0.4, 0, { emissive: 0x35d07f, emissiveIntensity: 1.8 });
  const GAP = 0.026, Y0 = 0.012;
  for (let n = 0; n < 4; n++) {
    const y = Y0 + n * GAP, node = part(`Node ${n + 1}`);
    add(node, box(0.085, 0.0015, 0.056), pcb, 0, y, 0);
    add(node, box(0.014, 0.002, 0.014), steel, -0.012, y + 0.0018, 0.002);
    add(node, box(0.008, 0.0015, 0.012), chip, 0.01, y + 0.0015, -0.008);
    add(node, box(0.05, 0.008, 0.005), chip, -0.012, y + 0.0048, -0.0245);
    for (const z of [-0.012, 0.006]) add(node, box(0.017, 0.014, 0.013), steel, 0.034, y + 0.0078, z);
    add(node, box(0.021, 0.0135, 0.016), steel, 0.032, y + 0.0075, 0.0205);
    add(node, box(0.0016, 0.0008, 0.0012), led, -0.038, y + 0.0012, 0.024);
  }
  const frame = part("Frame");
  for (const [x, z] of [[-0.039, -0.0245], [0.039, -0.0245], [-0.039, 0.0245], [0.039, 0.0245]]) rod(frame, [x, 0.003, z], [x, Y0 + 3 * GAP + 0.024, z], 0.0026, brass, 6);
  add(frame, box(0.092, 0.003, 0.062), clear, 0, 0.0015, 0);
  add(frame, box(0.092, 0.003, 0.062), clear, 0, Y0 + 3 * GAP + 0.0255, 0);
  const fan = part("Fan");
  add(fan, box(0.04, 0.01, 0.04), dark, -0.012, Y0 + 3 * GAP + 0.032, 0);
  add(fan, cyl(0.0175, 0.0104, 36), chip, -0.012, Y0 + 3 * GAP + 0.032, 0);
  add(fan, cyl(0.006, 0.011, 20), steel, -0.012, Y0 + 3 * GAP + 0.032, 0);
  const sw = part("Network switch");
  add(sw, box(0.1, 0.026, 0.06), dark, 0.115, 0.013, 0);
  for (let i = 0; i < 5; i++) { add(sw, box(0.004, 0.011, 0.009), chip, 0.0645, 0.013, -0.02 + i * 0.01); add(sw, box(0.0012, 0.0012, 0.002), led, 0.0648, 0.022, -0.02 + i * 0.01); }
  const cables = part("Cables");
  for (let n = 0; n < 4; n++) rod(cables, [0.043, Y0 + n * GAP + 0.0075, 0.0205], [0.064, 0.013, -0.02 + n * 0.01], 0.0014, cable, 8);
}

// Data and AI: a small neural network, its layers as rows of nodes joined by their weights.
function network(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const glow = (c: number) => mat(c, 0.35, 0, { emissive: c, emissiveIntensity: 0.35 });
  const layerM = [glow(0x35b46f), glow(0x2f6fde), glow(0x2f6fde), glow(0xe8833a)], pos = mat(0x8aa9e6, 0.6), neg = mat(0xe6b08a, 0.6), base = mat(0x24262c, 0.55, 0.2), post = mat(0xc9ced6, 0.3, 1);
  const sizes = [4, 6, 6, 3], X = [-0.063, -0.021, 0.021, 0.063], Y = 0.085;
  const at = (l: number, i: number): V3 => [X[l], Y + (i - (sizes[l] - 1) / 2) * 0.021, 0];
  const names = ["Input layer", "Hidden layer 1", "Hidden layer 2", "Output layer"];
  sizes.forEach((n, l) => { const g = part(names[l]); for (let i = 0; i < n; i++) add(g, new THREE.SphereGeometry(0.0062, 20, 14), layerM[l], ...at(l, i)); });
  const links = part("Weights");
  for (let l = 0; l < 3; l++) for (let i = 0; i < sizes[l]; i++) for (let j = 0; j < sizes[l + 1]; j++) rod(links, at(l, i), at(l + 1, j), 0.0006 + ((i * 7 + j * 3 + l) % 3) * 0.00035, (i + j + l) % 3 ? pos : neg, 6);
  const stand = part("Stand");
  add(stand, box(0.17, 0.006, 0.05), base, 0, 0.003, 0);
  for (const x of X) add(stand, cyl(0.0016, 0.022, 10), post, x, 0.017, 0);
}

// Mathematics: a trefoil, the simplest knot that can't be untied, on a stand.
function knot(THREE: Three, { part, add, cyl, mat }: Kit) {
  add(part("Knot"), new THREE.TorusKnotGeometry(0.04, 0.0105, 220, 24, 2, 3), mat(0x7a5cd6, 0.25, 0.15), 0, 0.105, 0);
  const stand = part("Stand");
  add(stand, cyl(0.045, 0.008, 56), mat(0x2a2d34, 0.55, 0.2), 0, 0.004, 0);
  add(stand, cyl(0.003, 0.05, 16), mat(0xc9ced6, 0.3, 1), 0, 0.033, 0);
}

// Physics: a double pendulum on a frame, with an encoder on the pivot.
function pendulum(THREE: Three, { part, add, box, cyl, beam, mat }: Kit) {
  const alu = mat(0xb9bec7, 0.4, 0.85), dark = mat(0x2a2d34, 0.55, 0.3), steel = mat(0xc9ced6, 0.28, 1), brass = mat(0xc0994f, 0.3, 1), red = mat(0xd3372c, 0.4);
  const frame = part("Frame");
  add(frame, box(0.26, 0.012, 0.14), dark, 0, 0.006, 0);
  for (const x of [-0.11, 0.11]) beam(frame, [x, 0.012, 0], [x, 0.36, 0], 0.014, alu);
  beam(frame, [-0.117, 0.367, 0], [0.117, 0.367, 0], 0.014, alu);
  for (const x of [-0.11, 0.11]) beam(frame, [x, 0.012, -0.06], [x, 0.15, 0], 0.009, alu);
  // The arms hang from the middle of the crossbar, caught mid-swing.
  const P: V3 = [0, 0.355, 0.016], a1 = 0.62, a2 = -0.95;
  const E: V3 = [P[0] + 0.13 * Math.sin(a1), P[1] - 0.13 * Math.cos(a1), P[2]], T: V3 = [E[0] + 0.11 * Math.sin(a2), E[1] - 0.11 * Math.cos(a2), 0.026];
  const upper = part("Upper arm");
  beam(upper, P, E, 0.008, alu).scale.z = 0.4;
  add(upper, cyl(0.007, 0.012, 24), steel, ...P).rotation.x = Math.PI / 2;
  const lower = part("Lower arm");
  beam(lower, [E[0], E[1], 0.026], T, 0.008, red).scale.z = 0.4;
  add(lower, cyl(0.006, 0.02, 24), steel, E[0], E[1], 0.021).rotation.x = Math.PI / 2;
  add(lower, cyl(0.013, 0.01, 32), brass, ...T).rotation.x = Math.PI / 2;
  const sensor = part("Encoder");
  add(sensor, cyl(0.02, 0.003, 40), dark, P[0], P[1], -0.012).rotation.x = Math.PI / 2;
  add(sensor, box(0.024, 0.018, 0.012), dark, P[0], P[1] + 0.018, -0.02);
}

// Chemistry: the lattice of table salt, sodium and chloride ions alternating in a cube.
function crystal(THREE: Three, { part, add, box, rod, mat }: Kit) {
  const na = part("Sodium ions"), cl = part("Chloride ions"), bonds = part("Bonds"), S = 0.03, Y = 0.05;
  const naM = mat(0x8e6fd8, 0.3, 0.1), clM = mat(0x49b36b, 0.3, 0.1), bondM = mat(0xb9bec7, 0.4, 0.6);
  const at = (i: number, j: number, k: number): V3 => [(i - 1) * S, Y + j * S, (k - 1) * S];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) {
    const sodium = (i + j + k) % 2 === 0;
    add(sodium ? na : cl, new THREE.SphereGeometry(sodium ? 0.0072 : 0.0108, 24, 16), sodium ? naM : clM, ...at(i, j, k));
    if (i < 2) rod(bonds, at(i, j, k), at(i + 1, j, k), 0.0016, bondM, 8);
    if (j < 2) rod(bonds, at(i, j, k), at(i, j + 1, k), 0.0016, bondM, 8);
    if (k < 2) rod(bonds, at(i, j, k), at(i, j, k + 1), 0.0016, bondM, 8);
  }
  const stand = part("Stand");
  add(stand, box(0.1, 0.008, 0.1), mat(0x2a2d34, 0.55, 0.2), 0, 0.004, 0);
  for (const [x, z] of [[-S, -S], [S, -S], [-S, S], [S, S]]) rod(stand, [x, 0.008, z], [x, Y - 0.006, z], 0.0016, bondM, 8);
}

// Earth and environment: a weather station on a tripod mast.
function weather(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const alu = mat(0xb9bec7, 0.4, 0.85), white = mat(0xf1f2f4, 0.5), dark = mat(0x22252b, 0.5, 0.3), panel = mat(0x1b2f6b, 0.25, 0.4), red = mat(0xd3372c, 0.4);
  const mast = part("Mast");
  rod(mast, [0, 0.32, 0], [0, 1.9, 0], 0.016, alu, 16);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; rod(mast, [0, 0.62, 0], [0.42 * Math.cos(a), 0, 0.42 * Math.sin(a)], 0.011, alu, 12); }
  rod(mast, [-0.3, 1.86, 0], [0.3, 1.86, 0], 0.01, alu, 12);
  const cups = part("Anemometer");
  rod(cups, [-0.3, 1.86, 0], [-0.3, 1.97, 0], 0.006, dark, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, c: V3 = [-0.3 + 0.075 * Math.cos(a), 1.97, 0.075 * Math.sin(a)];
    rod(cups, [-0.3, 1.97, 0], c, 0.003, alu, 8);
    add(cups, new THREE.SphereGeometry(0.026, 20, 12, 0, Math.PI), dark, ...c).rotation.y = -a;
  }
  const vane = part("Wind vane");
  rod(vane, [0.3, 1.86, 0], [0.3, 1.98, 0], 0.006, dark, 10);
  rod(vane, [0.2, 1.98, 0], [0.4, 1.98, 0], 0.004, alu, 8);
  add(vane, box(0.07, 0.07, 0.003), red, 0.41, 1.98, 0);
  add(vane, cyl(0.001, 0.03, 12, 0.008), red, 0.19, 1.98, 0).rotation.z = Math.PI / 2;
  // The temperature sensor sits inside a stack of white plates that shade it and let air through.
  const shield = part("Sensor shield");
  rod(shield, [0, 1.42, 0], [0.16, 1.42, 0], 0.008, alu, 10);
  for (let i = 0; i < 7; i++) add(shield, cyl(0.055, 0.008, 32, 0.045), white, 0.16, 1.34 + i * 0.022, 0);
  const sun = part("Solar panel");
  const p = add(sun, box(0.32, 0.012, 0.24), panel, -0.02, 1.1, 0.13);
  p.rotation.x = 0.7;
  rod(sun, [0, 1.06, 0], [-0.02, 1.08, 0.1], 0.006, alu, 8);
  const logger = part("Logger box");
  add(logger, box(0.2, 0.26, 0.11), white, 0, 0.82, -0.075);
  add(logger, box(0.03, 0.012, 0.004), dark, 0.05, 0.86, -0.132);
  const gauge = part("Rain gauge");
  rod(gauge, [0, 1.25, 0], [-0.2, 1.25, 0], 0.008, alu, 10);
  add(gauge, cyl(0.045, 0.16, 32, 0.06), white, -0.2, 1.3, 0);
}

// Space: a one-unit CubeSat. Rails, four solar panels, the board stack inside, and antennas on top.
function cubesat(THREE: Three, { part, add, box, cyl, beam, rod, mat }: Kit) {
  const alu = mat(0xb9bec7, 0.35, 0.9), cell = mat(0x14245a, 0.2, 0.5), silver = mat(0xdfe3ea, 0.25, 1), pcb = mat(0x0d6b57, 0.5, 0.1), chip = mat(0x15161a, 0.5), gold = mat(0xd9b24c, 0.3, 1), glass = mat(0x0b0d12, 0.05, 0.6);
  const A = 0.1, H = 0.1135, h = A / 2;
  const frame = part("Frame");
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) beam(frame, [x, 0, z], [x, H, z], 0.0085, alu);
  for (const y of [0.006, H - 0.006]) for (const [a, b] of [[[-h, -h], [h, -h]], [[h, -h], [h, h]], [[h, h], [-h, h]], [[-h, h], [-h, -h]]]) beam(frame, [a[0], y, a[1]], [b[0], y, b[1]], 0.006, alu);
  // Each side panel: a board carrying two solar cells.
  [["Panel +X", h, 0, 0], ["Panel -X", -h, 0, Math.PI], ["Panel +Z", 0, h, -Math.PI / 2], ["Panel -Z", 0, -h, Math.PI / 2]].forEach(([name, x, z, turn]) => {
    const g = part(name as string);
    g.position.set(x as number, H / 2, z as number);
    g.rotation.y = turn as number;
    const m = (geo: THREE_NS.BufferGeometry, mm: Mat, px: number, py: number, pz: number) => { const o = new THREE.Mesh(geo, mm); o.position.set(px, py, pz); g.add(o); };
    m(box(0.0016, H - 0.02, A - 0.014), pcb, 0.0008, 0, 0);
    for (const y of [-0.023, 0.023]) { m(box(0.0008, 0.04, A - 0.024), cell, 0.002, y, 0); m(box(0.0004, 0.0008, A - 0.024), silver, 0.0026, y, 0); }
  });
  const stack = part("Board stack");
  for (let i = 0; i < 4; i++) { add(stack, box(A - 0.012, 0.0016, A - 0.012), pcb, 0, 0.02 + i * 0.022, 0); add(stack, box(0.016, 0.004, 0.016), chip, 0.012 - i * 0.006, 0.0228 + i * 0.022, 0.006); }
  for (const [x, z] of [[-0.038, -0.038], [0.038, -0.038], [-0.038, 0.038], [0.038, 0.038]]) rod(stack, [x, 0.012, z], [x, 0.098, z], 0.0018, gold, 6);
  const top = part("Antenna deck");
  add(top, box(A - 0.004, 0.0016, A - 0.004), pcb, 0, H + 0.0008, 0);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; rod(top, [0.03 * Math.cos(a), H + 0.002, 0.03 * Math.sin(a)], [0.085 * Math.cos(a), H + 0.04, 0.085 * Math.sin(a)], 0.0014, silver, 6); }
  const cam = part("Camera");
  add(cam, cyl(0.014, 0.012, 32), alu, 0, 0.004, 0);
  add(cam, cyl(0.011, 0.002, 32), glass, 0, -0.0025, 0);
}

// Health and medicine: a 3D-printed prosthetic hand. Each finger is three hinged pieces, slightly curled.
function hand(THREE: Three, { part, add, box, cyl, mat }: Kit) {
  // Printed in a bright colour, as these usually are: the wearer picks it.
  const pla = mat(0x2f86d6, 0.5), joint = mat(0x1c2a44, 0.5), pin = mat(0xc9ced6, 0.3, 1), strap = mat(0x22252b, 0.75), cord = mat(0xf2c21a, 0.6);
  add(part("Palm"), box(0.082, 0.09, 0.026), pla, 0, 0.135, 0);
  const finger = (name: string, x: number, y: number, lens: number[], curl: number, lean = 0) => {
    const g = part(name);
    let at = new THREE.Group();
    at.position.set(x, y, 0); at.rotation.z = lean;
    g.add(at);
    lens.forEach((len, i) => {
      const seg = new THREE.Group();
      seg.rotation.x = curl * (i === 0 ? 0.6 : 1);
      at.add(seg);
      const m = new THREE.Mesh(box(0.0165, len, 0.017 - i * 0.002), pla); m.position.y = len / 2 + 0.002; seg.add(m);
      const k = new THREE.Mesh(cyl(0.006, 0.019, 16), joint); k.rotation.z = Math.PI / 2; seg.add(k);
      const t = new THREE.Mesh(box(0.002, len, 0.002), cord); t.position.set(0, len / 2 + 0.002, -0.0095); seg.add(t);
      const next = new THREE.Group(); next.position.y = len + 0.004; seg.add(next); at = next;
    });
  };
  finger("Index finger", -0.03, 0.184, [0.036, 0.026, 0.02], 0.22);
  finger("Middle finger", -0.01, 0.186, [0.04, 0.028, 0.021], 0.3);
  finger("Ring finger", 0.01, 0.184, [0.037, 0.026, 0.02], 0.38);
  finger("Little finger", 0.03, 0.178, [0.029, 0.021, 0.017], 0.46);
  finger("Thumb", -0.047, 0.118, [0.034, 0.027], 0.3, 0.95);
  const cuff = part("Wrist cuff");
  add(cuff, box(0.072, 0.07, 0.03), pla, 0, 0.05, 0);
  add(cuff, cyl(0.004, 0.084, 12), pin, 0, 0.088, 0).rotation.z = Math.PI / 2;
  for (const y of [0.034, 0.064]) add(cuff, box(0.076, 0.012, 0.034), strap, 0, y, 0);
  add(cuff, cyl(0.03, 0.012, 40), pla, 0, 0.006, 0);
}

// Business: a coffee cart, the kind a student venture sells from on the quad.
function cart(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const wood = mat(0xb5814f, 0.7), topM = mat(0xe8dcc8, 0.5), frame = mat(0x22252b, 0.5, 0.4), red = mat(0xc8402f, 0.6), cream = mat(0xf3ece0, 0.6), steel = mat(0xc9ced6, 0.25, 1), rubber = mat(0x0e0e10, 0.9), chalk = mat(0x1d2420, 0.8), white = mat(0xffffff, 0.5);
  const body = part("Body");
  add(body, box(1.3, 0.62, 0.72), wood, 0, 0.72, 0);
  for (const x of [-0.45, 0, 0.45]) add(body, box(0.02, 0.56, 0.01), frame, x, 0.72, 0.365);
  add(body, box(0.05, 0.41, 0.05), frame, 0.6, 0.205, 0.3);
  add(body, box(0.05, 0.41, 0.05), frame, 0.6, 0.205, -0.3);
  rod(body, [0.65, 0.95, -0.3], [0.9, 1.0, -0.3], 0.018, frame, 12);
  rod(body, [0.65, 0.95, 0.3], [0.9, 1.0, 0.3], 0.018, frame, 12);
  rod(body, [0.9, 1.0, -0.3], [0.9, 1.0, 0.3], 0.018, frame, 12);
  for (const z of [-0.42, 0.42]) {
    const w = part(z < 0 ? "Left wheel" : "Right wheel");
    add(w, new THREE.TorusGeometry(0.33, 0.03, 16, 56), rubber, -0.3, 0.36, z);
    add(w, cyl(0.05, 0.07, 24), steel, -0.3, 0.36, z).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; rod(w, [-0.3 + 0.32 * Math.cos(a), 0.36 + 0.32 * Math.sin(a), z], [-0.3 - 0.32 * Math.cos(a), 0.36 - 0.32 * Math.sin(a), z], 0.008, steel, 8); }
  }
  add(part("Counter"), box(1.4, 0.04, 0.82), topM, 0, 1.05, 0);
  const canopy = part("Canopy");
  for (const [x, z] of [[-0.64, -0.36], [0.64, -0.36], [-0.64, 0.36], [0.64, 0.36]]) rod(canopy, [x, 1.07, z], [x, 2.0, z], 0.016, frame, 10);
  for (let i = 0; i < 8; i++) { const s = add(canopy, box(0.185, 0.02, 1.0), i % 2 ? cream : red, -0.6475 + i * 0.185, 2.05, 0.06); s.rotation.x = 0.16; }
  const machine = part("Espresso machine");
  add(machine, box(0.42, 0.32, 0.34), steel, -0.32, 1.23, -0.12);
  add(machine, box(0.36, 0.03, 0.14), frame, -0.32, 1.1, 0.1);
  for (const x of [-0.42, -0.22]) add(machine, cyl(0.022, 0.08, 16), frame, x, 1.16, 0.08);
  const cups = part("Cups");
  for (const x of [0.2, 0.32, 0.44]) for (let i = 0; i < 4; i++) add(cups, cyl(0.03, 0.03, 20, 0.04), white, x, 1.085 + i * 0.022, 0.22);
  const menu = part("Menu board");
  add(menu, box(0.5, 0.36, 0.02), chalk, 0.25, 1.68, -0.36);
  for (let i = 0; i < 4; i++) add(menu, box(0.3 - i * 0.04, 0.02, 0.004), white, 0.2, 1.78 - i * 0.065, -0.348);
}

// Design and arts: a lounge chair cut from one sheet of plywood, slotted together without screws.
function chair(THREE: Three, { part, add, box, beam, mat }: Kit) {
  const ply = mat(0xd9b888, 0.65), edge = mat(0xb48f5c, 0.7);
  // The side panel's outline, drawn in the z (depth) and y (height) plane.
  const side = new THREE.Shape();
  side.moveTo(-0.3, 0); side.lineTo(-0.22, 0); side.lineTo(-0.14, 0.26); side.lineTo(0.2, 0.3); side.lineTo(0.27, 0); side.lineTo(0.36, 0);
  side.lineTo(0.3, 0.42); side.lineTo(-0.1, 0.4); side.lineTo(-0.3, 0.82); side.lineTo(-0.37, 0.8); side.lineTo(-0.24, 0.38); side.closePath();
  const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 0.018, bevelEnabled: false });
  sideGeo.rotateY(-Math.PI / 2); // the outline's x becomes z, and its thickness runs along x
  for (const [name, x] of [["Left side", -0.27], ["Right side", 0.288]] as const) add(part(name), sideGeo, ply, x, 0, 0);
  const seat = add(part("Seat"), box(0.56, 0.018, 0.46), ply, 0.009, 0.415, 0.09);
  seat.rotation.x = -0.05;
  const back = add(part("Back"), box(0.56, 0.46, 0.018), ply, 0.009, 0.6, -0.2);
  back.rotation.x = -0.44;
  const rails = part("Stretchers");
  beam(rails, [-0.27, 0.12, -0.2], [0.288, 0.12, -0.2], 0.03, edge);
  beam(rails, [-0.27, 0.14, 0.24], [0.288, 0.14, 0.24], 0.03, edge);
}

// Media and communication: the camera a documentary was shot on, on its tripod, with a shotgun mic.
function camera(THREE: Three, { part, add, box, cyl, rod, mat }: Kit) {
  const black = mat(0x1a1b1f, 0.45, 0.3), alu = mat(0xb9bec7, 0.4, 0.85), glass = mat(0x0b0d12, 0.05, 0.7), red = mat(0xd3372c, 0.4, 0, { emissive: 0xd3372c, emissiveIntensity: 0.8 }), foam = mat(0x3a3d44, 0.95), screen = mat(0x2f6fde, 0.3, 0, { emissive: 0x2f6fde, emissiveIntensity: 0.35 });
  const tripod = part("Tripod");
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.52; rod(tripod, [0.04 * Math.cos(a), 1.1, 0.04 * Math.sin(a)], [0.42 * Math.cos(a), 0, 0.42 * Math.sin(a)], 0.014, alu, 12); rod(tripod, [0.2 * Math.cos(a), 0.52, 0.2 * Math.sin(a)], [0, 0.6, 0], 0.006, black, 8); }
  rod(tripod, [0, 0.6, 0], [0, 1.22, 0], 0.016, alu, 14);
  const head = part("Fluid head");
  add(head, cyl(0.045, 0.05, 28), black, 0, 1.245, 0);
  add(head, box(0.1, 0.02, 0.14), black, 0, 1.28, 0);
  rod(head, [0.04, 1.26, -0.03], [0.18, 1.16, -0.32], 0.007, black, 10);
  const body = part("Camera body");
  add(body, box(0.13, 0.13, 0.2), black, 0, 1.355, 0);
  add(body, box(0.02, 0.03, 0.16), black, 0, 1.45, 0);
  rod(body, [0, 1.42, -0.07], [0, 1.47, -0.07], 0.006, black, 8);
  rod(body, [0, 1.42, 0.07], [0, 1.47, 0.07], 0.006, black, 8);
  add(body, box(0.004, 0.07, 0.11), screen, -0.068, 1.36, -0.02);
  add(body, box(0.006, 0.006, 0.006), red, 0.03, 1.4, 0.101);
  const lens = part("Lens");
  add(lens, cyl(0.042, 0.11, 36), black, 0, 1.355, 0.155).rotation.x = Math.PI / 2;
  add(lens, cyl(0.05, 0.03, 36), black, 0, 1.355, 0.222).rotation.x = Math.PI / 2;
  add(lens, cyl(0.04, 0.002, 36), glass, 0, 1.355, 0.238).rotation.x = Math.PI / 2;
  const mic = part("Microphone");
  add(mic, cyl(0.016, 0.24, 20), foam, 0.05, 1.49, 0.07).rotation.x = Math.PI / 2;
  rod(mic, [0.05, 1.42, 0.0], [0.05, 1.475, 0.0], 0.005, black, 8);
}

// Social sciences and policy: a survey's results as a chart you can hold. Two series of bars on a base.
function chart(THREE: Three, { part, add, box, mat }: Kit) {
  const base = mat(0x2a2d34, 0.55, 0.2), back = mat(0xf1f2f4, 0.6), rule = mat(0xb9bbb6, 0.6), a = mat(0x1d7f8c, 0.45), b = mat(0xe8833a, 0.45);
  const stand = part("Base");
  add(stand, box(0.24, 0.008, 0.11), base, 0, 0.004, 0);
  const wall = part("Scale");
  add(wall, box(0.24, 0.15, 0.004), back, 0, 0.083, -0.053);
  for (let i = 1; i <= 4; i++) add(wall, box(0.23, 0.0012, 0.001), rule, 0, 0.008 + i * 0.03, -0.0505);
  // Share of income spent on rent, by year of study: students living on campus, and off.
  const on = [0.034, 0.041, 0.045, 0.052, 0.058], off = [0.052, 0.068, 0.081, 0.097, 0.118];
  const sa = part("On campus"), sb = part("Off campus");
  on.forEach((h, i) => add(sa, box(0.024, h, 0.024), a, -0.088 + i * 0.044, 0.008 + h / 2, 0.022));
  off.forEach((h, i) => add(sb, box(0.024, h, 0.024), b, -0.088 + i * 0.044, 0.008 + h / 2, -0.016));
}

// Education: a tactile fraction kit. One whole, then the same length cut into halves, thirds, quarters and sixths.
function blocks(THREE: Three, { part, add, box, mat }: Kit) {
  const tray = part("Tray"), wood = mat(0xd9b888, 0.7), L = 0.24, D = 0.026, T = 0.014;
  add(tray, box(L + 0.03, 0.006, 5 * (D + 0.006) + 0.03), wood, 0, 0.003, 0);
  for (const z of [-1, 1]) add(tray, box(L + 0.03, 0.014, 0.008), wood, 0, 0.013, z * (2.5 * (D + 0.006) + 0.011));
  for (const x of [-1, 1]) add(tray, box(0.008, 0.014, 5 * (D + 0.006) + 0.03), wood, x * (L / 2 + 0.011), 0.013, 0);
  [["Whole", 1, 0xd3372c], ["Halves", 2, 0xe8833a], ["Thirds", 3, 0xe2b93b], ["Quarters", 4, 0x35a36b], ["Sixths", 6, 0x2f6fde]].forEach(([name, n, color], row) => {
    const g = part(name as string), m = mat(color as number, 0.5), w = L / (n as number);
    for (let i = 0; i < (n as number); i++) add(g, box(w - 0.002, T, D), m, -L / 2 + w / 2 + i * w, 0.006 + T / 2, (row - 2) * (D + 0.006));
  });
}
