import type * as THREE_NS from "three";
import type { RoundedBoxGeometry as RoundedBox } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

// Example models, built in code (no file to download): what the landing page shows in the 3D viewer,
// one for every field the app offers (lib/forge.ts, TOPICS), engineering split into its trades. Each is in metres, like a glTF, so the viewer's size readout is right, and
// each top-level group is one part, which is what "Explode" pulls apart.
// Example objects with made-up results, not anyone's real design; the page says so.
//
// Each build also comes alive (model-stage.ts plays it):
// - `root.userData.live`: functions of time that move it, the robot driving its line, the gears
//   meshing, the pendulum swinging by real physics. Each is a pure function of t, or resets itself
//   when t goes back to 0, and t = 0 is the rest pose: what explode, see-through and blueprint show.
//   Motion only turns things or moves things inside a part, so it never fights "Explode".
// - `root.userData.setting`: a small world it stands in (the robot's test mat, the rocket's launch
//   rail, grass under the weather station). Not part of the build: it isn't measured, exploded or
//   drawn in the blueprint.
// three.js and its rounded-box helper are passed in: build-showcase.tsx imports SAMPLES from here,
// so this file must not pull three.js into the landing page (FIX-75).

type Three = typeof THREE_NS;
type V3 = [number, number, number];
type Group = THREE_NS.Group;
type Mat = THREE_NS.Material;
type Mesh = THREE_NS.Mesh;
type Physical = THREE_NS.MeshPhysicalMaterial;
/** Where a build is at t seconds of play. t = 0 is the rest pose. */
export type Live = (t: number) => void;
export type Extras = { RoundedBoxGeometry?: typeof RoundedBox };

/** The examples, in the order the landing page offers them: the field, the build, the result someone
 *  in that field would record (with its number), and who confirmed it, the way Brazework does:
 *  verified by a club its officers run, or signed by a person who saw the work (a professor, a
 *  manager, a client, a mentor), named with their role. Students and working professionals alike. */
export const SAMPLES = [
  // Engineering
  { id: "robot", field: "Robotics", name: "Line-following robot", milestone: "Ran the 12 m course in 41.2 s, best of three runs", by: "Rocketry Club", how: "verified" },
  { id: "rocket", field: "Aerospace", name: "Certification rocket", milestone: "Level 1 flight: 1,140 m apogee, recovered intact", by: "J. Reyes, certification prefect", how: "signed" },
  { id: "gearbox", field: "Mechanical", name: "Reduction gearbox", milestone: "Ran 2 hours at 40 N·m with no slip or heat damage", by: "Prof. Alvarez, Machine Design", how: "signed" },
  { id: "board", field: "Electronics", name: "Battery management board", milestone: "Balanced all 12 cells within 5 mV at bring-up", by: "D. Ruiz, hardware lead (manager)", how: "signed" },
  { id: "bridge", field: "Civil", name: "Balsa truss bridge", milestone: "Held 48 kg at 62 g, a 774 to 1 load ratio", by: "Civil Engineering Society", how: "verified" },
  // Computing
  { id: "phone", field: "Software", name: "Campus shuttle tracker app", milestone: "Shipped v2: 2,100 weekly riders, 99.6% crash-free", by: "M. Okoro, Transit Office (client)", how: "signed" },
  { id: "cluster", field: "Computer science", name: "Four-node compute cluster", milestone: "Sorted 10 GB across four nodes in 94 s", by: "Dr. Okafor, Distributed Systems", how: "signed" },
  { id: "network", field: "Data & AI", name: "Crop disease classifier", milestone: "94% accuracy on 1,800 field-trial photos", by: "Dr. Shah, agronomy lab PI", how: "signed" },
  // Sciences
  { id: "knot", field: "Mathematics", name: "Trefoil knot model", milestone: "Presented a proof of its tricolorability at seminar", by: "Prof. Chen, seminar host", how: "signed" },
  { id: "pendulum", field: "Physics", name: "Double pendulum rig", milestone: "Tracked 200 runs and found where chaos sets in", by: "Physics Society", how: "verified" },
  { id: "crystal", field: "Chemistry", name: "Salt crystal lattice model", milestone: "Grew a 14 mm single crystal over three weeks", by: "Chemistry Club", how: "verified" },
  { id: "helix", field: "Biology", name: "DNA double helix model", milestone: "Printed for BIO 101 and used by 180 students", by: "Dr. Lee, Biology", how: "signed" },
  { id: "weather", field: "Environment", name: "Campus weather station", milestone: "90 days of readings with no gaps, shared with the city", by: "City sustainability office (client)", how: "signed" },
  { id: "cubesat", field: "Space", name: "CubeSat structure", milestone: "Passed the vibration test at launch levels", by: "Space Systems Lab", how: "verified" },
  { id: "hand", field: "Medicine", name: "3D-printed prosthetic hand", milestone: "Lifted a 500 g bottle in 20 of 20 trials", by: "R. Patel, clinical mentor", how: "signed" },
  // Business, arts and society
  { id: "cart", field: "Business", name: "Campus coffee cart", milestone: "Sold 1,200 cups in month one at a 38% margin", by: "Small Business Center advisor", how: "signed" },
  { id: "chair", field: "Design", name: "Flat-pack plywood chair", milestone: "Held 120 kg, cut from a single sheet", by: "Industrial Design Studio", how: "verified" },
  { id: "camera", field: "Media", name: "Documentary short", milestone: "Screened to 300 people, selected by a regional festival", by: "Film Club", how: "verified" },
  { id: "chart", field: "Social science", name: "Campus rent survey", milestone: "412 responses, cited by the student senate", by: "Prof. Ortiz, Economics", how: "signed" },
  { id: "blocks", field: "Education", name: "Tactile fraction kit", milestone: "Used in three fourth-grade classes, quiz scores up 18%", by: "Ms. Hart, classroom teacher", how: "signed" },
] as const;
export type SampleId = (typeof SAMPLES)[number]["id"];
/** The format a sample's numbers are in, for the size readout (lib/model-view.ts, sizeLabel). */
export const SAMPLE_EXT = "glb";

