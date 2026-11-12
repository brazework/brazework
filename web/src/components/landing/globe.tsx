"use client";
import { useEffect, useRef } from "react";

// The globe on the landing page (Linear FIX-92): where verified work goes. Land is drawn in dots (a
// 144 x 72 bitmask of Natural Earth's 1:110m land, public domain, baked in below), the oceans in a
// faint lattice, and arcs run from your club to the places that notice. Same family as the orb:
// plain 2D canvas, black and white (white on dark, graphite on light), decorative (aria-hidden; the
// section says the same in words). It turns to face the active journey (centred on the arc's
// midpoint), and you can drag it to look around (horizontal drags only on touch, so the page still
// scrolls); let go and it eases back. Draws only while on screen;
// holds still for reduced motion, though you can still turn it.

const MASK = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPCf//8HAAAAAAAAAAAAAAAAyPzz//8A4AAAAAADAAAAAACAlAnw//8AAAAAB4AfAAAAAADAAywA/P8AAABgAP4fAAEAAQIAPvYH+H8AAABguP//7x8A4P//K9wc+B8AgH+g1///////z////z98+AMC4L/8////////AP///684+AAB8P7///////9/wP///wMGcAAAfP7//////38fgAf+/wd+AAAAfP7//////wEBAAH4/x9+AABAKP//////f8ABAADw/3//AQCw+P///////8AAAADg////AwDA/////////wAAAADA//8vBwDA/////////wAAAADA//8/AACA/6/v////fwAAAADA//8PAACA1wf3////PwIAAADA//8HAADwYW/P////DwEAAACA//8DAADwQPnP//9/BAEAAACA//8DAAAAD+D/////yAAAAAAA/v8BAADgD8D/////IAAAAAAA+n8AAADwf9f/////AQAAAAAA/IMAAADw///3////AQAAAAAA8IEAAAD8/7/P////AAAAAAAA4AEAAAD8/79/+P9/AQAAAAAAwBEAAAD+/3//8OcHAAAAAAAAwBsYAAD8/39/4MMLAAAAAAAAAB4AAAD+//8e4IEHAQAAAAAAAHAAAAD+//8HwIAPAwAAAAAAAAAUAAD8//8JwIAGAAAAAAAAAID+AAD4//8PAIAABAAAAAAAAAD+AQDw/f8PAAEBAAAAAAAAAAD+DwAA8P8HAIBhAAAAAAAAAAD/DwAA8P8DAABzAAAAAAAAAAD/PwAA8P8BAABzMQAAAAAAAAD//wEA8P8AAAACwQMAAAAAAAD//wMA4P8AAAAEgAcAAAAAAAD//wMA4P8AAACABQEAAAAAAAD+/wEA4P8AAAAAAAAAAAAAAAD+/wAA4P8IAAAAMAAAAAAAAAD4/wAA4P8MAAAAfgIAAAAAAADw/wAA4D8MAAAA/gcAAAAAAADw/wAA4D8GAADA/w8AAAAAAADwPwAAwD8GAADg/w8AAAAAAADwHwAAwB8AAADg/x8AAAAAAAD4DwAAgB8AAADA/x8AAAAAAAD4DwAAgA8AAADA/x8AAAAAAAD4BwAAgAMAAADAwx8AAAAAAAD4AQAAAAAAAAAAAA8AAAAAAAD4AAAAAAAAAAAAAARAAAAAAAA8AAAAAAAAAAAAAAQgAAAAAAA4AAAAAAAAAAAAAAAQAAAAAAAcAAAAAAAAAAAAAAAIAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAAMAQAAAAAAAAAAAAAAAAAAAAAYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAABAAAAAAABgAAAiAAAAAAAAAAAgAAAAACD+j////x8AAAAAAAB8AACg////5/////8PAACAgP/9AAD+//////////8HAMD///8PAMD///////////8BgPz///8BcPz///////////8HAPz///8fAP7///////////8AAPj///////////////////8P////////////////////////////////////////////////";
const MW = 144, MH = 72;

export type Place = { lat: number; lon: number; label: string };
const RAD = Math.PI / 180;
const vec = (lat: number, lon: number) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)] as const;

