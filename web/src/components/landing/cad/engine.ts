import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildModel, type BuildId, type Built } from "./models";

// The landing page's CAD lab (redesign 2026-11): one WebGL stage that shows a build three ways.
//   render   machined parts under a studio light, with CAD edge lines
//   section  cut down the middle so the inside shows (the shells are clipped)
//   stress   an FEA-style map, blue (low) to red (high), from each part's load
// It draws only while it's on screen and the tab is visible, turns slowly unless the visitor drags
// it, and stands still under reduced motion. Callout positions go back to the page every frame.
// Loaded on demand (cad-stage.tsx), so pages without the lab never download three.js.

export type Mode = "render" | "section" | "stress";
export type Lab = { setBuild(id: BuildId): void; setMode(m: Mode): void; setDark(dark: boolean): void; setActive(on: boolean): void; dispose(): void };
export type Place = (id: string, x: number, y: number, show: boolean, right: boolean) => void;

// Turbo, the perceptual rainbow used in FEA post-processing (Mikhailov, 2019), as a polynomial fit.
function turbo(t: number, out: THREE.Color) {
  t = Math.min(1, Math.max(0, t));
  const r = 0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943))));
  const g = 0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604))));
  const b = 0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973))));
  return out.setRGB(Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b)), THREE.SRGBColorSpace);
}