export function buildSample(THREE: Three, id: SampleId, extras: Extras = {}): THREE_NS.Object3D {
  const k = kit(THREE, SAMPLES.find((s) => s.id === id)?.name ?? "Example", extras);
  ({ robot, rocket, gearbox, board, bridge, phone, cluster, network, knot, pendulum, crystal, helix, weather, cubesat, hand, cart, chair, camera, chart, blocks })[id](THREE, k);
  return k.root;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOut = (x: number) => 1 - (1 - clamp01(x)) ** 3;

// The few shapes every model is made of.
function kit(THREE: Three, name: string, extras: Extras) {
  const root = new THREE.Group();
  root.name = name;
  const lives: Live[] = [];
  root.userData.live = lives;
  let world: Group | undefined;
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  // Softly rounded, so edges catch the light the way a machined or moulded part does. The sharp size
  // is kept for the see-through and blueprint drawings (model-stage.ts), which want crisp edges.
  const box = (w: number, h: number, d: number): THREE_NS.BufferGeometry => {
    const RB = extras.RoundedBoxGeometry;
    if (!RB) return new THREE.BoxGeometry(w, h, d);
    const g = new RB(w, h, d, 2, Math.min(w, h, d) * 0.22);
    g.userData.sharp = [w, h, d];
    return g;
  };
  const mesh = (g: THREE_NS.Object3D, geo: THREE_NS.BufferGeometry, m: Mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const between = (g: THREE_NS.Object3D, geo: THREE_NS.BufferGeometry, axis: THREE_NS.Vector3, a: V3, b: V3, m: Mat) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), o = new THREE.Mesh(geo, m);
    o.position.copy(A).add(B).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(axis, B.clone().sub(A).normalize());
    g.add(o);
    return o;
  };
  const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  // A soft round blot, for smoke and steam: sprites always face the camera, so a gradient reads as a billow.
  let blot: THREE_NS.CanvasTexture | undefined;
  const soft = () => blot ??= (() => {
    if (typeof document === "undefined") return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement); // built outside a page (tests): no picture
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d");
    if (g) { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.45, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }
    return new THREE.CanvasTexture(c);
  })();
  return {
    root,
    part: (n: string) => { const g = new THREE.Group(); g.name = n; root.add(g); return g; },
    /** A surface. Smooth plastics get a clear coat, the sheen that makes them read as moulded rather than painted. */
    mat: (color: number, roughness: number, metalness = 0, extra: THREE_NS.MeshPhysicalMaterialParameters = {}) => {
      const coat = metalness < 0.3 && roughness <= 0.5 && !extra.transparent && extra.emissive === undefined;
      return new THREE.MeshPhysicalMaterial({ color, roughness, metalness, ...(coat ? { clearcoat: 0.5, clearcoatRoughness: 0.22 } : {}), ...extra });
    },
    add: mesh,
    box,
    cyl: (r: number, h: number, seg = 40, r2 = r) => new THREE.CylinderGeometry(r2, r, h, seg),
    /** A square bar from a to b. */
    beam: (g: THREE_NS.Object3D, a: V3, b: V3, t: number, m: Mat) => between(g, box(dist(a, b), t, t), X, a, b, m),
    /** A round rod from a to b. */
    rod: (g: THREE_NS.Object3D, a: V3, b: V3, r: number, m: Mat, seg = 16) => between(g, new THREE.CylinderGeometry(r, r, dist(a, b), seg), Y, a, b, m),
    /** Motion: called with the time played, 0 being the rest pose. */
    live: (f: Live) => { lives.push(f); },
    /** The world around the build (not part of it). Meshes added here receive shadows; set castShadow on props. */
    setting: () => (world ??= (() => { const g = new THREE.Group(); g.name = "Setting"; root.userData.setting = g; return g; })()),
    /** A texture drawn on a canvas: test mats, paving, grass. */
    paint: (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      if (typeof document === "undefined") return new THREE.CanvasTexture(null as unknown as HTMLCanvasElement); // built outside a page (tests): no picture
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const g = c.getContext("2d");
      if (g) draw(g);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    },
    /** Soft puffs of smoke or steam: `n` sprites, each placed, sized (its width) and faded by the model's live function. */
    puffs: (g: Group, n: number, color: number) => Array.from({ length: n }, () => {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      g.add(m);
      return m;
    }),
  };
}
type Kit = ReturnType<typeof kit>;
const glow = (m: Mesh) => m.material as Physical;

// Robotics: a line-following robot. x is across, z is front (+) to back (−). It drives its test mat:
// the mat's line slides under it, the wheels roll at the matching speed, and the sensor over the line lights.
function robot(THREE: Three, { part, add, box, cyl, mat, live, setting, paint }: Kit) {
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

  // Two drive wheels on gear motors, slung under the plate at the back. Spokes on the hubs show them turn.
  const wheels: Group[] = [];
  for (const side of [-1, 1]) {
    const wheel = part(side < 0 ? "Left wheel" : "Right wheel");
    const spin = new THREE.Group();
    spin.position.set(side * 0.071, 0.0345, -0.03);
    wheel.add(spin);
    add(spin, new THREE.TorusGeometry(0.0265, 0.008, 20, 64), M.rubber).rotation.y = Math.PI / 2;
    add(spin, cyl(0.0195, 0.012), M.hub).rotation.z = Math.PI / 2;
    add(spin, cyl(0.006, 0.018), M.steel).rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i++) add(spin, box(0.002, 0.034, 0.0045), M.holder, side * 0.0066, 0, 0).rotation.x = (i / 3) * Math.PI;
    wheels.push(spin);
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
  const eyes: Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    add(bar, box(0.0055, 0.0045, 0.0075), M.chip, (i - 2) * 0.0155, 0.0155, 0.073);
    eyes.push(add(bar, new THREE.SphereGeometry(0.0011, 10, 8), M.led.clone(), (i - 2) * 0.0155, 0.0198, 0.0775));
  }
  for (const x of [-0.03, 0.03]) add(bar, cyl(0.002, 0.0165, 6), M.brass, x, 0.0275, 0.071);
  add(bar, box(0.016, 0.0006, 0.0006), M.gold, 0, 0.0195, 0.069);

  // The test mat: white, with a 19 mm black line that weaves (it repeats, so it can slide forever).
  const L = 0.5, SPEED = 0.12; // the mat's size, and the robot's speed in m/s
  const lineX = (s: number) => 0.013 * Math.sin(s * Math.PI * 4) + 0.004 * Math.sin(s * Math.PI * 10);
  const track = paint(256, 1024, (g) => {
    g.fillStyle = "#f2f1ec"; g.fillRect(0, 0, 256, 1024);
    g.strokeStyle = "#141518"; g.lineWidth = (0.019 / L) * 256; g.lineCap = "round"; g.beginPath();
    for (let y = -8; y <= 1032; y += 4) { const x = (0.5 + lineX(1 - y / 1024) / L) * 256; if (y === -8) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  });
  track.wrapS = track.wrapT = THREE.RepeatWrapping;
  const mat2 = new THREE.Mesh(new THREE.PlaneGeometry(L, L), new THREE.MeshStandardMaterial({ map: track, roughness: 0.85 }));
  mat2.rotation.x = -Math.PI / 2;
  setting().add(mat2);
  live((t) => {
    track.offset.y = -(t * SPEED) / L;
    for (const w of wheels) w.rotation.x = (t * SPEED) / 0.0345;
    // Where the line is under the sensors (texture v at the sensors' z, shifted by the scroll).
    const at = lineX(0.5 - 0.0775 / L + track.offset.y);
    eyes.forEach((e, i) => { glow(e).emissiveIntensity = 0.25 + 2.8 * Math.exp(-((((i - 2) * 0.0155 - at) / 0.009) ** 2)); });
  });
}

