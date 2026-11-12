"use client";
import { useEffect, useRef } from "react";

// The orb on the landing page's agent section (Linear FIX-92): everything a member builds flows into
// one place. A sphere of brass particles (the logo's seam colours), breathing and slowly turning,
// with a pulse when `pulse` changes. Plain 2D canvas, no 3D library. Decorative (aria-hidden). It
// draws only while on screen, and holds still for people who ask for reduced motion.
// tone: "dark" for a dark band (the agent section); "auto" follows the page's theme, with deeper amber
// on light backgrounds (pale gold vanishes on off-white), checked once a second so a theme switch shows.
// "mono": a glossy black sphere with silver particles on its face, for the black-and-white sections; it
// reads on both themes (a soft shadow under it on light pages, a faint rim on dark ones).
export function Orb({ pulse = 0, className, tone = "dark" }: { pulse?: number; className?: string; tone?: "dark" | "auto" | "mono" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kick = useRef(0);
  useEffect(() => { kick.current = 1; }, [pulse]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    // Points spread evenly over a sphere (a Fibonacci lattice), each with its own phase.
    // Fewer points for a small orb (an app card) or a phone.
    const N = Math.min(small ? 900 : 1600, Math.max(380, Math.round(canvas.clientWidth * canvas.clientHeight / 160)));
    let light = false, checked = 0;
    const readTone = () => {
      if (tone === "dark") return;
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
      light = m ? (0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16)) / 255 > 0.5 : false;
    };
    readTone();
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(th) * r, y, z: Math.sin(th) * r, ph: (i * 0.618) % (Math.PI * 2) };
    });
    let w = 0, h = 0, raf = 0, visible = true, t0 = performance.now();
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // The black orb: a lit sphere (highlight up and to the left, a rim of light round the edge), the
    // particles on its near face only, and a contact shadow on light pages.
    const mono = (t: number, R: number, cx: number, cy: number, ca: number, sa: number, ct: number, st: number) => {
      if (light) {
        const sh = ctx.createRadialGradient(cx, cy + R * 1.18, 0, cx, cy + R * 1.18, R * 0.95);
        sh.addColorStop(0, "rgba(0,0,0,0.22)"); sh.addColorStop(1, "rgba(0,0,0,0)");
        ctx.save(); ctx.translate(cx, cy + R * 1.18); ctx.scale(1, 0.22); ctx.translate(-cx, -(cy + R * 1.18));
        ctx.fillStyle = sh; ctx.fillRect(cx - R, cy + R * 0.2, R * 2, R * 2); ctx.restore();
      } else {
        const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, Math.min(R * 1.45, Math.min(w, h) / 2)); // ends inside the canvas, so no square edge
        halo.addColorStop(0, `rgba(255,255,255,${0.07 + kick.current * 0.08})`); halo.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
      }
      const body = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.45, R * 0.05, cx, cy, R * 1.02);
      body.addColorStop(0, "#4a4a50"); body.addColorStop(0.28, "#1d1d21"); body.addColorStop(0.7, "#0a0a0c"); body.addColorStop(1, "#000");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();
      // Rim light, strongest at the lower right, as if lit from behind.
      const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      rim.addColorStop(0, "rgba(255,255,255,0.10)"); rim.addColorStop(0.55, "rgba(255,255,255,0)"); rim.addColorStop(1, "rgba(255,255,255,0.32)");
      ctx.lineWidth = Math.max(1, R * 0.012); ctx.strokeStyle = rim; ctx.stroke();
      for (const p of pts) {
        const k = 1 + 0.035 * Math.sin(t * 1.3 + p.ph * 3) + 0.025 * Math.sin(t * 0.7 + p.y * 4);
        const x1 = (p.x * ca - p.z * sa) * k, z1 = (p.x * sa + p.z * ca) * k, y1 = p.y * k;
        const y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
        if (z2 < -0.05) continue; // behind the sphere
        const depth = Math.min(1, (z2 + 0.05) / 1.05);
        // Lit from the upper left: brighter where the surface faces the light.
        const lit = Math.max(0, (-x1 * 0.5 - y2 * 0.6 + z2 * 0.62));
        ctx.fillStyle = `rgba(255,255,255,${(0.05 + depth * 0.35 + lit * 0.45) * (k > 1.03 ? 1.15 : 1)})`;
        const s = 0.5 + depth * 1.1;
        ctx.fillRect(cx + x1 * R, cy + y2 * R, s, s);
      }
      // The specular highlight.
      const spec = ctx.createRadialGradient(cx - R * 0.36, cy - R * 0.44, 0, cx - R * 0.36, cy - R * 0.44, R * 0.42);
      spec.addColorStop(0, "rgba(255,255,255,0.22)"); spec.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    };
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      if (now - checked > 1000) { readTone(); checked = now; }
      kick.current *= 0.94;
      const R = Math.min(w, h) * (tone === "mono" ? 0.4 : 0.3) * (1 + kick.current * 0.08);
      const cx = w / 2, cy = h / 2, a = t * 0.18, ca = Math.cos(a), sa = Math.sin(a), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.clearRect(0, 0, w, h);
      if (tone === "mono") { mono(t, R, cx, cy, ca, sa, ct, st); if (visible && !reduce) raf = requestAnimationFrame(draw); return; }
      // A soft core, so the particles sit in light rather than on black.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
      g.addColorStop(0, `rgba(242,140,40,${(light ? 0.14 : 0.22) + kick.current * 0.2})`); g.addColorStop(0.5, `rgba(242,140,40,${light ? 0.04 : 0.06})`); g.addColorStop(1, "rgba(242,140,40,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        // Breathe: each point drifts in and out along its radius.
        const k = 1 + 0.06 * Math.sin(t * 1.3 + p.ph * 3) + 0.04 * Math.sin(t * 0.7 + p.y * 4);
        const x1 = (p.x * ca - p.z * sa) * k, z1 = (p.x * sa + p.z * ca) * k, y1 = p.y * k;
        const y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
        const depth = (z2 + 1) / 2; // 0 at the back, 1 at the front
        const hue = 28 + 22 * (1 - (p.y + 1) / 2); // amber at the bottom, gold at the top
        ctx.fillStyle = light ? `hsla(${hue - 6}, 90%, ${34 + depth * 16}%, ${0.12 + depth * 0.8})` : `hsla(${hue}, 95%, ${55 + depth * 30}%, ${0.15 + depth * 0.85})`;
        const s = 0.6 + depth * 1.4;
        ctx.fillRect(cx + x1 * R, cy + y2 * R, s, s);
      }
      if (visible && !reduce) raf = requestAnimationFrame(draw);
    };
    size();
    draw(t0 + 4000);
    const ro = new ResizeObserver(() => { size(); if (reduce) draw(t0 + 4000); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible && !reduce) { t0 = performance.now() - 4000; raf = requestAnimationFrame(draw); }
    });
    io.observe(canvas);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, [tone]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