export function createLab(host: HTMLElement, opts: { build: BuildId; mode: Mode; dark: boolean; still: boolean; place: Place; onTime?: (t: number) => void }): Lab {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  const canvas = renderer.domElement;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "pan-y";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.85;

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3.5, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9bf, 0.9);
  rim.position.set(-5, 2.5, -4);
  scene.add(rim);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.28 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  // ---- The build on stage ----
  const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const stressMats = new Map<THREE.Mesh, THREE.Material>();
  let built: Built | null = null;
  let mode: Mode = opts.mode;
  let edgeColor = new THREE.Color(opts.dark ? 0x000000 : 0x0f1012);
  const edgeMat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.28 });
  const neutral = new THREE.MeshStandardMaterial({ color: 0x7d838c, metalness: 0.2, roughness: 0.6 });

  const original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const meshes = () => { const out: THREE.Mesh[] = []; built?.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };

  function stressMaterial(m: THREE.Mesh, f: (p: THREE.Vector3) => number) {
    const pos = m.geometry.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Values come from where the vertex sits on the part, in the part's own frame offset by its place.
      v.add(m.position);
      turbo(f(v), c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    m.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.05, roughness: 0.55 });
  }

  function applyMode() {
    if (!built) return;
    const shells = new Set(built.shells);
    for (const m of meshes()) {
      if (!original.has(m)) original.set(m, m.material);
      const base = original.get(m)!;
      let mat: THREE.Material | THREE.Material[] = base;
      if (mode === "stress") {
        const f = built.stress.get(m);
        if (f) { if (!stressMats.has(m)) stressMats.set(m, stressMaterial(m, f)); mat = stressMats.get(m)!; }
        else mat = neutral;
      }
      m.material = mat;
      const list = Array.isArray(mat) ? mat : [mat];
      for (const x of list) {
        const cutHere = mode === "section" && shells.has(m);
        x.clippingPlanes = cutHere ? [cut] : null;
        x.side = cutHere ? THREE.DoubleSide : THREE.FrontSide;
        x.needsUpdate = true;
      }
      const edges = m.children.find((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments | undefined;
      if (edges) {
        edges.visible = mode !== "stress";
      }
    }
    // Edge lines clip with their shell in the section view; the shared material is per-shell-cloned.
    for (const m of built.shells) {
      const e = m.children.find((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments | undefined;
      if (e) (e.material as THREE.LineBasicMaterial).clippingPlanes = mode === "section" ? [cut] : null;
    }
  }

  function disposeBuilt() {
    if (!built) return;
    pivot.remove(built.root);
    built.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    for (const m of original.values()) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    for (const m of stressMats.values()) m.dispose();
    original.clear();
    stressMats.clear();
    built = null;
  }

  let radius = 2;
  function setBuild(id: BuildId) {
    disposeBuilt();
    built = buildModel(id);
    // CAD edge lines on every part (creases over 28°), drawn softly over the shading.
    const shells = new Set(built.shells);
    built.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
      // A shell gets its own material, so cutting it never cuts a part that shares its finish.
      if (shells.has(m)) m.material = (m.material as THREE.Material).clone();
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), shells.has(m) ? edgeMat.clone() : edgeMat);
      lines.raycast = () => {};
      m.add(lines);
    });
    cut.normal.set(...(built.cut ?? [0, 0, -1])).normalize();
    sway = built.turn === "sway";
    if (built.theta !== undefined) { theta = built.theta; swayT = 0; }
    theta0 = theta;
    phi = built.phi ?? 1.18;
    pivot.add(built.root);
    built.animate(0);
    built.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(built.root);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    radius = sphere.radius * (built.room ?? 1);
    built.root.position.sub(new THREE.Vector3(sphere.center.x, box.min.y, sphere.center.z));
    ground.position.y = 0;
    pivot.position.y = 0;
    target.set(0, (box.max.y - box.min.y) / 2, 0);
    applyMode();
    frame();
  }

  // ---- Camera: orbit around the build, slow turn, drag to look ----
  const target = new THREE.Vector3();
  let theta = 0.6, phi = 1.18, vTheta = 0, sway = false, theta0 = 0.6, swayT = 0;
  let dragging = false, lastX = 0, lastY = 0;
  const onDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    vTheta = -dx * 0.006;
    theta += vTheta;
    if (e.pointerType === "mouse") phi = Math.min(1.45, Math.max(0.75, phi - dy * 0.004));
    wake();
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.style.cursor = "grab";

  const place = opts.place;
  const v = new THREE.Vector3();
  let w = 1, h = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  function frame() {
    const fit = (radius * 0.98) / Math.sin((camera.fov * Math.PI) / 360) / Math.min(1, camera.aspect * 0.95);
    camera.position.set(target.x + fit * Math.sin(phi) * Math.sin(theta), target.y + fit * Math.cos(phi), target.z + fit * Math.sin(phi) * Math.cos(theta));
    camera.lookAt(target);
    renderer.render(scene, camera);
    if (built) for (const [id, o] of Object.entries(built.anchors)) {
      o.getWorldPosition(v);
      v.project(camera);
      place(id, ((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h, v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05, v.x >= -0.05);
    }
  }

  // ---- The loop: only while visible ----
  // `active`: the page can park the stage (it sits behind another view) without tearing it down.
  let raf = 0, last = performance.now(), t = 0, onScreen = false, idleUntil = 0, active = true;
  const still = opts.still;
  function loop(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!still) {
      t += dt;
      if (!dragging) {
        vTheta *= 0.92;
        if (sway) { swayT += dt; theta0 += vTheta; theta = theta0 + 0.45 * Math.sin(swayT * 0.35); } else theta += vTheta + dt * 0.12;
      } else if (sway) theta0 = theta;
      built?.animate(t);
      opts.onTime?.(t);
    }
    frame();
    if (onScreen && active && !document.hidden && (!still || now < idleUntil)) raf = requestAnimationFrame(loop);
  }
  function wake() { idleUntil = performance.now() + 600; if (!raf && onScreen && active) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) wake(); }, { rootMargin: "100px" });
  io.observe(host);
  const onVis = () => { if (!document.hidden) wake(); };
  document.addEventListener("visibilitychange", onVis);

  setBuild(opts.build);
  resize();

  return {
    setBuild: (id) => { setBuild(id); wake(); },
    setMode: (m) => { mode = m; applyMode(); frame(); wake(); },
    setActive: (on) => { active = on; if (on) wake(); },
    setDark: (dark) => { edgeColor = new THREE.Color(dark ? 0x000000 : 0x0f1012); edgeMat.color = edgeColor; frame(); },
    dispose: () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      disposeBuilt();
      env.dispose(); pmrem.dispose(); edgeMat.dispose(); neutral.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