// Aerospace: a mid-power rocket on its launch rail. It sits on the pad, lights, and climbs out of view.
function rocket(THREE: Three, { root, part, add, box, cyl, mat, live, setting, puffs }: Kit) {
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

  // The pad: a concrete slab, and a rail the rocket's two buttons ride up.
  const S = setting(), concrete = mat(0x8c8f94, 0.95), rail = mat(0xb9bec7, 0.35, 0.9);
  add(S, box(0.36, 0.024, 0.36), concrete, 0, -0.012, 0);
  add(S, box(0.01, 1.15, 0.01), rail, R + 0.0135, 0.575, 0).castShadow = true;
  add(S, box(0.05, 0.03, 0.05), rail, R + 0.0135, 0.015, 0).castShadow = true;
  // The flame: two cones, a hot core inside a wider glow, pointing down from the nozzle.
  const flame = new THREE.Group();
  S.add(flame);
  const fire = (r: number, h: number, color: number, o: number) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 24, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    m.rotation.x = Math.PI; m.position.y = -h / 2; flame.add(m);
  };
  fire(0.016, 0.12, 0xff8a2a, 0.75); fire(0.008, 0.07, 0xfff1c4, 0.95);
  const smoke = puffs(S, 30, 0xd9d6cf);
  // Eleven seconds a flight: five on the pad, a second of ignition, then a climb at a steady 0.64 m/s²
  // (slowed from life, so you can watch it leave the rail).
  const CYCLE = 11, IGNITE = 5, LIFT = 6;
  const height = (p: number) => (p < LIFT ? 0 : 0.32 * (p - LIFT) ** 2);
  live((t) => {
    const p = t % CYCLE, y = height(p);
    root.position.y = y;
    flame.visible = p >= IGNITE;
    flame.position.y = y;
    const f = clamp01(p - IGNITE) * (1 + 0.22 * Math.sin(t * 41) + 0.12 * Math.sin(t * 23));
    flame.scale.set(1, Math.max(0.01, f), 1);
    smoke.forEach((m, i) => {
      const born = IGNITE + (i / smoke.length) * 4.5, age = p - born, life = 2.8;
      m.visible = age > 0 && age < life;
      if (!m.visible) return;
      const a = i * 2.39996, spread = (0.32 * (1 - Math.exp(-age * 1.4))) / (1 + height(born) * 3);
      m.position.set(Math.cos(a) * spread, height(born) + 0.02 + 0.06 * age, Math.sin(a) * spread);
      m.scale.setScalar(0.06 + 0.13 * age);
      m.material.opacity = 0.55 * (1 - age / life) * clamp01(age * 4);
    });
  });
}

// Mechanical: a 3:1 gear pair on two shafts, between two plates. The pinion drives; the gear turns a third as fast, the other way.
function gearbox(THREE: Three, { part, add, box, cyl, rod, mat, live }: Kit) {
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
  const pinion = add(part("Pinion"), gearGeo(outline(12, 0.0113, 0.0166, (-0.35 / 12) * Math.PI * 2, [[0, 0, 0.004]]), 0.012), steel, XP, Y0, 0);
  const lightening = Array.from({ length: 6 }, (_, i): [number, number, number] => [0.024 * Math.cos((i / 6) * Math.PI * 2), 0.024 * Math.sin((i / 6) * Math.PI * 2), 0.0065]);
  const gear = add(part("Gear"), gearGeo(outline(36, 0.0393, 0.0446, Math.PI - (17.85 / 36) * Math.PI * 2, [[0, 0, 0.005], ...lightening]), 0.01), bronze, XG, Y0, 0);
  const input = part("Input shaft"), output = part("Output shaft");
  rod(input, [XP, Y0, -0.062], [XP, Y0, 0.04], 0.004, steel, 24);
  // The input coupling, with a set screw so you can see it turn.
  const coupling = new THREE.Group();
  coupling.position.set(XP, Y0, -0.056);
  input.add(coupling);
  add(coupling, cyl(0.008, 0.018, 24), dark).rotation.x = Math.PI / 2;
  add(coupling, cyl(0.0016, 0.004, 8), brass, 0, 0.0085, 0);
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
  live((t) => {
    const a = t * 1.8; // rad/s at the input
    pinion.rotation.z = a;
    coupling.rotation.z = a;
    gear.rotation.z = -a / 3; // 12 teeth driving 36
  });
}

// Electronics: a battery management board, alive: power on, charging, the balancer ticking.
function board(THREE: Three, { part, add, box, cyl, mat, live }: Kit) {
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
  const lamps = [0x35d07f, 0x35d07f, 0xffb020].map((c, i) => add(lights, box(0.0016, 0.0008, 0.0009), led(c), 0.004 + i * 0.004, T + 0.0004, -0.022));
  live((t) => {
    // Power steady; charge breathing; the balancer's amber tick each time it moves charge between cells.
    glow(lamps[1]).emissiveIntensity = 0.5 + 2 * (0.5 - 0.5 * Math.cos(t * 2.2));
    glow(lamps[2]).emissiveIntensity = t > 0 && t % 1.6 > 1.42 ? 2.6 : 0.15;
  });
}

// Civil: a balsa Warren truss with a test load at mid-span, swinging where it hangs.
function bridge(THREE: Three, { part, add, box, cyl, beam, mat, live }: Kit) {
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
  // The test load: weights hung from a bar across the deck, on a hanger that swings.
  const load = part("Test load");
  add(load, box(0.012, 0.008, W + 0.02), steel, 0, 0.0095, 0);
  const hang = new THREE.Group();
  hang.position.set(0, 0.006, 0);
  load.add(hang);
  add(hang, cyl(0.0016, 0.05, 12), steel, 0, -0.026, 0);
  for (let i = 0; i < 3; i++) add(hang, cyl(0.03, 0.011, 40), iron, 0, -0.056 - i * 0.012, 0);
  live((time) => {
    // A pendulum about 7 cm long, nudged every few seconds as weights go on, settling in between.
    const p = time % 5, amp = 0.07 * Math.exp(-p * 0.7), w = Math.sqrt(9.81 / 0.07);
    hang.rotation.z = amp * Math.sin(p * w);
    hang.rotation.x = amp * 0.4 * Math.sin(p * w * 0.97 + 1);
  });
}

