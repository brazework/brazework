"use client";
import { Download } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/forge";
import { SCHOOL_OUTCOMES } from "./sections";

// /schools, interactive parts (premium landing, 2026-11-27). Offices: pick an office and see the
// report it gets (examples, marked). The portal to try is portal.tsx.


function Preview({ k }: { k: number }) {
  if (k === 0) return (
    <div>
      <p className="text-sm font-medium">ABET attainment, Fall 2026</p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {[["SO 1 Solving complex problems", 0.86], ["SO 2 Engineering design", 0.74], ["SO 5 Teamwork", 0.79], ["SO 6 Experimentation and analysis", 0.91]].map(([o, v]) => (
          <li key={o as string} className="grid grid-cols-[minmax(0,1fr)_7rem_2.5rem] items-center gap-3 text-[13px]">
            <span className="truncate text-text-2">{o}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand),var(--heat-amber))]" style={{ width: `${(v as number) * 100}%` }} /></span>
            <span className="text-right text-muted tabular-nums">{Math.round((v as number) * 100)}%</span>
          </li>
        ))}
      </ul>
      <span className="mt-5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs"><Download className="size-3.5" aria-hidden="true" /> Download for the self-study</span>
    </div>
  );
  if (k === 1) return (
    <div>
      <p className="text-sm font-medium">Clubs this semester</p>
      <ul className="mt-4 divide-y divide-line text-[13px]">
        {[["Rocketry Club", 34, 9], ["Aerial Robotics Club", 21, 6], ["ACM Club", 58, 12], ["Formula SAE", 27, 4]].map(([c, m, b]) => (
          <li key={c as string} className="flex items-center justify-between gap-3 py-2"><span>{c}</span><span className="text-muted tabular-nums">{m} members, {b} verified builds</span></li>
        ))}
      </ul>
    </div>
  );
  if (k === 2) return (
    <div>
      <p className="text-sm font-medium">Employers looking at your students</p>
      <ul className="mt-4 divide-y divide-line text-[13px]">
        {[["Pratt & Whitney", "viewed 14, contacted 3"], ["Sikorsky", "viewed 9, contacted 2"], ["Electric Boat", "viewed 6, hired 1"]].map(([c, s]) => (
          <li key={c} className="flex items-center justify-between gap-3 py-2"><span>{c}</span><span className="text-muted">{s}</span></li>
        ))}
      </ul>
    </div>
  );
  return (
    <div>
      <p className="text-sm font-medium">Built at Demo University</p>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
        {["Dual-deploy flight computer", "Benchtop cobot arm", "Pratt truss, 1:10 scale", "Weld-defect classifier"].map((t) => (
          <li key={t} className="rounded-lg border border-line bg-surface-2/50 p-3"><span className="block h-12 rounded-md bg-[radial-gradient(120%_90%_at_30%_0%,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)]" /><span className="mt-2 block truncate">{t}</span></li>
        ))}
      </ul>
    </div>
  );
}

export function Offices() {
  const [k, setK] = useState(0);
  const id = useId();
  const o = SCHOOL_OUTCOMES[k];
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 md:mt-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-6">
      <div role="tablist" aria-label="Offices" aria-orientation="vertical" className="flex flex-col gap-2">
        {SCHOOL_OUTCOMES.map((x, i) => (
          <button key={x.title} type="button" role="tab" id={`${id}-t${i}`} aria-selected={k === i} aria-controls={`${id}-p`} onClick={() => setK(i)}
            onKeyDown={(e) => { const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0; if (!d) return; e.preventDefault(); const n = (k + d + 4) % 4; setK(n); document.getElementById(`${id}-t${n}`)?.focus(); }}
            tabIndex={k === i ? 0 : -1}
            className={cn("flex items-start gap-4 rounded-2xl border p-5 text-left transition", k === i ? "border-brand/50 bg-surface shadow-[var(--shadow-float)]" : "border-line bg-surface/50 hover:border-line-strong")}>
            <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl transition-colors", k === i ? "bg-brand text-bg" : "bg-surface-2 text-text-2")}><x.icon className="size-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-xs text-faint">{x.office}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-2"><span className="text-lg font-semibold tracking-tight">{x.title}</span>{x.soon && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Building with pilot schools</span>}</span>
              <span className={cn("mt-1 block text-[15px] leading-relaxed text-muted", k !== i && "max-lg:hidden lg:line-clamp-1")}>{x.body}</span>
            </span>
          </button>
        ))}
      </div>
      <div id={`${id}-p`} role="tabpanel" aria-labelledby={`${id}-t${k}`} className="hero-window relative min-h-[20rem] rounded-2xl border border-line bg-surface p-6">
        <div key={k} className="hero-rise">
          <p className="mb-5 text-xs text-faint">What the {o.office.toLowerCase()} sees, with example data</p>
          <Preview k={k} />
        </div>
      </div>
    </div>
  );
}