export function Globe({ from, to, active, className }: { from: Place; to: Place[]; active: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const act = useRef(active);
  const lit = useRef(0); // when the active arc changed, for its draw-in
  useEffect(() => { act.current = active; lit.current = performance.now(); }, [active]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const bits = Uint8Array.from(atob(MASK), (c) => c.charCodeAt(0));
    const land = (lat: number, lon: number) => {
      const c = Math.min(MW - 1, Math.floor(((lon + 180) / 360) * MW)), r = Math.min(MH - 1, Math.floor(((90 - lat) / 180) * MH));
      const i = r * MW + c;
      return (bits[i >> 3] >> (i & 7)) & 1;
    };
    // Points over the sphere (a Fibonacci lattice): land kept, a sparse share of ocean for the outline.
    const N = small ? 5200 : 9000;
    const dots: { x: number; y: number; z: number; l: boolean }[] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
      const x = Math.cos(th) * r, z = Math.sin(th) * r;
      const lat = Math.asin(y) / RAD, lon = Math.atan2(x, z) / RAD;
      const l = !!land(lat, lon);
      if (l || i % 6 === 0) dots.push({ x, y, z, l });
    }
    // Each arc: points along the great circle, lifted off the surface in the middle.
    const A = vec(from.lat, from.lon);
    const arcs = to.map((p) => {
      const B = vec(p.lat, p.lon);
      const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])), om = Math.acos(dot), so = Math.sin(om) || 1;
      return Array.from({ length: 61 }, (_, k) => {
        const t = k / 60, a = Math.sin((1 - t) * om) / so, b = Math.sin(t * om) / so, lift = 1 + 0.1 * Math.sin(Math.PI * t) * Math.min(1, om / 1.2);
        return [(a * A[0] + b * B[0]) * lift, (a * A[1] + b * B[1]) * lift, (a * A[2] + b * B[2]) * lift] as const;
      });
    });
    const ends = to.map((p) => vec(p.lat, p.lon));
    // Where to look for each journey: the midpoint of its great circle (yaw puts that longitude in the
    // middle of the view; pitch tips the globe toward its latitude).
    const looks = ends.map((B) => {
      const m = [A[0] + B[0], A[1] + B[1], A[2] + B[2]], len = Math.hypot(m[0], m[1], m[2]) || 1;
      const lat = Math.asin(m[1] / len), lon = Math.atan2(m[0] / len, m[2] / len);
      return { yaw: -lon, pitch: Math.max(-0.4, Math.min(0.85, lat * 0.85)) };
    });
    const wrap = (d: number) => Math.atan2(Math.sin(d), Math.cos(d)); // shortest way round

    let light = false, checked = 0;
    const readTone = () => {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
      const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(bg);
      light = m ? (0.2126 * parseInt(m[1], 16) + 0.7152 * parseInt(m[2], 16) + 0.0722 * parseInt(m[3], 16)) / 255 > 0.5 : false;
    };
    readTone();

    // Facing the club's side of the world to start: centred 25° east of it, so the arcs across the
    // ocean show (the view's centre is at longitude -yaw).
    let yaw = (-from.lon - 25) * RAD, pitch = 0.32, vel = 0, drag: { x: number; y: number } | null = null;
    let w = 0, h = 0, raf = 0, visible = true, last = performance.now();
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (now - checked > 1000) { readTone(); checked = now; }
      if (!drag) {
        yaw += vel; vel *= 0.92;
        // Ease toward the active journey once any fling has settled.
        const look = looks[act.current];
        if (look && Math.abs(vel) < 0.002) {
          const k = reduce ? 1 : 1 - Math.pow(0.04, dt);
          yaw += wrap(look.yaw - yaw) * k;
          pitch += (look.pitch - pitch) * k;
        }
      }
      const a = yaw, ca = Math.cos(a), sa = Math.sin(a), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const R = Math.min(w, h) * 0.42, cx = w / 2, cy = h / 2;
      const ink = light ? "24,24,27" : "250,250,250";
      const P = (x: number, y: number, z: number) => {
        const x1 = x * ca + z * sa, z1 = -x * sa + z * ca;
        const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
        return [cx + x1 * R, cy - y2 * R, z2] as const;
      };
      ctx.clearRect(0, 0, w, h);
      // The disc: a soft fill and a hairline rim, so the dots sit on a body.
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
      g.addColorStop(0, `rgba(${ink},${light ? 0.05 : 0.07})`); g.addColorStop(1, `rgba(${ink},0.015)`);
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${ink},${light ? 0.12 : 0.14})`; ctx.stroke();
      for (const d of dots) {
        const [sx, sy, z] = P(d.x, d.y, d.z);
        if (z < 0) continue;
        const k = z; // brighter towards the middle of the face
        ctx.fillStyle = `rgba(${ink},${d.l ? (light ? 0.2 : 0.22) + k * (light ? 0.6 : 0.68) : 0.05 + k * 0.08})`;
        const s = d.l ? 1 + k * 0.9 : 0.8;
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
      // Arcs: the active one drawn in over a second, with a packet riding it; the others faint.
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2); ctx.clip(); // arcs stay on the globe
      const on = act.current, since = (now - lit.current) / 1000;
      arcs.forEach((pts, i) => {
        const isOn = i === on, reach = isOn ? (reduce ? 1 : Math.min(1, since / 1.1)) : 1;
        const upto = Math.max(1, Math.floor(reach * (pts.length - 1)));
        ctx.lineWidth = isOn ? 1.6 : 1;
        for (let k = 0; k < upto; k++) {
          const p = P(...pts[k]), q = P(...pts[k + 1]);
          const front = Math.min(p[2], q[2]);
          if (front < 0.04) continue; // the near side only, so no arc loops out past the edge
          ctx.strokeStyle = `rgba(${ink},${(isOn ? 0.9 : 0.16) * Math.min(1, front * 4)})`;
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
        if (isOn && !reduce && reach >= 1) {
          const u = ((since - 1.1) * 0.55) % 1, j = Math.floor(u * (pts.length - 1)), p = P(...pts[j]);
          if (p[2] > 0.04) { ctx.fillStyle = `rgba(${ink},1)`; ctx.beginPath(); ctx.arc(p[0], p[1], 2.4, 0, Math.PI * 2); ctx.fill(); }
        }
      });
      ctx.restore();
      // Places: your club pulses; where it reached gets a ring and, when active, its name.
      ctx.font = "500 12px ui-sans-serif, system-ui, -apple-system, sans-serif";
      const mark = (v: readonly [number, number, number], label: string | null, strong: boolean, pulse: boolean) => {
        const [sx, sy, z] = P(...v);
        if (z < 0.02) return;
        ctx.fillStyle = `rgba(${ink},${strong ? 1 : 0.55})`;
        ctx.beginPath(); ctx.arc(sx, sy, strong ? 3.2 : 2.2, 0, Math.PI * 2); ctx.fill();
        if (pulse && !reduce) {
          const ph = (now / 1600) % 1;
          ctx.strokeStyle = `rgba(${ink},${0.5 * (1 - ph)})`; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(sx, sy, 4 + ph * 14, 0, Math.PI * 2); ctx.stroke();
        }
        if (label) {
          const tw = ctx.measureText(label).width, bx = Math.min(w - tw - 22, sx + 9), by = sy - 22;
          ctx.fillStyle = light ? "rgba(255,255,255,0.92)" : "rgba(14,14,16,0.88)";
          ctx.strokeStyle = `rgba(${ink},0.18)`;
          ctx.beginPath(); ctx.roundRect(bx, by, tw + 14, 20, 5); ctx.fill(); ctx.stroke();
          ctx.fillStyle = `rgba(${ink},0.95)`; ctx.fillText(label, bx + 7, by + 14);
        }
      };
      ends.forEach((v, i) => mark(v, i === on ? to[i].label : null, i === on, false));
      mark(A, from.label, true, true);
      raf = visible ? requestAnimationFrame(draw) : 0;
    };
    const kick = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(draw); };

    const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; kick(); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      yaw += dx * 0.006; vel = dx * 0.006;
      if (e.pointerType === "mouse") pitch = Math.max(-0.5, Math.min(0.9, pitch + dy * 0.004));
    };
    const up = () => { drag = null; canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    size();
    draw(performance.now());
    const ro = new ResizeObserver(() => { size(); kick(); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) kick();
    });
    io.observe(canvas);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      canvas.removeEventListener("pointerdown", down); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up); canvas.removeEventListener("pointercancel", up);
    };
  }, [from, to]);

  return <canvas ref={ref} aria-hidden="true" className={className} style={{ cursor: "grab", touchAction: "pan-y" }} />;
}