// Biology: a double helix on a stand, the kind a lab prints to teach base pairing. It turns on its stand.
function helix(THREE: Three, { part, add, cyl, rod, mat, live }: Kit) {
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
  live((t) => { for (const g of [...strands, rungs]) g.rotation.y = t * 0.45; });
}

// Software: the app itself, running on a phone in a stand. The screen is built from raised blocks,
// so it reads in blueprint and comes apart from the phone when exploded. The shuttle moves along its route.
function phone(THREE: Three, { root, mat, box, cyl, live }: Kit) {
  const body = mat(0x1c1d21, 0.35, 0.6), glass = mat(0xf6f6f3, 0.25, 0, { emissive: 0xf6f6f3, emissiveIntensity: 0.25 }), ink = mat(0x1f1f1d, 0.5),
    map = mat(0xdcebdf, 0.6, 0, { emissive: 0xdcebdf, emissiveIntensity: 0.2 }), road = mat(0xffffff, 0.6), route = mat(0x2f6fde, 0.4, 0, { emissive: 0x2f6fde, emissiveIntensity: 0.6 }),
    stop = mat(0xe5484d, 0.4, 0, { emissive: 0xe5484d, emissiveIntensity: 0.5 }), card = mat(0xffffff, 0.5, 0, { emissive: 0xffffff, emissiveIntensity: 0.2 }), line = mat(0xb9bbb6, 0.6), ok = mat(0x15803d, 0.5), standM = mat(0xc9ced6, 0.3, 1),
    bus = mat(0x1747a6, 0.3, 0, { emissive: 0x3b82f6, emissiveIntensity: 1.4 });
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
  const shuttle = at(ui, cyl(0.0034, 0.0009, 24), bus, -0.025, H - 0.046, Z + 0.0026);       // the shuttle, live
  shuttle.rotation.x = Math.PI / 2;
  const eta: Mesh[] = [];
  for (let i = 0; i < 3; i++) {                                                              // arrival times
    const y = H - 0.098 - i * 0.016;
    at(ui, box(W - 0.012, 0.013, 0.0006), card, 0, y, Z + 0.0006);
    at(ui, box(0.026, 0.0022, 0.0004), ink, -0.016, y + 0.002, Z + 0.0011);
    at(ui, box(0.018, 0.0016, 0.0004), line, -0.02, y - 0.0025, Z + 0.0011);
    eta.push(at(ui, box(0.01, 0.006, 0.0004), i === 0 ? ok.clone() : line, 0.022, y, Z + 0.0011));
  }
  const stand = part("Stand");
  at(stand, box(0.086, 0.004, 0.012), standM, 0, -0.004, 0.002);
  at(stand, box(0.086, 0.012, 0.003), standM, 0, 0.002, 0.008);
  at(stand, box(0.06, 0.07, 0.004), standM, 0, 0.03, -0.012);
  const foot = new THREE.Mesh(box(0.09, 0.005, 0.085), standM);                              // the foot stays level on the desk
  foot.position.set(0, 0.0025, -0.012);
  const base = new THREE.Group(); base.name = "Base"; base.add(foot); root.add(base);
  const A = [-0.025, H - 0.046], B = [0.012, H - 0.046], C = [0.012, H - 0.076], AB = B[0] - A[0], BC = B[1] - C[1];
  live((t) => {
    // Out along the route and back, at a steady pace; the next arrival pulses as it closes in.
    const u = (t * 0.012) % (2 * (AB + BC)), d = u < AB + BC ? u : 2 * (AB + BC) - u;
    if (d <= AB) shuttle.position.set(A[0] + d, A[1], Z + 0.0026); else shuttle.position.set(B[0], B[1] - (d - AB), Z + 0.0026);
    (eta[0].material as Physical).emissive.setHex(0x22c55e);
    (eta[0].material as Physical).emissiveIntensity = t > 0 ? 0.35 + 0.35 * Math.sin(t * 3) : 0;
  });
}

