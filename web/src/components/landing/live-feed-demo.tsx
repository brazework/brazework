"use client";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { Heart, MessageSquare, Bookmark, BadgeCheck, FlaskConical, Cpu, Rocket, Atom } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";

// Illustrative sample posts for the landing page (labelled "Sample" in the UI). Not real members.
const SCRIPT = [
  { first: "Maya", last: "Okafor", role: "ME student · Robotics", kind: "Project", icon: Cpu, body: "Rev 3 of our 6-DOF arm closes the loop at 1 kHz. Torque ripple down 41% after the new encoder mount.", tags: ["Robotics & Autonomy", "Embedded Systems"], likes: 128, comments: 14, verified: ".edu" },
  { first: "Dev", last: "Raman", role: "Research Engineer · Batteries", kind: "Result", icon: FlaskConical, body: "Silicon-graphite anode held 92% capacity over 500 cycles. Raw cycling data + methods in the build log.", tags: ["Batteries & Electrochemistry"], likes: 342, comments: 37, verified: "work" },
  { first: "Lena", last: "Sato", role: "Grad student · Quantum", kind: "Question", icon: Atom, body: "Anyone benchmarked readout fidelity on transmons with the new TWPA? Seeing drift I can't explain.", tags: ["Quantum Computing"], likes: 56, comments: 21, verified: ".edu" },
  { first: "Ian", last: "Cole", role: "Aerospace · Propulsion", kind: "Project", icon: Rocket, body: "Static fire #4: regen-cooled chamber survived 30 s. Thermal data says the next throat can go thinner.", tags: ["Aerospace", "Space Systems"], likes: 512, comments: 63, verified: "work" },
];

type Item = (typeof SCRIPT)[number] & { key: number };

export function LiveFeedDemo() {
  const reduce = useReducedMotion();
  const [items, setItems] = useState<Item[]>(() => SCRIPT.slice(0, 3).map((s, i) => ({ ...s, key: i })));
  const [bumps, setBumps] = useState<Record<number, number>>({});
  const next = useRef(3);

  useEffect(() => {
    if (reduce) return;
    const add = setInterval(() => {
      const n = next.current++;
      const src = SCRIPT[n % SCRIPT.length];
      setItems((cur) => [{ ...src, key: n }, ...cur].slice(0, 3));
    }, 3800);
    const like = setInterval(() => {
      setItems((cur) => {
        const pick = cur[Math.floor(Math.random() * cur.length)];
        if (pick) setBumps((b) => ({ ...b, [pick.key]: (b[pick.key] ?? 0) + 1 + Math.floor(Math.random() * 3) }));
        return cur;
      });
    }, 900);
    return () => {
      clearInterval(add);
      clearInterval(like);
    };
  }, [reduce]);

  // 3D tilt toward the cursor.
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5), my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [7, -7]), { stiffness: 120, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-9, 9]), { stiffness: 120, damping: 18 });
  const glowX = useTransform(mx, (v) => `${v * 100}%`);
  const glowY = useTransform(my, (v) => `${v * 100}%`);

  return (
    <div className="[perspective:1400px]">
      <motion.div
        ref={ref}
        onPointerMove={(e) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          mx.set((e.clientX - r.left) / r.width);
          my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => { mx.set(0.5); my.set(0.5); }}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        className="glass relative overflow-hidden rounded-[22px] shadow-[0_40px_120px_-30px_rgba(255,90,30,0.35),0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: useTransform([glowX, glowY], ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, color-mix(in oklab, var(--accent) 16%, transparent), transparent 60%)`) }}
        />
        {/* Window chrome */}
        <div className="relative flex items-center gap-2 border-b border-line px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex items-center gap-2 font-mono text-[11px] text-faint">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-ok" />
              <span className="relative inline-flex size-2 rounded-full bg-ok" />
            </span>
            forge · For you · live
          </div>
          <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-faint">Sample</span>
        </div>

        <div className="relative flex h-[440px] flex-col gap-3 overflow-hidden p-4">
          <AnimatePresence initial={false} mode="popLayout">
            {items.map((p) => (
              <motion.article
                key={p.key}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.97, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 30, scale: 0.97, filter: "blur(6px)" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="rounded-2xl border border-line bg-surface/80 p-4"
              >
                <header className="flex items-center gap-3">
                  <Avatar first={p.first} last={p.last} size={34} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {p.first} {p.last}
                      <BadgeCheck className="size-3.5 text-accent" aria-label={`Verified ${p.verified}`} />
                    </div>
                    <div className="truncate text-xs text-faint">{p.role}</div>
                  </div>
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
                    <p.icon className="size-3" /> {p.kind}
                  </span>
                </header>
                <p className="mt-3 text-[13.5px] leading-relaxed text-text-2">{p.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted">#{t}</span>
                  ))}
                </div>
                <footer className="mt-3 flex items-center gap-5 text-xs text-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="size-3.5 fill-accent/30 text-accent" />
                    <motion.span key={bumps[p.key] ?? 0} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="tabular-nums">
                      {p.likes + (bumps[p.key] ?? 0)}
                    </motion.span>
                  </span>
                  <span className="inline-flex items-center gap-1.5"><MessageSquare className="size-3.5" /> {p.comments}</span>
                  <Bookmark className="ml-auto size-3.5" />
                </footer>
              </motion.article>
            ))}
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent" />
        </div>
      </motion.div>
    </div>
  );
}
