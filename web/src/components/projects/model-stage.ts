import type * as THREE_NS from "three";
import type { OrbitControls as Controls } from "three/examples/jsm/controls/OrbitControls.js";
import type { RoomEnvironment as Room } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EDGE_LIMIT, cameraFor, explodeOffsets, fitDistance, type Look, type V3, type ViewId } from "@/lib/model-view";

// The 3D viewer's stage (model-viewer.tsx is its shell): given any three.js object, it lights it like
// a product photo (an environment map for soft fill, one key light, a soft shadow on the ground),
// frames it, and lets you look around. It draws only when something changes: a drag, a camera move,
// a slow turn. A still model costs nothing, so a page can hold several.
// A model can also come alive (sample-models.ts): `userData.live` moves it with time and
// `userData.setting` is the world it stands in. It plays only in the normal look with the parts
// together, and only while on screen; explode, see-through and blueprint show it at rest.
// three.js is passed in: the shell loads it on demand, so this file adds nothing to pages without a model.

type Three = typeof THREE_NS;
type Obj = THREE_NS.Object3D;
type Mesh = THREE_NS.Mesh;
export type Libs = { OrbitControls: typeof Controls; RoomEnvironment: typeof Room };
export type Stage = { live: boolean; setView(id: ViewId): void; setLook(look: Look): void; setExplode(amount: number): void; setSpin(on: boolean): void; setPlay(on: boolean): void; setFull(on: boolean): void; dispose(): void };
type Live = (t: number) => void;

const meshesOf = (o: Obj): Mesh[] => { const out: Mesh[] = []; o.traverse((c) => { if ((c as Mesh).isMesh) out.push(c as Mesh); }); return out; };
const trianglesOf = (m: Mesh) => Math.floor((m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute("position")?.count ?? 0) / 3);

/** A model's parts, for exploding: the first level of the tree that branches (an assembly's
 *  components), or its meshes when the tree never does. */
export function partsOf(o: Obj): Obj[] {
  let node = o;
  while (!(node as Mesh).isMesh && node.children.length === 1) node = node.children[0];
  if (!(node as Mesh).isMesh && node.children.length > 1) return node.children.filter((c) => meshesOf(c).length > 0);
  return meshesOf(o);
}

/** What the readout shows. Needs no WebGL, so it works where the picture can't be drawn. */
export function measure(THREE: Three, object: Obj): { size: V3; triangles: number; parts: number } {
  object.updateMatrixWorld(true);
  const s = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  const fin = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
  return { size: [fin(s.x), fin(s.y), fin(s.z)], triangles: meshesOf(object).reduce((n, m) => n + trianglesOf(m), 0), parts: partsOf(object).length };
}

