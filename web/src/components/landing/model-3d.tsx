"use client";
import { useEffect, useRef } from "react";
import { MODELS, project } from "./models";

// A project's build as a 3D wireframe you can turn (models.ts has the shapes). It turns slowly by
// itself; drag it to look around (sideways drags only on touch, so the page still scrolls), let go
// and it carries on from there. Same family as the orb and the globe: a plain 2D canvas, drawn in
// the colour of the text around it, nearer lines brighter. Decorative (aria-hidden: the card says
// what the project is in words). Draws only while on screen; holds still for reduced motion, though
// you can still turn it.
export function Model3D({ id, className, spin: when = "always" }: { id: string; className?: string; spin?: "always" | "hover" }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    const make = MODELS[id];
    if (!canvas || !ctx || !make) return;
    const m = make();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Radians per second. "hover": still until the pointer is over it (a page of cards stays calm).
    let spin = reduce || when === "hover" ? 0 : 0.35;
    let yaw = -0.6, pitch = 0.42;
    let w = 0, h = 0, raf = 0, last = 0, visible = false, drag: { x: number; y: number; id: number } | null = null;

    const size = () => {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);
      // The model's box is about ±1.2 wide; fit it to the shorter side.
      const s = Math.min(w / 2.9, h / 1.9), ox = w / 2, oy = h / 2;
      // Drawn in the colour of the text around it, whatever format the browser reports it in; depth
      // is the stroke's opacity.
      const ink = getComputedStyle(canvas).color || "#fff";
      ctx.lineCap = "round"; ctx.lineWidth = 1.1; ctx.strokeStyle = ink; ctx.fillStyle = ink;
      for (const [a, b] of m.edges) {
        const p = project(a, yaw, pitch), q = project(b, yaw, pitch);
        // Nearer lines are brighter, so the shape reads as solid while it turns.
        ctx.globalAlpha = 0.22 + 0.55 * ((p[2] + q[2]) / 2 + 1.2) / 2.4;
        ctx.beginPath(); ctx.moveTo(ox + p[0] * s, oy + p[1] * s); ctx.lineTo(ox + q[0] * s, oy + q[1] * s); ctx.stroke();
      }
      for (const d of m.dots) {
        const p = project(d, yaw, pitch);
        ctx.globalAlpha = 0.45 + 0.5 * (p[2] + 1.2) / 2.4;
        ctx.beginPath(); ctx.arc(ox + p[0] * s, oy + p[1] * s, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
      if (!drag) yaw += spin * dt;
      draw();
      raf = visible && (spin || drag) ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };

    // Dragging turns the model. The card it sits on is itself draggable (it flips the deck), so the
    // press stops here and never reaches the card.
    const down = (e: PointerEvent) => { e.stopPropagation(); drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; canvas.setPointerCapture(e.pointerId); kick(); };
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return;
      yaw += (e.clientX - drag.x) * 0.012;
      pitch = Math.max(-1.1, Math.min(1.1, pitch + (e.clientY - drag.y) * 0.008));
      drag = { ...drag, x: e.clientX, y: e.clientY };
      if (!raf) draw();
    };
    const up = (e: PointerEvent) => { if (drag?.id === e.pointerId) drag = null; };
    const over = () => { if (when === "hover" && !reduce) { spin = 0.6; kick(); } };
    const out = () => { if (when === "hover") spin = 0; };

    size(); draw();
    const ro = new ResizeObserver(() => { size(); draw(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: 0.1 });
    io.observe(canvas);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("pointerenter", over);
    canvas.addEventListener("pointerleave", out);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerenter", over); canvas.removeEventListener("pointerleave", out);
    };
  }, [id, when]);

  return <canvas ref={ref} aria-hidden="true" className={className} style={{ touchAction: "pan-y", cursor: "grab" }} />;
}