// Computer science: four single-board computers stacked in a frame, with a fan and a network switch.
// Running: the fan spins, the activity lights flicker, and packets travel the cables.
function cluster(THREE: Three, { part, add, box, cyl, rod, mat, live }: Kit) {
  const pcb = mat(0x157a4a, 0.5, 0.1), chip = mat(0x15161a, 0.5), steel = mat(0xc9ced6, 0.28, 1), brass = mat(0xc0994f, 0.3, 1), clear = mat(0xd6ecf7, 0.08, 0, { transparent: true, opacity: 0.3 }),
    dark = mat(0x22252b, 0.5, 0.3), cable = mat(0x2f6fde, 0.6), led = mat(0x35d07f, 0.4, 0, { emissive: 0x35d07f, emissiveIntensity: 1.8 }),
    packet = mat(0x9fe3ff, 0.3, 0, { emissive: 0x6fd3ff, emissiveIntensity: 2.4 });
  const GAP = 0.026, Y0 = 0.012;
  const nodeLeds: Mesh[] = [];
  for (let n = 0; n < 4; n++) {
    const y = Y0 + n * GAP, node = part(`Node ${n + 1}`);
    add(node, box(0.085, 0.0015, 0.056), pcb, 0, y, 0);
    add(node, box(0.014, 0.002, 0.014), steel, -0.012, y + 0.0018, 0.002);
    add(node, box(0.008, 0.0015, 0.012), chip, 0.01, y + 0.0015, -0.008);
    add(node, box(0.05, 0.008, 0.005), chip, -0.012, y + 0.0048, -0.0245);
    for (const z of [-0.012, 0.006]) add(node, box(0.017, 0.014, 0.013), steel, 0.034, y + 0.0078, z);
    add(node, box(0.021, 0.0135, 0.016), steel, 0.032, y + 0.0075, 0.0205);
    nodeLeds.push(add(node, box(0.0016, 0.0008, 0.0012), led.clone(), -0.038, y + 0.0012, 0.024));
  }
  const frame = part("Frame");
  for (const [x, z] of [[-0.039, -0.0245], [0.039, -0.0245], [-0.039, 0.0245], [0.039, 0.0245]]) rod(frame, [x, 0.003, z], [x, Y0 + 3 * GAP + 0.024, z], 0.0026, brass, 6);
  add(frame, box(0.092, 0.003, 0.062), clear, 0, 0.0015, 0);
  add(frame, box(0.092, 0.003, 0.062), clear, 0, Y0 + 3 * GAP + 0.0255, 0);
  const fan = part("Fan"), FY = Y0 + 3 * GAP + 0.032;
  add(fan, box(0.04, 0.01, 0.04), dark, -0.012, FY, 0);
  add(fan, cyl(0.0175, 0.0104, 36), chip, -0.012, FY, 0);
  const rotor = new THREE.Group();
  rotor.position.set(-0.012, FY + 0.0056, 0);
  fan.add(rotor);
  add(rotor, cyl(0.006, 0.0012, 20), steel);
  for (let i = 0; i < 7; i++) { const b = add(rotor, box(0.011, 0.0006, 0.0042), dark, 0.0105 * Math.cos((i / 7) * Math.PI * 2), 0, 0.0105 * Math.sin((i / 7) * Math.PI * 2)); b.rotation.y = -(i / 7) * Math.PI * 2; b.rotation.x = 0.35; }
  const sw = part("Network switch");
  add(sw, box(0.1, 0.026, 0.06), dark, 0.115, 0.013, 0);
  const portLeds: Mesh[] = [];
  for (let i = 0; i < 5; i++) { add(sw, box(0.004, 0.011, 0.009), chip, 0.0645, 0.013, -0.02 + i * 0.01); portLeds.push(add(sw, box(0.0012, 0.0012, 0.002), led.clone(), 0.0648, 0.022, -0.02 + i * 0.01)); }
  const cables = part("Cables");
  const ends: [V3, V3][] = [];
  for (let n = 0; n < 4; n++) { const a: V3 = [0.043, Y0 + n * GAP + 0.0075, 0.0205], b: V3 = [0.064, 0.013, -0.02 + n * 0.01]; rod(cables, a, b, 0.0014, cable, 8); ends.push([a, b]); }
  const packets = ends.map(([a]) => add(cables, new THREE.SphereGeometry(0.0024, 12, 8), packet, ...a));
  live((t) => {
    rotor.rotation.y = -t * 9;
    // Busy lights: each node's own rhythm, never quite in step.
    nodeLeds.forEach((m, n) => { glow(m).emissiveIntensity = t > 0 && Math.sin(t * 11 + n * 1.7) + Math.sin(t * 4.3 + n) > 0.4 ? 2.6 : 0.25; });
    portLeds.forEach((m, i) => { glow(m).emissiveIntensity = t > 0 && Math.sin(t * 9 + i * 2.3) + Math.sin(t * 5.1 + i) > 0.2 ? 2.6 : 0.3; });
    packets.forEach((m, n) => {
      const [a, b] = ends[n], u = (t * 0.9 + n * 0.27) % 1, k = n % 2 ? 1 - u : u;
      m.position.set(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
      m.visible = t > 0;
    });
  });
}

// Data and AI: a small neural network, its layers as rows of nodes joined by their weights. A
// forward pass runs through it: each layer lights as the signal reaches it, then the weights after it.
function network(THREE: Three, { part, add, box, cyl, rod, mat, live }: Kit) {
  const lit = (c: number) => mat(c, 0.35, 0, { emissive: c, emissiveIntensity: 0.35 });
  const layerM = [lit(0x35b46f), lit(0x2f6fde), lit(0x2f6fde), lit(0xe8833a)], base = mat(0x24262c, 0.55, 0.2), post = mat(0xc9ced6, 0.3, 1);
  // The weights between each pair of layers carry their own material, so a pass can light them in turn.
  const weightM = [0, 1, 2].map(() => ({ pos: mat(0x8aa9e6, 0.6, 0, { emissive: 0x6f9bff, emissiveIntensity: 0 }), neg: mat(0xe6b08a, 0.6, 0, { emissive: 0xff9a55, emissiveIntensity: 0 }) }));
  const sizes = [4, 6, 6, 3], X = [-0.063, -0.021, 0.021, 0.063], Y = 0.085;
  const at = (l: number, i: number): V3 => [X[l], Y + (i - (sizes[l] - 1) / 2) * 0.021, 0];
  const names = ["Input layer", "Hidden layer 1", "Hidden layer 2", "Output layer"];
  sizes.forEach((n, l) => { const g = part(names[l]); for (let i = 0; i < n; i++) add(g, new THREE.SphereGeometry(0.0062, 20, 14), layerM[l], ...at(l, i)); });
  const links = part("Weights");
  for (let l = 0; l < 3; l++) for (let i = 0; i < sizes[l]; i++) for (let j = 0; j < sizes[l + 1]; j++) rod(links, at(l, i), at(l + 1, j), 0.0006 + ((i * 7 + j * 3 + l) % 3) * 0.00035, (i + j + l) % 3 ? weightM[l].pos : weightM[l].neg, 6);
  const stand = part("Stand");
  add(stand, box(0.17, 0.006, 0.05), base, 0, 0.003, 0);
  for (const x of X) add(stand, cyl(0.0016, 0.022, 10), post, x, 0.017, 0);
  live((t) => {
    if (t === 0) { layerM.forEach((m) => (m.emissiveIntensity = 0.35)); weightM.forEach((w) => (w.pos.emissiveIntensity = w.neg.emissiveIntensity = 0)); return; }
    const w = ((t * 1.15) % 4.8) - 0.6; // where the signal is: 0 the input layer, 3 the output
    layerM.forEach((m, l) => (m.emissiveIntensity = 0.35 + 2.4 * Math.exp(-(((w - l) / 0.42) ** 2))));
    weightM.forEach((wm, l) => { wm.pos.emissiveIntensity = wm.neg.emissiveIntensity = 1.6 * Math.exp(-(((w - l - 0.5) / 0.38) ** 2)); });
  });
}

// Mathematics: a trefoil, the simplest knot that can't be untied, on a stand. It turns slowly, so you see it never crosses itself.
function knot(THREE: Three, { part, add, cyl, mat, live }: Kit) {
  const k = add(part("Knot"), new THREE.TorusKnotGeometry(0.04, 0.0105, 220, 24, 2, 3), mat(0x7a5cd6, 0.25, 0.15), 0, 0.105, 0);
  const stand = part("Stand");
  add(stand, cyl(0.045, 0.008, 56), mat(0x2a2d34, 0.55, 0.2), 0, 0.004, 0);
  add(stand, cyl(0.003, 0.05, 16), mat(0xc9ced6, 0.3, 1), 0, 0.033, 0);
  live((t) => { k.rotation.y = t * 0.4; k.rotation.x = 0.18 * Math.sin(t * 0.5); });
}

// Physics: a double pendulum on a frame, with an encoder on the pivot. It runs the real equations of
// motion (point masses, RK4): released with a flick, run after run, each a little different, and the
// tip leaves a trace. That sensitivity is the chaos the milestone measured.
function pendulum(THREE: Three, { part, add, box, cyl, beam, mat, live, setting }: Kit) {
  const alu = mat(0xb9bec7, 0.4, 0.85), dark = mat(0x2a2d34, 0.55, 0.3), steel = mat(0xc9ced6, 0.28, 1), brass = mat(0xc0994f, 0.3, 1), red = mat(0xd3372c, 0.4);
  const frame = part("Frame");
  add(frame, box(0.26, 0.012, 0.14), dark, 0, 0.006, 0);
  for (const x of [-0.11, 0.11]) beam(frame, [x, 0.012, 0], [x, 0.36, 0], 0.014, alu);
  beam(frame, [-0.117, 0.367, 0], [0.117, 0.367, 0], 0.014, alu);
  for (const x of [-0.11, 0.11]) beam(frame, [x, 0.012, -0.06], [x, 0.15, 0], 0.009, alu);
  // The arms hang from the middle of the crossbar, caught mid-swing. Each arm turns about its own pivot.
  const P: V3 = [0, 0.355, 0.016], L1 = 0.13, L2 = 0.11, A1 = 0.62, A2 = -0.95;
  const upper = part("Upper arm");
  upper.position.set(...P);
  beam(upper, [0, 0, 0], [0, -L1, 0], 0.008, alu).scale.z = 0.4;
  add(upper, cyl(0.007, 0.012, 24), steel).rotation.x = Math.PI / 2;
  upper.rotation.z = A1;
  const lower = part("Lower arm");
  const elbow = (a: number): V3 => [P[0] + L1 * Math.sin(a), P[1] - L1 * Math.cos(a), 0];
  lower.position.set(...elbow(A1));
  beam(lower, [0, 0, 0.026], [0, -L2, 0.026], 0.008, red).scale.z = 0.4;
  add(lower, cyl(0.006, 0.02, 24), steel, 0, 0, 0.021).rotation.x = Math.PI / 2;
  add(lower, cyl(0.013, 0.01, 32), brass, 0, -L2, 0.026).rotation.x = Math.PI / 2;
  lower.rotation.z = A2;
  const sensor = part("Encoder");
  const disc = add(sensor, cyl(0.02, 0.003, 40), dark, P[0], P[1], -0.012);
  disc.rotation.x = Math.PI / 2;
  add(sensor, box(0.024, 0.018, 0.012), dark, P[0], P[1] + 0.018, -0.02);

  // The tip's trace: the last ~4 seconds.
  const N = 240, pts = new Float32Array(N * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  geo.setDrawRange(0, 0);
  const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xe5484d, transparent: true, opacity: 0.6 }));
  trail.frustumCulled = false;
  setting().add(trail);
  let n = 0;
  const trace = (x: number, y: number) => {
    if (n === N) pts.copyWithin(0, 3); else n++;
    pts.set([x, y, 0.026], (n - 1) * 3);
    geo.attributes.position.needsUpdate = true;
    geo.setDrawRange(0, n);
  };

  const G = 9.81, M1 = 1, M2 = 1.4, RUN = 12;
  let s = [A1, A2, 0, 0], simT = 0, run = -1;
  const d = ([a1, a2, w1, w2]: number[]) => {
    const den = 2 * M1 + M2 - M2 * Math.cos(2 * a1 - 2 * a2), sd = Math.sin(a1 - a2), cd = Math.cos(a1 - a2);
    return [w1, w2,
      (-G * (2 * M1 + M2) * Math.sin(a1) - M2 * G * Math.sin(a1 - 2 * a2) - 2 * sd * M2 * (w2 * w2 * L2 + w1 * w1 * L1 * cd)) / (L1 * den),
      (2 * sd * (w1 * w1 * L1 * (M1 + M2) + G * (M1 + M2) * Math.cos(a1) + w2 * w2 * L2 * M2 * cd)) / (L2 * den)];
  };
  const step = (h: number) => {
    const k1 = d(s), k2 = d(s.map((v, i) => v + (h / 2) * k1[i])), k3 = d(s.map((v, i) => v + (h / 2) * k2[i])), k4 = d(s.map((v, i) => v + h * k3[i]));
    s = s.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    s[2] *= 1 - 0.04 * h; s[3] *= 1 - 0.04 * h; // a little bearing friction
  };
  live((t) => {
    const r = Math.floor(t / RUN);
    if (t === 0 || t < simT || r !== run) {
      // A new run: back to the start, and a flick that differs a little each time.
      run = t === 0 ? -1 : r; simT = r * RUN; n = 0; geo.setDrawRange(0, 0);
      s = [A1, A2, t === 0 ? 0 : 6.2 + 0.45 * ((r * 7) % 5), t === 0 ? 0 : -3.5];
    }
    while (simT < t) { const h = Math.min(1 / 240, t - simT); step(h); simT += h; }
    upper.rotation.z = s[0];
    lower.position.set(...elbow(s[0]));
    lower.rotation.z = s[1];
    disc.rotation.y = s[0] - A1; // the encoder turns with the arm, from where it was built
    if (t > 0) { const e = elbow(s[0]); trace(e[0] + L2 * Math.sin(s[1]), e[1] - L2 * Math.cos(s[1])); }
  });
}

