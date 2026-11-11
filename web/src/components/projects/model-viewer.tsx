"use client";
import { Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { extOf } from "@/lib/project-file-types";

// An interactive 3D preview: drag to rotate, scroll or pinch to zoom, right-drag to pan. Reads STL,
// OBJ, GLB/glTF (single file) and 3MF. three.js loads only when a model is opened, so pages that
// never show one don't pay for it.
export function ModelViewer({ url, name, className }: { url: string; name: string; className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ reset: () => void; spin: (on: boolean) => void } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      const ext = extOf(name);
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch");
      const buf = await res.arrayBuffer();
      if (disposed) return;

      // Parse the file into one object to show.
      let object: import("three").Object3D;
      const material = new THREE.MeshStandardMaterial({ color: 0xb8c4d6, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide });
      if (ext === "stl") {
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const geo = new STLLoader().parse(buf);
        geo.computeVertexNormals();
        object = new THREE.Mesh(geo, geo.hasAttribute("color") ? new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide }) : material);
      } else if (ext === "obj") {
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
        object = new OBJLoader().parse(new TextDecoder().decode(buf));
        object.traverse((c) => { if ((c as import("three").Mesh).isMesh) (c as import("three").Mesh).material = material; });
      } else if (ext === "3mf") {
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        object = new ThreeMFLoader().parse(buf);
      } else {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const gltf = await new GLTFLoader().parseAsync(buf, "");
        object = gltf.scene;
      }
      if (disposed) return;

      // Scene, camera and lights; the model centred and scaled to fit.
      const scene = new THREE.Scene();
      // STL and 3MF from CAD tools are Z-up; stand them up the way three.js expects (Y-up).
      if (ext === "3mf" || ext === "stl") object.rotation.x = -Math.PI / 2;
      const pivot = new THREE.Group();
      pivot.add(object);
      scene.add(pivot);
      pivot.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(pivot);
      const size = box.getSize(new THREE.Vector3());
      pivot.position.sub(box.getCenter(new THREE.Vector3()));
      const radius = Math.max(size.x, size.y, size.z) || 1;

      scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(1, 2, 1.5).multiplyScalar(radius * 2);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x9fb4ff, 0.8);
      rim.position.set(-1.5, 0.5, -1).multiplyScalar(radius * 2);
      scene.add(rim);
      const grid = new THREE.GridHelper(radius * 3, 20, 0x5a6478, 0x343b4a);
      grid.position.y = -size.y / 2 - radius * 0.004; // just under the model, so it never shows through the base
      (grid.material as import("three").Material).transparent = true;
      (grid.material as import("three").Material).opacity = 0.45;
      scene.add(grid);

      const camera = new THREE.PerspectiveCamera(40, el.clientWidth / Math.max(1, el.clientHeight), radius / 100, radius * 100);
      const home = new THREE.Vector3(radius * 1.7, radius * 1.1, radius * 1.9);
      camera.position.copy(home);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(el.clientWidth, el.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      el.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = "none";

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.6;
      controls.target.set(0, 0, 0);
      controls.addEventListener("start", () => { controls.autoRotate = false; setSpinning(false); });

      api.current = {
        reset: () => { camera.position.copy(home); controls.target.set(0, 0, 0); controls.update(); },
        spin: (on) => { controls.autoRotate = on; },
      };

      const resize = new ResizeObserver(() => {
        camera.aspect = el.clientWidth / Math.max(1, el.clientHeight);
        camera.updateProjectionMatrix();
        renderer.setSize(el.clientWidth, el.clientHeight);
      });
      resize.observe(el);
      const tick = () => { controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(tick); };
      tick();
      setState("ready");

      cleanup = () => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        controls.dispose();
        scene.traverse((o) => {
          const m = o as import("three").Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((x) => x.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => { if (!disposed) setState("error"); });

    return () => { disposed = true; cleanup(); api.current = null; };
  }, [url, name]);

  return (
    <div className={className ?? "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_50%_0%,#1e2a4a,#070a12)]"}>
      <div ref={host} className="absolute inset-0" role="img" aria-label={`3D model: ${name}. Drag to rotate, scroll to zoom.`} />
      {state === "loading" && <div className="absolute inset-0 grid place-items-center text-sm text-white/70"><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading model…</span></div>}
      {state === "error" && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">This model couldn&apos;t be previewed. Download it to open it in your CAD tool.</div>}
      {state === "ready" && (
        <div className="absolute right-2 bottom-2 flex gap-1">
          <button type="button" onClick={() => { const on = !spinning; setSpinning(on); api.current?.spin(on); }} aria-label={spinning ? "Stop turning" : "Turn slowly"} title={spinning ? "Stop turning" : "Turn slowly"} className="grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
            {spinning ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </button>
          <button type="button" onClick={() => api.current?.reset()} aria-label="Reset the view" title="Reset the view" className="grid size-8 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65">
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      )}
      {state === "ready" && <span className="pointer-events-none absolute top-2 left-3 text-[11px] text-white/55">Drag to rotate · scroll to zoom</span>}
    </div>
  );
}
