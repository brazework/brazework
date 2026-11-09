"use client";
import { motion } from "motion/react";
import { Building2, Quote, RotateCw, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { PROFESSIONS, type Profession } from "./professions";

// One flip card per tech profession: the front says what the field is, the back shows what
// you'd post, which clubs it fits and who's looking. Hover flips it with a mouse; tap or
// Enter flips it everywhere. Both faces share one grid cell, so every card is the same size.
export function ProfessionGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PROFESSIONS.map((p, n) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: (n % 4) * 0.07, ease: [0.16, 1, 0.3, 1] }}
        >
          <FlipCard p={p} />
        </motion.div>
      ))}
    </div>
  );
}

function FlipCard({ p }: { p: Profession }) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const flipped = pinned || hover;
  const face = "rounded-3xl border border-line bg-surface p-6 [grid-area:1/1] [backface-visibility:hidden]";
  return (
    <button
      type="button"
      aria-pressed={pinned}
      aria-label={`${p.title}: ${flipped ? "showing details" : "show details"}`}
      onClick={() => setPinned((v) => !v)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      className="group block h-full w-full text-left [perspective:1400px]"
    >
      <div className={cn("grid h-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] [transform-style:preserve-3d]", flipped && "[transform:rotateY(180deg)]")}>
        <div className={cn(face, "spotlight flex flex-col transition-shadow group-hover:shadow-[var(--shadow)]")}>
          <span className="grid size-12 place-items-center rounded-2xl text-white shadow-lg" style={{ background: p.grad }}>
            <p.icon className="size-6" />
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight">{p.title}</h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted">{p.blurb}</p>
          <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-faint transition group-hover:text-text">
            <RotateCw className="size-3.5" /> See what you&apos;d post
          </span>
        </div>
        <div className={cn(face, "relative flex flex-col gap-4 overflow-hidden [transform:rotateY(180deg)]")}>
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: p.grad }} aria-hidden="true" />
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-faint"><Quote className="size-3.5" /> A post you&apos;d make</div>
            <p className="mt-1.5 text-sm font-medium text-text">&ldquo;{p.post}&rdquo;</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-faint"><Users className="size-3.5" /> Clubs</div>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {p.clubs.map((c) => <li key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-2">{c}</li>)}
            </ul>
          </div>
          <div className="mt-auto">
            <div className="flex items-center gap-1.5 text-xs font-medium text-faint"><Building2 className="size-3.5" /> Who&apos;s looking</div>
            <p className="mt-1.5 text-sm text-text-2">{p.lookingFor}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