// Chemistry: the lattice of table salt, sodium and chloride ions alternating in a cube, turning on its posts.
function crystal(THREE: Three, { part, add, box, rod, mat, live }: Kit) {
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
  live((t) => { for (const g of [na, cl, bonds]) g.rotation.y = t * 0.35; });
}

// Earth and environment: a weather station on a tripod mast, on grass. The cups spin, the vane hunts the wind, the logger blinks.
function weather(THREE: Three, { part, add, box, cyl, rod, mat, live, setting, paint }: Kit) {
  const alu = mat(0xb9bec7, 0.4, 0.85), white = mat(0xf1f2f4, 0.5), dark = mat(0x22252b, 0.5, 0.3), panel = mat(0x1b2f6b, 0.25, 0.4), red = mat(0xd3372c, 0.4);
  const mast = part("Mast");
  rod(mast, [0, 0.32, 0], [0, 1.9, 0], 0.016, alu, 16);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; rod(mast, [0, 0.62, 0], [0.42 * Math.cos(a), 0, 0.42 * Math.sin(a)], 0.011, alu, 12); }
  rod(mast, [-0.3, 1.86, 0], [0.3, 1.86, 0], 0.01, alu, 12);
  const cups = part("Anemometer");
  const hub = new THREE.Group();
  hub.position.set(-0.3, 0, 0);
  cups.add(hub);
  rod(hub, [0, 1.86, 0], [0, 1.97, 0], 0.006, dark, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2, c: V3 = [0.075 * Math.cos(a), 1.97, 0.075 * Math.sin(a)];
    rod(hub, [0, 1.97, 0], c, 0.003, alu, 8);
    add(hub, new THREE.SphereGeometry(0.026, 20, 12, 0, Math.PI), dark, ...c).rotation.y = -a;
  }
  const vane = part("Wind vane");
  const swivel = new THREE.Group();
  swivel.position.set(0.3, 0, 0);
  vane.add(swivel);
  rod(swivel, [0, 1.86, 0], [0, 1.98, 0], 0.006, dark, 10);
  rod(swivel, [-0.1, 1.98, 0], [0.1, 1.98, 0], 0.004, alu, 8);
  add(swivel, box(0.07, 0.07, 0.003), red, 0.11, 1.98, 0);
  add(swivel, cyl(0.001, 0.03, 12, 0.008), red, -0.11, 1.98, 0).rotation.z = Math.PI / 2;
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
  const beacon = add(logger, box(0.008, 0.008, 0.003), mat(0x35d07f, 0.4, 0, { emissive: 0x35d07f, emissiveIntensity: 0.2 }), -0.05, 0.9, -0.1315);
  const gauge = part("Rain gauge");
  rod(gauge, [0, 1.25, 0], [-0.2, 1.25, 0], 0.008, alu, 10);
  add(gauge, cyl(0.045, 0.16, 32, 0.06), white, -0.2, 1.3, 0);
  // A patch of mown grass, with the tripod's feet staked into it.
  const grass = paint(512, 512, (g) => {
    g.fillStyle = "#3f6b34"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const s = (i * 9301 + 49297) % 233280, x = (s / 233280) * 512, y = (((i * 7919) % 512) + (s % 7)) % 512; g.fillStyle = i % 3 ? "rgba(120,170,90,0.35)" : "rgba(20,45,20,0.35)"; g.fillRect(x, y, 1.5, 5); }
  });
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(0.7, 64), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  setting().add(lawn);
  for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + 0.5; add(setting(), box(0.05, 0.012, 0.05), dark, 0.42 * Math.cos(a), 0.006, 0.42 * Math.sin(a)).castShadow = true; }
  live((t) => {
    hub.rotation.y = -t * 5.5;
    swivel.rotation.y = 0.32 * Math.sin(t * 0.8) + 0.12 * Math.sin(t * 2.3);
    glow(beacon).emissiveIntensity = t > 0 && t % 2 < 0.12 ? 3 : 0.2;
  });
}

