"use client";
import { useEffect, useRef } from "react";

// The orb (Linear FIX-92): everything a member builds flows into one place. A sphere of particles,
// breathing and slowly turning, with a pulse when `pulse` changes. Plain 2D canvas, no 3D library.
// Decorative (aria-hidden). It draws only while on screen, and holds still for reduced motion.
// Black and white: silver-white particles on a dark background, graphite on a light one.
// tone: "dark" for a dark band (the agent section); "auto" follows the page's theme, checked once a
// second so a theme switch shows. `ember`: the particles warm to Ember's orange (the only colour on
// the landing, and it means Ember), fading over about half a second.
export function Orb({ pulse = 0, className, tone = "dark", ember = false }: { pulse?: number; className?: string; tone?: "dark" | "auto"; ember?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const kick = useRef(0);
  const warm = useRef(ember);
  useEffect(() => { kick.current = 1; }, [pulse]);
  useEffect(() => { warm.current = ember; }, [ember]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    // Points spread evenly over a sphere (a Fibonacci lattice), each with its own phase.
    // Fewer points for a small orb (an app card) or a phone.
    const N = Math.min(small ? 900 : 1600, Math.max(380, Math.round(canvas.clientWidth * canvas.clientHeight / 160)));
    let light = false, checked = 0, heat = warm.current ? 1 : 0;
    const readTone = () => {
      if (tone !== "auto") return;
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
    // Ember's orange (#f28c28), mixed into the neutral: white on dark, near-black on light.
    const EMBER = [242, 140, 40];
    const mix = (n: number[], k: number) => n.map((c, i) => Math.round(c + (EMBER[i] - c) * k)).join(",");
    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      if (now - checked > 1000) { readTone(); checked = now; }
      kick.current *= 0.94;
      heat += ((warm.current ? 1 : 0) - heat) * (reduce ? 1 : 0.06);
      const rgb = mix(light ? [24, 24, 27] : [250, 250, 250], heat);
      const R = Math.min(w, h) * 0.3 * (1 + kick.current * 0.08);
      const cx = w / 2, cy = h / 2, a = t * 0.18, ca = Math.cos(a), sa = Math.sin(a), tilt = 0.35, ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.clearRect(0, 0, w, h);
      // A soft core, so the particles sit in light (in shade, on a light page). It ends inside the
      // canvas, so there's no square edge.
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(R * 1.6, Math.min(w, h) / 2));
      g.addColorStop(0, `rgba(${rgb},${(light ? 0.07 : 0.1) + heat * 0.1 + kick.current * 0.12})`); g.addColorStop(0.5, `rgba(${rgb},${light ? 0.02 : 0.03})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const p of pts) {
        // Breathe: each point drifts in and out along its radius.
        const k = 1 + 0.06 * Math.sin(t * 1.3 + p.ph * 3) + 0.04 * Math.sin(t * 0.7 + p.y * 4);
        const x1 = (p.x * ca - p.z * sa) * k, z1 = (p.x * sa + p.z * ca) * k, y1 = p.y * k;
        const y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
        const depth = (z2 + 1) / 2; // 0 at the back, 1 at the front
        ctx.fillStyle = `rgba(${rgb},${(light ? 0.1 : 0.12) + depth * (light ? 0.75 : 0.85)})`;
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
