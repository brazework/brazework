"use client";
import { useEffect, useRef } from "react";

type Spark = { x: number; y: number; vx: number; vy: number; r: number; heat: number; phase: number };

const HEAT_STEPS = 6; // pre-rendered glow sprites, from deep ember red to bright amber
const ALPHA_STEPS = 8; // link opacity buckets, so lines are stroked in a handful of batches

// Rising forge embers that link into a network when they drift close: people becoming connections.
// The cursor acts like a magnet and lights up nearby links. Built to stay cheap on phones:
// glow sprites are drawn once and stamped with drawImage, links are batched by opacity, the spark
// count scales with screen area, and it starts after first paint, pauses offscreen and in
// background tabs, and draws one still frame when the visitor prefers reduced motion.
export function SparkField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const LINK = 120;
    const MAGNET = 180;
    let w = 0, h = 0, raf = 0, visible = true, started = false;
    const sparks: Spark[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    const hsl = (heat: number, a: number) => `hsla(${12 + heat * 26}, 100%, ${52 + heat * 14}%, ${a})`;

    // One soft glow per heat step, rendered once.
    const SPRITE = 48;
    const sprites = Array.from({ length: HEAT_STEPS }, (_, i) => {
      const heat = i / (HEAT_STEPS - 1);
      const c = document.createElement("canvas");
      c.width = c.height = SPRITE;
      const g = c.getContext("2d")!;
      const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
      grad.addColorStop(0, hsl(heat, 0.95));
      grad.addColorStop(0.22, hsl(heat, 0.38));
      grad.addColorStop(1, hsl(heat, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, SPRITE, SPRITE);
      return c;
    });

    const spawn = (anywhere: boolean): Spark => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.15 + Math.random() * 0.45),
      r: 0.6 + Math.random() * 1.8,
      heat: Math.random(),
      phase: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(coarse ? 60 : 130, Math.round((w * h) / (coarse ? 12000 : 9500)));
      while (sparks.length < target) sparks.push(spawn(true));
      sparks.length = target;
    };

    const buckets: number[][] = Array.from({ length: ALPHA_STEPS }, () => []);

    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      if (!reduce) {
        for (const s of sparks) {
          s.phase += 0.012;
          s.x += s.vx + Math.sin(s.phase) * 0.18;
          s.y += s.vy;
          if (mouse.active) {
            const dx = mouse.x - s.x, dy = mouse.y - s.y;
            const d = Math.hypot(dx, dy);
            if (d < MAGNET && d > 1) {
              const f = (1 - d / MAGNET) * 0.6;
              s.x += (dx / d) * f;
              s.y += (dy / d) * f;
            }
          }
          if (s.y < -10 || s.x < -20 || s.x > w + 20) Object.assign(s, spawn(false));
        }
      }

      // Links between nearby sparks, grouped into opacity buckets: a few strokes instead of hundreds.
      for (const b of buckets) b.length = 0;
      const L2 = LINK * LINK;
      for (let i = 0; i < sparks.length; i++) {
        const a = sparks[i];
        for (let j = i + 1; j < sparks.length; j++) {
          const b = sparks[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < L2) {
            const k = 1 - Math.sqrt(d2) / LINK;
            buckets[Math.min(ALPHA_STEPS - 1, Math.floor(k * ALPHA_STEPS))].push(a.x, a.y, b.x, b.y);
          }
        }
      }
      ctx.lineWidth = 0.6;
      for (let q = 0; q < ALPHA_STEPS; q++) {
        const pts = buckets[q];
        if (!pts.length) continue;
        ctx.strokeStyle = hsl(0.55, ((q + 0.5) / ALPHA_STEPS) * 0.22);
        ctx.beginPath();
        for (let p = 0; p < pts.length; p += 4) {
          ctx.moveTo(pts[p], pts[p + 1]);
          ctx.lineTo(pts[p + 2], pts[p + 3]);
        }
        ctx.stroke();
      }

      // Brighter links to the cursor.
      if (mouse.active) {
        ctx.lineWidth = 0.9;
        ctx.strokeStyle = hsl(1, 0.28);
        ctx.beginPath();
        for (const s of sparks) {
          if (Math.hypot(mouse.x - s.x, mouse.y - s.y) < MAGNET) {
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(s.x, s.y);
          }
        }
        ctx.stroke();
      }

      // The embers: stamp a pre-rendered glow, with a soft flicker.
      ctx.globalCompositeOperation = "lighter";
      for (const s of sparks) {
        ctx.globalAlpha = reduce ? 1 : 0.75 + Math.sin(t * 0.004 + s.phase * 3) * 0.25;
        const size = s.r * 12;
        ctx.drawImage(sprites[Math.round(s.heat * (HEAT_STEPS - 1))], s.x - size / 2, s.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (!started || reduce) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = e.pointerType === "mouse" && mouse.y >= 0 && mouse.y <= rect.height;
    };
    const onLeave = () => (mouse.active = false);
    const onVisibility = () => !document.hidden && visible && start();

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
    });
    const ro = new ResizeObserver(() => {
      resize();
      if (reduce || !started) frame(0);
    });

    // Let the page paint and hydrate first; the sparks are atmosphere, not content.
    const ric = typeof window.requestIdleCallback === "function";
    const idle = (cb: () => void): number => (ric ? window.requestIdleCallback(cb, { timeout: 1200 }) : window.setTimeout(cb, 300));
    const handle = idle(() => {
      resize();
      started = true;
      io.observe(canvas);
      ro.observe(canvas);
      if (reduce) frame(0);
      else start();
      canvas.style.opacity = "1";
    });

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (ric) window.cancelIdleCallback(handle);
      else clearTimeout(handle);
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className={className} style={{ opacity: 0, transition: "opacity 1.2s ease" }} aria-hidden="true" />;
}