// Space: a one-unit CubeSat on a shaker table's fixture plate. Rails, four solar panels, the board stack
// inside, and antennas on top. Every few seconds the table runs a burst, the way a vibration test does.
function cubesat(THREE: Three, { root, part, add, box, cyl, beam, rod, mat, live, setting }: Kit) {
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
  // The fixture plate, bolted to the shaker: a steel ring with a hole for the camera.
  const S = setting(), plate = new THREE.Group();
  S.add(plate);
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.1, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.022, 0, Math.PI * 2, true); ring.holes.push(hole);
  const ringGeo = new THREE.ExtrudeGeometry(ring, { depth: 0.014, bevelEnabled: true, bevelSize: 0.0012, bevelThickness: 0.0012, bevelSegments: 2, curveSegments: 48 });
  ringGeo.rotateX(-Math.PI / 2);
  add(plate, ringGeo, mat(0x4a4f57, 0.42, 0.9), 0, -0.0152, 0);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; add(plate, cyl(0.0045, 0.004, 16), mat(0x1d1f24, 0.4, 0.8), 0.085 * Math.cos(a), 0.0008, 0.085 * Math.sin(a)).castShadow = true; }
  live((t) => {
    const p = t % 6, on = p > 1.5 && p < 4.5 ? Math.sin(Math.PI * ((p - 1.5) / 3)) : 0;
    const y = 0.0009 * on * Math.sin(t * 2 * Math.PI * 23), x = 0.0004 * on * Math.sin(t * 2 * Math.PI * 17 + 1);
    root.position.set(x, y, 0);
    plate.position.set(x, y, 0);
  });
}

// Health and medicine: a 3D-printed prosthetic hand. Each finger is three hinged pieces; the tendons pull them closed into a grip, and let go.
function hand(THREE: Three, { part, add, box, cyl, mat, live }: Kit) {
  // Printed in a bright colour, as these usually are: the wearer picks it.
  const pla = mat(0x2f86d6, 0.5), joint = mat(0x1c2a44, 0.5), pin = mat(0xc9ced6, 0.3, 1), strap = mat(0x22252b, 0.75), cord = mat(0xf2c21a, 0.6);
  add(part("Palm"), box(0.082, 0.09, 0.026), pla, 0, 0.135, 0);
  const joints: { g: Group; rest: number; k: number }[] = [];
  const finger = (name: string, x: number, y: number, lens: number[], curl: number, lean = 0, k = 1) => {
    const g = part(name);
    let at = new THREE.Group();
    at.position.set(x, y, 0); at.rotation.z = lean;
    g.add(at);
    lens.forEach((len, i) => {
      const seg = new THREE.Group();
      seg.rotation.x = curl * (i === 0 ? 0.6 : 1);
      joints.push({ g: seg, rest: seg.rotation.x, k: k * (i === 0 ? 0.7 : 1) });
      at.add(seg);
      const m = new THREE.Mesh(box(0.0165, len, 0.017 - i * 0.002), pla); m.position.y = len / 2 + 0.002; seg.add(m);
      const kn = new THREE.Mesh(cyl(0.006, 0.019, 16), joint); kn.rotation.z = Math.PI / 2; seg.add(kn);
      const t = new THREE.Mesh(box(0.002, len, 0.002), cord); t.position.set(0, len / 2 + 0.002, -0.0095); seg.add(t);
      const next = new THREE.Group(); next.position.y = len + 0.004; seg.add(next); at = next;
    });
  };
  finger("Index finger", -0.03, 0.184, [0.036, 0.026, 0.02], 0.22);
  finger("Middle finger", -0.01, 0.186, [0.04, 0.028, 0.021], 0.3);
  finger("Ring finger", 0.01, 0.184, [0.037, 0.026, 0.02], 0.38);
  finger("Little finger", 0.03, 0.178, [0.029, 0.021, 0.017], 0.46);
  finger("Thumb", -0.047, 0.118, [0.034, 0.027], 0.3, 0.95, 0.6);
  const cuff = part("Wrist cuff");
  add(cuff, box(0.072, 0.07, 0.03), pla, 0, 0.05, 0);
  add(cuff, cyl(0.004, 0.084, 12), pin, 0, 0.088, 0).rotation.z = Math.PI / 2;
  for (const y of [0.034, 0.064]) add(cuff, box(0.076, 0.012, 0.034), strap, 0, y, 0);
  add(cuff, cyl(0.03, 0.012, 40), pla, 0, 0.006, 0);
  live((t) => {
    // Close over a second, hold, open: a wrist flex pulling the tendons.
    const p = t % 4, grip = p < 1.2 ? easeOut(p / 1.2) : p < 2.4 ? 1 : 1 - easeOut((p - 2.4) / 1.2);
    for (const j of joints) j.g.rotation.x = j.rest + grip * 0.85 * j.k;
  });
}