/** Put `object` on a stage inside `el`. Throws if the browser can't start WebGL. */
export function createStage(THREE: Three, { OrbitControls, RoomEnvironment }: Libs, el: HTMLElement, object: Obj, opts: { spin: boolean; coarse: boolean; still: boolean; snug?: boolean; dimText: [string, string, string]; onSpin: (on: boolean) => void }): Stage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  el.appendChild(canvas);

  // The model, centred on the origin with its base on the ground.
  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  pivot.add(object);
  scene.add(pivot);
  pivot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(pivot);
  const size = box.getSize(new THREE.Vector3());
  pivot.position.sub(box.getCenter(new THREE.Vector3()));
  pivot.updateMatrixWorld(true);
  const radius = Math.max(size.length() / 2, 1e-6); // the sphere the model fits in
  const meshes = meshesOf(object);
  for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; }
  // The world it stands in, in the model's own coordinates (so it shares the pivot), outside what's measured.
  const setting = object.userData.setting as THREE_NS.Group | undefined;
  if (setting) { pivot.add(setting); setting.traverse((c) => { if ((c as Mesh).isMesh) (c as Mesh).receiveShadow = true; }); }
  const live: Live[] = (object.userData.live as Live[] | undefined) ?? [];

  // Light: a soft room all around (reflections and fill), one key light for shape and the shadow.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(0.9, 2.1, 1.3).multiplyScalar(radius * 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 7;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -radius * 2.6; sc.right = sc.top = radius * 2.6; sc.near = radius * 0.1; sc.far = radius * 12;
  scene.add(key);
  // A rim light from behind and above: it outlines the silhouette, so a dark part reads against the backdrop.
  const rim = new THREE.DirectionalLight(0xffffff, 1.15);
  rim.position.set(-1.3, 1.5, -1.7).multiplyScalar(radius * 2);
  scene.add(rim);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(radius * 14, radius * 14), new THREE.ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -size.y / 2 - radius * 0.002; // a hair under the base, so it never shows through
  ground.receiveShadow = true;
  scene.add(ground);
  // The page's text colour, for drawings and the floor.
  const ink = () => { const c = new THREE.Color(0x8a8f98); try { c.setStyle(getComputedStyle(el).color); } catch { /* keep the grey */ } return c; };
  // A pool of light on the floor under the model, in the page's ink colour at a whisper, so it stands somewhere.
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"), hex = ink().getHex(); // sRGB, as a canvas wants
    if (g) { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},0.09)`); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }
    return new THREE.CanvasTexture(c);
  })();
  const pool = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.9, 48), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = ground.position.y + radius * 0.001;
  pool.renderOrder = -1;
  scene.add(pool);

  const camera = new THREE.PerspectiveCamera(35, 1, radius / 50, radius * 80);
  const dims: V3 = [size.x, size.y, size.z];
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.autoRotate = opts.spin;
  controls.autoRotateSpeed = 1.1;
  controls.minDistance = radius * 0.6;
  controls.maxDistance = radius * 14;
  controls.target.set(0, 0, 0);

  // Draw on demand. A frame is asked for by a drag, a camera move, a resize or the slow turn; once
  // nothing is changing the loop stops.
  let raf = 0, need = true, inTick = false, shown = true, gone = false;
  // Play: time runs while it's on, in the normal look with the parts together. Off, or under another
  // look, the model holds its rest pose (t = 0).
  let playing = live.length > 0 && !opts.still, simT = 0, last = 0;
  const simOn = () => playing && look === "solid" && exTo === 0 && exNow === 0;
  const rest = () => { if (simT !== 0) { simT = 0; for (const f of live) f(0); need = true; } };
  let move: { from: V3; to: V3; t0: number } | null = null;
  let exNow = 0, exTo = 0; // how far apart the parts are, and where that's heading
  const ask = () => { need = true; if (!raf && !inTick && shown && !gone) raf = requestAnimationFrame(tick); };
  function tick(t: number) {
    raf = 0; inTick = true;
    let moving = false;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
    last = t;
    if (simOn()) { simT += dt; for (const f of live) f(simT); need = true; }
    if (move) {
      const k = Math.min(1, (t - move.t0) / 450), e = 1 - (1 - k) ** 3;
      // Turn around the model rather than cutting through it: blend the direction and the distance apart.
      const a = new THREE.Vector3(...move.from), b = new THREE.Vector3(...move.to);
      const dist = a.length() + (b.length() - a.length()) * e;
      const dir = a.normalize().lerp(b.normalize(), e);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0.01);
      camera.position.copy(dir.normalize().multiplyScalar(dist));
      controls.target.multiplyScalar(1 - e);
      moving = k < 1;
      if (!moving) move = null;
      need = true;
    }
    if (exNow !== exTo) {
      exNow = opts.still || Math.abs(exTo - exNow) < 0.004 ? exTo : exNow + (exTo - exNow) * 0.2;
      place(exNow);
      drawing.visible = look === "blueprint" && exNow < 0.02;
      moving = moving || exNow !== exTo;
      need = true;
    }
    const changed = controls.update();
    if (need || changed) { renderer.render(scene, camera); need = false; }
    inTick = false;
    if ((moving || changed || controls.autoRotate || simOn()) && shown && !gone) raf = requestAnimationFrame(tick);
    else last = 0; // the clock stops with the loop, so a pause doesn't count as played time
  }
  controls.addEventListener("change", ask);
  controls.addEventListener("start", () => { move = null; if (controls.autoRotate) { controls.autoRotate = false; opts.onSpin(false); } });

  const fit = () => {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ask();
  };
  fit();
  camera.position.set(...cameraFor("angled", dims, camera.aspect)).multiplyScalar(opts.snug ? 0.88 : 1);
  const ro = new ResizeObserver(fit);
  ro.observe(el);
  // Off screen, it rests.
  const io = new IntersectionObserver(([e]) => { shown = e.isIntersecting; if (shown) ask(); });
  io.observe(el);

  // Looks. See-through: the surfaces fade and every hard edge is drawn, the way a CAD tool shows
  // hidden lines. Blueprint: a line drawing on blue paper, hidden lines removed, with the model's
  // overall dimensions drawn in.
  type Kept = { mesh: Mesh; solid: THREE_NS.Material | THREE_NS.Material[]; ghost?: THREE_NS.Material | THREE_NS.Material[]; edges?: THREE_NS.LineSegments<THREE_NS.BufferGeometry, THREE_NS.LineBasicMaterial> };
  const kept: Kept[] = meshes.map((mesh) => ({ mesh, solid: mesh.material }));
  const total = meshes.reduce((n, m) => n + trianglesOf(m), 0);
  const PAPER = 0x17468a, LINE = 0xeef4ff;
  let look: Look = "solid";
  let paper: THREE_NS.MeshBasicMaterial | undefined, wire: THREE_NS.MeshBasicMaterial | undefined;
  const ghostOf = (m: THREE_NS.Material) => { const g = m.clone(); g.transparent = true; g.opacity = 0.14; g.depthWrite = false; return g; };

  // The blueprint's dimensions: a line along each of the box's three sides, set off from the model
  // with extension lines and end ticks, and its length written beside it. Built the first time it's shown.
  const drawing = new THREE.Group();
  drawing.visible = false;
  scene.add(drawing);
  function draw() {
    if (drawing.children.length) return;
    const hx = size.x / 2, hy = size.y / 2, hz = size.z / 2, gap = radius * 0.17, t = radius * 0.03;
    const pts: number[] = [];
    const seg = (a: V3, b: V3) => { pts.push(...a, ...b); };
    const zf = hz + gap, xr = hx + gap, xl = -hx - gap;
    // Width, along the front of the base.
    seg([-hx, -hy, zf], [hx, -hy, zf]); seg([-hx, -hy, hz + t], [-hx, -hy, zf + t]); seg([hx, -hy, hz + t], [hx, -hy, zf + t]);
    // Depth, along the right of the base.
    seg([xr, -hy, -hz], [xr, -hy, hz]); seg([hx + t, -hy, -hz], [xr + t, -hy, -hz]); seg([hx + t, -hy, hz], [xr + t, -hy, hz]);
    // Height, up the front left corner.
    seg([xl, -hy, hz], [xl, hy, hz]); seg([-hx - t, -hy, hz], [xl - t, -hy, hz]); seg([-hx - t, hy, hz], [xl - t, hy, hz]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    drawing.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: LINE, transparent: true, opacity: 0.8 })));
    const label = (text: string, at: V3) => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 128;
      const g = c.getContext("2d");
      if (!g) return;
      g.font = "600 60px ui-sans-serif, system-ui, -apple-system, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#eef4ff";
      g.fillText(text, 256, 68);
      const map = new THREE.CanvasTexture(c);
      map.colorSpace = THREE.SRGBColorSpace;
      // The same size on screen whatever the model's size or the zoom, like lettering on a drawing.
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false, sizeAttenuation: false }));
      sp.scale.set(0.2, 0.05, 1);
      sp.position.set(...at);
      sp.renderOrder = 10;
      drawing.add(sp);
    };
    label(opts.dimText[0], [0, -hy, zf + gap * 0.5]);
    label(opts.dimText[2], [xr + gap * 0.95, -hy, 0]);
    label(opts.dimText[1], [xl - gap * 0.95, 0, hz]);
  }
  // The dimensions sit outside the model, and exploded parts spread: both need a wider frame.
  const pad = () => (1 + 0.7 * exTo) * (look === "blueprint" ? 1.24 : 1) * (opts.snug ? 0.88 : 1);
  const offNow = (): V3 => [camera.position.x - controls.target.x, camera.position.y - controls.target.y, camera.position.z - controls.target.z];
  // Move to the same angle (or the one a view change is heading for), at the distance that frames it now.
  function reframe() {
    const off: V3 = move ? move.to : offNow();
    const k = (fitDistance(dims, off, camera.aspect) * pad()) / Math.max(Math.hypot(...off), 1e-9);
    const to: V3 = [off[0] * k, off[1] * k, off[2] * k];
    if (opts.still) { camera.position.set(...to); move = null; } else move = { from: offNow(), to, t0: performance.now() };
    ask();
  }

  // Exploding: each part's place when together, in the world, and where its own centre is.
  const parts = partsOf(object).map((node) => {
    const c = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
    return { node, home: node.position.clone(), world: node.getWorldPosition(new THREE.Vector3()), center: [c.x, c.y, c.z] as V3 };
  });

  function place(amount: number) {
    const off = explodeOffsets(parts.map((p) => p.center), amount, radius);
    parts.forEach((p, i) => {
      if (!amount || !p.node.parent) { p.node.position.copy(p.home); return; }
      p.node.position.copy(p.node.parent.worldToLocal(p.world.clone().add(new THREE.Vector3(...off[i]))));
    });
  }

  const setTouch = (full: boolean) => { canvas.style.touchAction = opts.coarse && !full ? "pan-y" : "none"; };
  setTouch(false);
  // Zoom and pan are for full screen: inline, the wheel scrolls the page and a phone's pinch zooms it.
  controls.enableZoom = false;
  controls.enablePan = false;

  return {
    live: live.length > 0,
    setView(id) {
      const p = cameraFor(id, dims, camera.aspect), k = pad(), to: V3 = [p[0] * k, p[1] * k, p[2] * k];
      if (opts.still) { camera.position.set(...to); controls.target.set(0, 0, 0); move = null; }
      else move = { from: offNow(), to, t0: performance.now() };
      ask();
    },
    setLook(next) {
      if (next !== "solid") rest();
      look = next;
      if (setting) setting.visible = next === "solid";
      pool.visible = next !== "blueprint";
      const lines = next !== "solid" && total <= EDGE_LIMIT;
      for (const k of kept) {
        if (next === "ghost") k.mesh.material = k.ghost ??= Array.isArray(k.solid) ? k.solid.map(ghostOf) : ghostOf(k.solid);
        else if (next === "blueprint") {
          // Faces the colour of the paper hide the lines behind them. A model too heavy for an edge
          // drawing shows its triangles instead.
          k.mesh.material = lines
            ? (paper ??= new THREE.MeshBasicMaterial({ color: PAPER, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }))
            : (wire ??= new THREE.MeshBasicMaterial({ color: LINE, wireframe: true, transparent: true, opacity: 0.5 }));
        } else k.mesh.material = k.solid;
        if (lines && !k.edges) {
          // Rounded boxes keep their sharp size for the drawing: crisp edges, not the rounding's facets.
          const sharp = k.mesh.geometry.userData.sharp as V3 | undefined, src = sharp ? new THREE.BoxGeometry(...sharp) : k.mesh.geometry;
          k.edges = new THREE.LineSegments(new THREE.EdgesGeometry(src, 28), new THREE.LineBasicMaterial({ transparent: true }));
          if (sharp) src.dispose();
          k.mesh.add(k.edges);
        }
        if (k.edges) {
          k.edges.visible = lines;
          k.edges.material.color.copy(next === "blueprint" ? new THREE.Color(LINE) : ink());
          k.edges.material.opacity = next === "blueprint" ? 0.95 : 0.85;
        }
        k.mesh.castShadow = next === "solid";
      }
      ground.visible = next !== "blueprint";
      if (next === "blueprint") draw();
      drawing.visible = next === "blueprint" && exNow < 0.02;
      reframe();
    },
    setExplode(amount) { if (amount > 0) rest(); exTo = Math.max(0, Math.min(1, amount)); reframe(); },
    setSpin(on) { controls.autoRotate = on && !opts.still; ask(); },
    setPlay(on) { playing = on && live.length > 0; ask(); },
    setFull(on) { controls.enableZoom = on; controls.enablePan = on; setTouch(on); fit(); },
    dispose() {
      gone = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      controls.dispose();
      const drop = (m: THREE_NS.Material | THREE_NS.Material[] | undefined) => (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose());
      for (const k of kept) { k.mesh.geometry.dispose(); drop(k.solid); drop(k.ghost); if (k.edges) { k.edges.geometry.dispose(); drop(k.edges.material); } }
      ground.geometry.dispose(); drop(ground.material); drop(paper); drop(wire);
      pool.geometry.dispose(); drop(pool.material); glowTex.dispose();
      setting?.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh && !(o as THREE_NS.Line).isLine && !(o as THREE_NS.Sprite).isSprite) return;
        if (!(o as THREE_NS.Sprite).isSprite) m.geometry.dispose(); // sprites share one built-in quad
        for (const x of Array.isArray(m.material) ? m.material : [m.material]) { (x as THREE_NS.MeshStandardMaterial).map?.dispose(); x.dispose(); }
      });
      drawing.traverse((o) => {
        const d = o as THREE_NS.LineSegments & THREE_NS.Sprite;
        if (d.isLineSegments) { d.geometry.dispose(); drop(d.material); }
        if (d.isSprite) { d.material.map?.dispose(); d.material.dispose(); }
      });
      env.dispose(); pmrem.dispose(); room.dispose();
      renderer.dispose();
      // Hand the context back now: browsers only allow a handful of 3D views at once.
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
