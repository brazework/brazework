"use client";
import { BoxSelect, Component, DraftingCompass, Loader2, Maximize2, Minimize2, Pause, Rotate3d } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { VIEWS, dimTexts, sizeLabel, trianglesLabel, type Look, type V3, type ViewId } from "@/lib/model-view";
import { extOf } from "@/lib/project-file-types";
import type { Stage } from "./model-stage";
import { SAMPLE_EXT, type SampleId } from "./sample-models";

// The 3D viewer: a member's uploaded model (STL, OBJ, GLB/glTF in one file, 3MF) or a built-in example,
// lit like a product photo, with what someone checking the work needs: set views, a see-through mode
// that shows the edges, a blueprint (a line drawing with the dimensions written on it), the model's
// size, its parts pulled apart, and full screen.
// - three.js and the model load only once the viewer nears the screen, and never twice (FIX-75).
// - It draws only while something moves (model-stage.ts), so a still model costs nothing.
// - Inline, the wheel and a phone's up-down drag still scroll the page; zoom and pan are for full screen.
// - Where WebGL can't start, it says so and still shows the model's size.
type State = "idle" | "ready" | "nogl" | "error";
type Info = { size: V3; triangles: number; parts: number };

export function ModelViewer({ url, name, sample, className }: { url?: string; name: string; sample?: SampleId; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [near, setNear] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [info, setInfo] = useState<Info | null>(null);
  const [view, setView] = useState<ViewId | null>("angled");
  const [look, setLook] = useState<Look>("solid");
  const [apart, setApart] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [native, setNative] = useState(false);
  const [pseudo, setPseudo] = useState(false);
  const full = native || pseudo;
  const ext = sample ? SAMPLE_EXT : extOf(name);

  // Load once, the first time it comes near the screen.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el || !near) return;
    let gone = false;
    (async () => {
      const THREE = await import("three");
      const [{ OrbitControls }, { RoomEnvironment }, { createStage, measure }] = await Promise.all([
        import("three/examples/jsm/controls/OrbitControls.js"), import("three/examples/jsm/environments/RoomEnvironment.js"), import("./model-stage"),
      ]);
      let object: import("three").Object3D;
      if (sample) object = (await import("./sample-models")).buildSample(THREE, sample);
      else {
        const res = await fetch(url ?? "");
        if (!res.ok) throw new Error("fetch");
        const buf = await res.arrayBuffer();
        // A plain surface for files that carry no materials of their own: light enough to read on
        // either theme, with a little sheen so curves show.
        const clay = () => new THREE.MeshStandardMaterial({ color: 0xd3d7de, metalness: 0.12, roughness: 0.5, side: THREE.DoubleSide });
        if (ext === "stl") {
          const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
          const geo = new STLLoader().parse(buf);
          geo.computeVertexNormals();
          object = new THREE.Mesh(geo, geo.hasAttribute("color") ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }) : clay());
        } else if (ext === "obj") {
          const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
          object = new OBJLoader().parse(new TextDecoder().decode(buf));
          object.traverse((c) => { if ((c as import("three").Mesh).isMesh) (c as import("three").Mesh).material = clay(); });
        } else if (ext === "3mf") {
          const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
          object = new ThreeMFLoader().parse(buf);
        } else {
          const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
          object = (await new GLTFLoader().parseAsync(buf, "")).scene;
        }
        // STL and 3MF from CAD tools are Z-up; stand them up the way three.js expects (Y-up).
        if (ext === "3mf" || ext === "stl") { const up = new THREE.Group(); object.rotation.x = -Math.PI / 2; up.add(object); object = up; }
      }
      if (gone) return;
      const m = measure(THREE, object);
      setInfo(m);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        stage.current = createStage(THREE, { OrbitControls, RoomEnvironment }, el, object, { spin: !still, coarse: window.matchMedia("(pointer: coarse)").matches, still, dimText: dimTexts(ext, m.size), onSpin: (on) => { setSpinning(on); setView(null); } });
        setSpinning(!still);
        setState("ready");
      } catch { setState("nogl"); }
    })().catch(() => { if (!gone) setState("error"); });
    return () => { gone = true; stage.current?.dispose(); stage.current = null; };
  }, [url, name, sample, near, ext]);

  // Full screen: the browser's own where it has one for elements, otherwise the viewer fills the window.
  useEffect(() => {
    const on = () => setNative(document.fullscreenElement === box.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  useEffect(() => { stage.current?.setFull(full); }, [full, state]);
  useEffect(() => {
    if (!pseudo) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPseudo(false); };
    const was = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", key);
    return () => { document.documentElement.style.overflow = was; window.removeEventListener("keydown", key); };
  }, [pseudo]);
  const toggleFull = async () => {
    const el = box.current;
    if (!el) return;
    if (pseudo) { setPseudo(false); return; }
    if (document.fullscreenElement === el) { await document.exitFullscreen().catch(() => {}); return; }
    try { await el.requestFullscreen(); } catch { setPseudo(true); }
  };

  const pick = (id: ViewId) => { setView(id); stage.current?.setView(id); };
  // See-through and Blueprint are two ways of drawing the same model: one at a time.
  const draw = (next: Look) => { const to = look === next ? "solid" : next; setLook(to); stage.current?.setLook(to); };
  const loading = near && state === "idle";
  const size = info ? sizeLabel(ext, info.size) : null;
  const tool = "grid size-8 place-items-center rounded-lg bg-surface/90 text-text-2 ring-1 ring-line transition hover:text-text aria-pressed:bg-accent aria-pressed:text-on-accent aria-pressed:ring-transparent";

  return (
    <div ref={box} data-state={loading ? "loading" : state} data-look={look} data-model-viewer=""
      className={cn("model-bg @container relative w-full overflow-hidden text-text [&:fullscreen]:rounded-none", pseudo ? "fixed inset-0 z-[200] h-dvh" : className ?? "aspect-[4/3] rounded-2xl border border-line")}>
      {/* The picture sits between the readout and the controls (two rows of them when the viewer is narrow), so neither covers the model. */}
      <div ref={host} className="absolute inset-x-0 top-9 bottom-[5.75rem] @md:bottom-12" role="img" aria-label={`3D model: ${name}. Drag to turn it.`} />

      {/* What it is, in numbers. Shown even where the picture can't be drawn. */}
      {info && size && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 flex max-w-[calc(100%-1.25rem)] flex-wrap gap-1.5 text-[11px] leading-none">
          <span className="rounded-md bg-surface/90 px-2 py-1.5 font-medium tabular-nums ring-1 ring-line" data-model-size="">{size.text} <span className="font-normal text-muted">{size.unit}</span></span>
          <span className="rounded-md bg-surface/90 px-2 py-1.5 text-muted tabular-nums ring-1 ring-line">{trianglesLabel(info.triangles)}</span>
          {sample && <span className="rounded-md bg-surface/90 px-2 py-1.5 text-muted ring-1 ring-line">Example model</span>}
        </div>
      )}

      {loading && <p className="absolute inset-0 grid place-items-center text-sm text-muted"><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Loading the model…</span></p>}
      {state === "error" && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">This model couldn&apos;t be previewed. Download it to open it in your CAD tool.</p>}
      {state === "nogl" && <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">3D isn&apos;t available in this browser.</p>}

      {state === "ready" && (
        <div className="absolute inset-x-2.5 bottom-2.5 flex flex-wrap items-end justify-between gap-2">
          <div role="group" aria-label="View" className="flex rounded-lg bg-surface/90 p-0.5 ring-1 ring-line">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => pick(v.id)} className="h-7 rounded-md px-2.5 text-xs text-text-2 transition hover:text-text aria-pressed:bg-accent aria-pressed:font-medium aria-pressed:text-on-accent">{v.label}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-1.5">
            <button type="button" aria-pressed={look === "ghost"} onClick={() => draw("ghost")} aria-label="See through" title="See through: fade the surfaces and show the edges" className={tool}><BoxSelect className="size-4" /></button>
            <button type="button" aria-pressed={look === "blueprint"} onClick={() => draw("blueprint")} aria-label="Blueprint" title="Blueprint: a line drawing with the dimensions on it" className={tool}><DraftingCompass className="size-4" /></button>
            {info && info.parts > 1 && <button type="button" aria-pressed={apart} onClick={() => { setApart(!apart); stage.current?.setExplode(apart ? 0 : 0.55); }} aria-label="Explode" title="Explode: pull the parts apart" className={tool}><Component className="size-4" /></button>}
            <button type="button" aria-pressed={spinning} onClick={() => { setSpinning(!spinning); stage.current?.setSpin(!spinning); }} aria-label="Turn slowly" title={spinning ? "Stop turning" : "Turn slowly"} className={tool}>{spinning ? <Pause className="size-4" /> : <Rotate3d className="size-4" />}</button>
            <button type="button" aria-pressed={full} onClick={toggleFull} aria-label="Full screen" title={full ? "Leave full screen" : "Full screen: zoom and pan"} className={tool}>{full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}</button>
          </div>
        </div>
      )}
    </div>
  );
}