// Business: a coffee cart, the kind a student venture sells from on the quad. On the paving, steam rising off the machine.
function cart(THREE: Three, { part, add, box, cyl, rod, mat, live, setting, paint, puffs }: Kit) {
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
  // Paving slabs on the quad.
  const slabs = paint(512, 512, (g) => {
    g.fillStyle = "#6e6a64"; g.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const v = 150 + ((r * 31 + c * 17) % 5) * 8; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(c * 64 + 3, r * 64 + 3, 58, 58); }
  });
  slabs.wrapS = slabs.wrapT = THREE.RepeatWrapping; slabs.repeat.set(2.4, 1.8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshStandardMaterial({ map: slabs, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2;
  setting().add(ground);
  const steam = puffs(setting(), 16, 0xf4f4f2);
  live((t) => {
    steam.forEach((m, i) => {
      const life = 3.2, age = (t + (i / steam.length) * life) % life;
      m.visible = true;
      m.position.set(-0.24 + 0.04 * Math.sin(age * 1.7 + i), 1.4 + 0.16 * age, -0.16 + 0.03 * Math.cos(age * 1.3 + i));
      m.scale.setScalar(0.05 + 0.11 * age);
      m.material.opacity = 0.4 * (1 - age / life) * clamp01(age * 3);
    });
  });
}

// Design and arts: a lounge chair cut from one sheet of plywood, slotted together without screws. On a rug.
function chair(THREE: Three, { part, add, box, beam, mat, setting, paint }: Kit) {
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
  // A flat-woven rug.
  const weave = paint(512, 512, (g) => {
    g.fillStyle = "#c9c2b4"; g.fillRect(0, 0, 512, 512);
    ["#3c4a5c", "#b8573d", "#3c4a5c"].forEach((c, i) => { g.fillStyle = c; g.fillRect(0, 120 + i * 120, 512, 22); });
    for (let y = 0; y < 512; y += 4) { g.fillStyle = y % 8 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"; g.fillRect(0, y, 512, 2); }
  });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.15), new THREE.MeshStandardMaterial({ map: weave, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  setting().add(rug);
}

// Media and communication: the camera a documentary was shot on, on its tripod, with a shotgun mic. Rolling: it pans, the tally light blinks.
function camera(THREE: Three, { part, add, box, cyl, rod, mat, live }: Kit) {
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
  live((t) => {
    // A slow pan across the scene and back, everything above the tripod turning about the head's axis.
    for (const g of [head, body, lens, mic]) g.rotation.y = 0.34 * Math.sin(t * 0.38);
    red.emissiveIntensity = t > 0 && t % 1 > 0.5 ? 0.12 : 1.8;
  });
}

// Social sciences and policy: a survey's results as a chart you can hold. Two series of bars on a base, rising from zero to the data.
function chart(THREE: Three, { part, add, box, mat, live }: Kit) {
  const base = mat(0x2a2d34, 0.55, 0.2), back = mat(0xf1f2f4, 0.6), rule = mat(0xb9bbb6, 0.6), a = mat(0x1d7f8c, 0.45), b = mat(0xe8833a, 0.45);
  const stand = part("Base");
  add(stand, box(0.24, 0.008, 0.11), base, 0, 0.004, 0);
  const wall = part("Scale");
  add(wall, box(0.24, 0.15, 0.004), back, 0, 0.083, -0.053);
  for (let i = 1; i <= 4; i++) add(wall, box(0.23, 0.0012, 0.001), rule, 0, 0.008 + i * 0.03, -0.0505);
  // Share of income spent on rent, by year of study: students living on campus, and off.
  const on = [0.034, 0.041, 0.045, 0.052, 0.058], off = [0.052, 0.068, 0.081, 0.097, 0.118];
  const sa = part("On campus"), sb = part("Off campus");
  const bars = [
    ...on.map((h, i) => ({ m: add(sa, box(0.024, h, 0.024), a, -0.088 + i * 0.044, 0.008 + h / 2, 0.022), h, d: i * 0.12 })),
    ...off.map((h, i) => ({ m: add(sb, box(0.024, h, 0.024), b, -0.088 + i * 0.044, 0.008 + h / 2, -0.016), h, d: 0.06 + i * 0.12 })),
  ];
  live((t) => {
    // Hold the finished chart, then build it again from zero, bar by bar. (t = 0 is the finished chart.)
    const p = (t + 6.5) % 8.5;
    for (const { m, h, d } of bars) {
      const k = p < 2 ? easeOut((p - d) / 0.8) : 1;
      m.scale.y = Math.max(0.001, k);
      m.position.y = 0.008 + (h * Math.max(0.001, k)) / 2;
    }
  });
}

// Education: a tactile fraction kit. One whole, then the same length cut into halves, thirds, quarters
// and sixths. The pieces hop in turn, row by row: every row is the same length.
function blocks(THREE: Three, { part, add, box, mat, live }: Kit) {
  const tray = part("Tray"), wood = mat(0xd9b888, 0.7), L = 0.24, D = 0.026, T = 0.014;
  add(tray, box(L + 0.03, 0.006, 5 * (D + 0.006) + 0.03), wood, 0, 0.003, 0);
  for (const z of [-1, 1]) add(tray, box(L + 0.03, 0.014, 0.008), wood, 0, 0.013, z * (2.5 * (D + 0.006) + 0.011));
  for (const x of [-1, 1]) add(tray, box(0.008, 0.014, 5 * (D + 0.006) + 0.03), wood, x * (L / 2 + 0.011), 0.013, 0);
  const pieces: { m: Mesh; y: number; d: number }[] = [];
  [["Whole", 1, 0xd3372c], ["Halves", 2, 0xe8833a], ["Thirds", 3, 0xe2b93b], ["Quarters", 4, 0x35a36b], ["Sixths", 6, 0x2f6fde]].forEach(([name, n, color], row) => {
    const g = part(name as string), m = mat(color as number, 0.5), w = L / (n as number);
    for (let i = 0; i < (n as number); i++) {
      const y = 0.006 + T / 2, piece = add(g, box(w - 0.002, T, D), m, -L / 2 + w / 2 + i * w, y, (row - 2) * (D + 0.006));
      pieces.push({ m: piece, y, d: row * 0.5 + i * 0.08 });
    }
  });
  live((t) => {
    const p = t % 5;
    for (const { m, y, d } of pieces) { const u = (p - d) / 0.42; m.position.y = y + (u > 0 && u < 1 ? 0.014 * Math.sin(Math.PI * u) : 0); }
  });
}
