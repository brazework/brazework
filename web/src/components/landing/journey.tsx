import { ArrowRight, Box, Check, Code2, Download, Eye, FileText, Gauge, Image as ImageIcon, Link2, Lock, Scissors, Search, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Seal } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { CadStage, type Mode } from "./cad-stage";
import { EXAMPLES, RUBRIC, STUDENT, course, type Example } from "./journey-data";

// Client components, imported by hero.tsx. The five views of the landing hero's product window (components/landing/hero.tsx): one project
// followed from the student who logs it to everywhere it counts. Each view is a panel the same size,
// so switching never moves the page. What the visitor typed is the milestone in every one of them.
// Each view's footer note (hero.tsx VIEWS) says what's example data and what's still coming.

export type ViewProps = { ex: Example; title: string; on: boolean; still: boolean; next: () => void };
const MONO = "font-mono text-[11px] text-faint";
const card = "rounded-xl border border-line bg-surface";
const Initials = ({ name, className }: { name: string; className?: string }) => (
  <span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-full bg-raised text-[11px] font-semibold text-text-2", className)}>{name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
);
const Verified = ({ ex, className }: { ex: Example; className?: string }) => (
  <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-xs text-text-2", className)}><Seal size={16} /><span className="truncate">Verified by <span className="font-medium text-text">{ex.signer}</span>, {ex.role}</span></span>
);
// Views 2 to 5 start over for each build: hero.tsx gives them the build as their key.
// Runs `f` once a view has been on screen for `ms` (at once with reduced motion), and not again.
function useOnce(on: boolean, still: boolean, ms: number, f: () => void, key: unknown) {
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(f, still ? 0 : ms);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, still, key]);
}

const MODES: { id: Mode; label: string; icon: typeof Box }[] = [
  { id: "render", label: "Render", icon: Box },
  { id: "section", label: "Section", icon: Scissors },
  { id: "stress", label: "Stress", icon: Gauge },
];

// 1. The student: a build to turn and cut open, and the milestone with its proof, under its class or club.
export function StudentView({ ex, title, on, pick, choose, next }: ViewProps & { pick: string; choose: (id: Example["id"]) => void }) {
  const [mode, setMode] = useState<Mode>("render");
  const [lo, hi] = ex.field ?? ["Low", "High"];
  const names = ex.modes ?? MODES.map((m) => m.label);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-line px-3 py-2">
        <div role="group" aria-label="Example builds" className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
          {EXAMPLES.map((e) => (
            <button key={e.id} type="button" aria-pressed={e.id === pick} tabIndex={on ? 0 : -1} onClick={() => choose(e.id)}
              className={cn("inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[13px] whitespace-nowrap transition-colors", e.id === pick ? "bg-raised font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
              {e.chip}
            </button>
          ))}
        </div>
      </div>
      <CadStage build={ex.id} mode={mode} callouts={ex.callouts} active={on} className="min-h-0 flex-1">
        <div role="radiogroup" aria-label="View" className="absolute bottom-3 left-3 z-10 flex rounded-lg border border-line bg-surface/90 p-0.5 backdrop-blur-sm">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} tabIndex={on ? 0 : -1} onClick={() => setMode(m.id)}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors", mode === m.id ? "bg-accent text-on-accent" : "text-muted hover:text-text")}>
              <m.icon className="size-3.5" aria-hidden="true" /> {names[MODES.indexOf(m)]}
            </button>
          ))}
        </div>
        {mode === "stress" && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-md border border-line bg-surface/90 px-2 py-1 font-mono text-[10px] text-muted backdrop-blur-sm">
            <span>{lo}</span><span className="h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(90deg,#30123b,#4686fb,#1ae4b6,#a2fc3c,#fabb39,#e4460a,#7a0403)" }} /><span>{hi}</span>
          </div>
        )}
        <p aria-hidden="true" className="absolute top-3 right-3 hidden font-mono text-[10px] text-faint sm:block">Drag to turn</p>
      </CadStage>
      <div id="hero-card" aria-live="polite" className="border-t border-line px-4 py-3.5 sm:px-5">
        <p className="flex min-w-0 items-center gap-2 text-[11px] text-faint">
          <span className="shrink-0 rounded-full border border-line px-1.5 py-px font-medium text-text-2">{ex.kind === "class" ? "Class" : "Club"}</span>
          <span className="truncate font-mono">{ex.where} · {ex.assignment ?? ex.name}</span>
        </p>
        <p className="mt-1.5 line-clamp-2 min-h-[2.6em] text-[15px] leading-snug font-semibold text-pretty break-words">{title}</p>
        <div className="mt-2.5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="flex min-w-0 max-w-full items-center gap-3 text-xs text-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5"><FileText className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{ex.proof}</span></span>
            <span className="inline-flex shrink-0 items-center gap-1.5 max-sm:hidden">{ex.repo ? <><Code2 className="size-3.5" aria-hidden="true" />GitHub repo</> : <><Box className="size-3.5" aria-hidden="true" />3D model</>}</span>
          </span>
          <button type="button" onClick={next} tabIndex={on ? 0 : -1} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-on-accent transition active:scale-95">
            {ex.assignment ? `Submit to ${course(ex)}` : `Ask ${ex.signer} to verify`} <ArrowRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// 2. The professor (or the club officer). A class milestone is graded against the rubric, each row an
// ABET outcome, and grading it verifies it (Brazework Courses, live since #254); the grade is private
// to the student and the course's faculty. Torch's feedback draft is marked as coming. A club
// milestone is verified by an officer.
export function VerifyView({ ex, title, on, still, verified, verify }: ViewProps & { verified: boolean; verify: () => void }) {
  const graded = !!ex.assignment;
  const rows = graded ? RUBRIC : [];
  const steps = rows.length + ex.team.length;
  const [count, setTicked] = useState(0);
  const done = verified ? steps : count;
  // Played: each rubric row is scored and each teammate's part checked, then the seal comes down.
  // Clicking does it at once; with reduced motion it's done as soon as the view opens.
  useEffect(() => {
    if (!on || verified) return;
    if (still) { const t = window.setTimeout(verify, 0); return () => window.clearTimeout(t); }
    const ts = Array.from({ length: steps }, (_, i) => window.setTimeout(() => setTicked((n) => Math.max(n, i + 1)), 600 + i * 300));
    ts.push(window.setTimeout(verify, 600 + steps * 300 + 250));
    return () => ts.forEach(window.clearTimeout);
  }, [on, still, verified, steps, verify]);
  const files = [
    { icon: FileText, name: ex.proof },
    ex.repo ? { icon: Code2, name: ex.repo } : { icon: Box, name: ex.model },
    { icon: ImageIcon, name: "bench-photo-03.jpg" },
  ];
  const total = rows.reduce((n, x) => n + x.score, 0);
  return (
    <div className="flex h-full flex-col gap-2.5 overflow-hidden p-3 sm:gap-3 sm:p-4">
      <div className="flex items-center gap-3">
        <Initials name={STUDENT} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm"><span className="font-semibold">{STUDENT}</span> <span className="text-muted">{graded ? `submitted ${ex.assignment}` : "asks you to verify"}</span></p>
          <p className={cn(MONO, "truncate")}>{ex.where} · 2 min ago</p>
        </div>
      </div>
      <p className="line-clamp-2 text-[15px] leading-snug font-semibold text-pretty break-words">{title}</p>
      <ul aria-label="Evidence" className="flex flex-wrap gap-1.5">
        {files.map((f, i) => (
          <li key={f.name} className={cn("inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1 text-[12px]", i === 2 && "max-sm:hidden")}>
            <f.icon className="size-3.5 shrink-0 text-muted" aria-hidden="true" /><span className="truncate">{f.name}</span>
          </li>
        ))}
      </ul>
      {graded && (
        <div className={cn(card, "px-3 py-2")}>
          <p className="flex items-center justify-between gap-2"><span className={MONO}>Rubric</span><span className="font-mono text-[10px] text-faint">ABET outcome</span></p>
          <ul aria-label="Rubric" className="mt-1 flex flex-col gap-1">
            {rows.map((x, i) => (
              <li key={x.row} className="grid grid-cols-[minmax(0,1fr)_3.75rem_3.75rem] items-center gap-2 text-[12.5px]">
                <span className="truncate">{x.row}</span>
                <span className="rounded border border-line px-1 text-center font-mono text-[10px] whitespace-nowrap text-text-2">{x.outcome}</span>
                <span className={cn("text-right font-mono whitespace-nowrap tabular-nums transition-opacity duration-300", done > i ? "opacity-100" : "opacity-25")}>{done > i ? x.score : "–"} / 10</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 flex items-center gap-1.5 border-t border-line pt-1.5 text-[11.5px] text-muted"><Lock className="size-3 shrink-0" aria-hidden="true" /><span className="min-w-0 truncate"><span className="font-semibold text-text tabular-nums">{done >= rows.length ? total : "–"} / 30</span> · seen only by {STUDENT.split(" ")[0]} and the course&apos;s faculty</span></p>
        </div>
      )}
      <div className="min-h-0">
        <p className={MONO}>Who did what</p>
        <ul aria-label="Teammates" className="mt-1 flex flex-col gap-0.5">
          {ex.team.map((t, i) => {
            const ok = done > rows.length + i;
            return (
              <li key={t.name} className="flex items-center gap-2.5 text-[12.5px]">
                <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded border transition-colors duration-300", ok ? "border-ok bg-ok text-bg" : "border-line-strong")}>{ok && <Check className="size-3" strokeWidth={3} />}</span>
                <span className="shrink-0 font-medium">{t.name}</span>
                <span className="min-w-0 truncate text-muted">{t.part}</span>
                <span className="sr-only">{ok ? "verified" : "not yet verified"}</span>
              </li>
            );
          })}
        </ul>
      </div>
      {graded && <p className="flex items-start gap-1.5 text-[11.5px] leading-snug text-muted max-sm:hidden"><Sparkles className="mt-0.5 size-3 shrink-0 text-brand" aria-hidden="true" /><span className="min-w-0 line-clamp-2"><span className="font-medium text-text-2">Coming soon:</span> Torch drafts feedback like &ldquo;Clear method and a test anyone could repeat&rdquo; for {ex.signer} to edit and send.</span></p>}
      <div className="mt-auto flex min-h-12 items-center">
        {verified ? (
          <p className="flex min-w-0 items-center gap-2.5 text-sm" role="status">
            <span className={cn("inline-grid", !still && "seal-stamp")}><Seal size={34} /></span>
            <span className="min-w-0">Verified by <span className="font-semibold">{ex.signer}</span>, {ex.role}<span className="block text-xs text-faint">{graded ? "Graded and verified in one step. The grade stays private; the work is on the record." : "Their name stays on it, with the evidence."}</span></span>
          </p>
        ) : (
          <button type="button" onClick={verify} tabIndex={on ? 0 : -1} className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition active:scale-95">
            <Check className="size-4" aria-hidden="true" /> {graded ? "Grade and verify" : `Verify as ${ex.signer}`}
          </button>
        )}
      </div>
    </div>
  );
}

// 3. The school: the department's dashboard counts it, files it as accreditation evidence, exports it.
const ROWS: Record<string, number> = { "ME 490 Formula SAE Capstone · Fall 2026": 27, "CS 485 Mobile Robotics · Fall 2026": 14, "CS 489 Machine Learning · Fall 2026": 22, "ACM Club": 19, "ME 410 Capstone · Fall 2026": 24, "CE 331 Structures Lab · Fall 2026": 18, "ECE 455 Embedded Systems · Fall 2026": 21, "ME 482 Robotics · Fall 2026": 16, "Aerial Robotics Club": 12, "Rocketry Club": 15 };
export function SchoolView({ ex, title, on, still }: ViewProps) {
  const [counted, setCounted] = useState(false);
  const [report, setReport] = useState(false);
  useOnce(on, still, 500, () => setCounted(true), ex.id);
  const rows = [ex.where, ...Object.keys(ROWS).filter((r) => r !== ex.where)].slice(0, 4);
  const max = Math.max(...rows.map((r) => ROWS[r])) + 1;
  const n = (r: string) => ROWS[r] + (r === ex.where && counted ? 1 : 0);
  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">School of Engineering</span>
          <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-faint">Example</span>
        </p>
        <p className={cn(MONO, "shrink-0")}>Fall 2026</p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {[["Verified projects", counted ? "129" : "128", counted ? "+1 just now" : "this semester"], ["Students", "312", "with verified work"], ["Active clubs", "14", "of 22"]].map(([k, v, s], i) => (
          <div key={k} className={cn(card, "px-2.5 py-2 sm:px-3", i === 0 && counted && "border-ok/60")}>
            <dt className="truncate text-[11px] text-muted">{k}</dt>
            <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{v}</dd>
            <dd className={cn("truncate text-[10px]", i === 0 && counted ? "text-ok" : "text-faint")}>{s}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className={MONO}>Verified projects by class and club</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2rem] items-center gap-2 text-[12px] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_2rem]">
              <span className={cn("truncate", r === ex.where ? "font-medium text-text" : "text-muted")}>{r.replace(" · Fall 2026", "")}</span>
              <span className="h-2 overflow-hidden rounded-full bg-raised"><span className={cn("block h-full rounded-full transition-[width] duration-700", r === ex.where ? "bg-brand" : "bg-line-strong")} style={{ width: `${(n(r) / max) * 100}%` }} /></span>
              <span className="text-right tabular-nums text-text-2">{n(r)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(card, "px-3 py-2.5")}>
        <p className="flex items-center justify-between gap-2"><span className="truncate text-[12px] font-medium">ABET outcome {ex.outcome}</span><span className="shrink-0 font-mono text-[10px] text-faint">Evidence</span></p>
        <p className={cn("mt-1.5 flex min-w-0 items-center gap-2 text-[12px] transition-opacity duration-500", counted ? "opacity-100" : "opacity-0")}>
          <Seal size={14} /><span className="min-w-0 truncate">{title}</span>
        </p>
      </div>
      <div className="mt-auto flex items-center gap-3">
        <button type="button" onClick={() => setReport(true)} tabIndex={on ? 0 : -1} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium transition hover:bg-hover"><Download className="size-3.5" aria-hidden="true" /> Export evidence</button>
        <span className="truncate text-[11px] text-faint">For accreditation, by outcome</span>
      </div>
      {report && (
        <div role="dialog" aria-label="Sample evidence report" className="absolute inset-2 flex flex-col overflow-hidden rounded-xl border border-line bg-[#f7f7f5] p-4 text-[#0f1012] shadow-[var(--shadow-float)] sm:inset-3 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-[#6b6c72]">Sample report</p>
              <p className="mt-1 text-[15px] leading-snug font-semibold">ABET outcome {ex.outcome}: evidence</p>
              <p className="text-[12px] text-[#55565c]">School of Engineering · Fall 2026 · 25 projects · 6 faculty</p>
            </div>
            <button type="button" onClick={() => setReport(false)} aria-label="Close the report" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/5"><X className="size-4" /></button>
          </div>
          <table className="mt-3 w-full table-fixed text-left text-[11px]">
            <thead className="text-[#6b6c72]"><tr><th className="w-[44%] pb-1 font-medium">Project</th><th className="pb-1 font-medium">Where</th><th className="pb-1 font-medium max-sm:hidden">Verified by</th></tr></thead>
            <tbody className="divide-y divide-black/10">
              {[[title, ex.where.replace(" · Fall 2026", ""), ex.signer], ["Wind tunnel drag study, NACA 2412", "ME 345", "Prof. Webb"], ["Water filter for a clinic, field test", "Engineers Without Borders", "L. Grant"], ["Bike frame fatigue test to 50k cycles", "ME 410", "Prof. Sato"]].map(([p, w, s], i) => (
                <tr key={i} className={i === 0 ? "font-medium" : undefined}><td className="truncate py-1.5 pr-2">{p}</td><td className="truncate py-1.5 pr-2">{w}</td><td className="truncate py-1.5 max-sm:hidden">{s}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="mt-auto pt-3 text-[10px] text-[#6b6c72]">Each row links to the project, its files and who verified it. Exported as PDF and CSV.</p>
        </div>
      )}
    </div>
  );
}

// 4. The recruiter: a search by verified work finds the student, with who vouched; the student sees who looked.
export function RecruiterView({ ex, title, on, still }: ViewProps) {
  const [count, setTyped] = useState(0);
  const [shown, setSeen] = useState(false);
  // The query types itself out, the results come in, then the student's side: who looked.
  const typed = still ? ex.search.length : count, seen = still || shown;
  useEffect(() => {
    if (!on || still) return;
    const id = window.setInterval(() => setTyped((n) => { if (n >= ex.search.length) { window.clearInterval(id); return n; } return n + 1; }), 38);
    const t = window.setTimeout(() => setSeen(true), 38 * ex.search.length + 1300);
    return () => { window.clearInterval(id); window.clearTimeout(t); };
  }, [on, still, ex.search]);
  const done = typed >= ex.search.length;
  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden p-3 sm:p-4">
      <div className="flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3">
        <Search className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span className="min-w-0 truncate text-[14px]">{ex.search.slice(0, typed)}<span aria-hidden="true" className={cn("ml-px inline-block h-4 w-px translate-y-0.5 bg-text", done && "opacity-0")} /></span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {["Verified only", ex.major, "Class of 2027"].map((f, i) => <span key={f} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", i === 0 ? "border-ok/60 text-ok" : "border-line text-muted")}>{i === 0 && <Check className="size-3" aria-hidden="true" />}{f}</span>)}
      </div>
      <p className={cn(MONO, "transition-opacity", done ? "opacity-100" : "opacity-0")}>2 students · sorted by verified work</p>
      <ul className={cn("flex flex-col gap-2 transition-all duration-500", done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")}>
        <li className={cn(card, "p-3")}>
          <div className="flex items-center gap-2.5">
            <Initials name={STUDENT} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{STUDENT}</p><p className="truncate text-[11px] text-muted">{ex.major} · Class of 2027</p></div>
            <span className="inline-flex h-7 shrink-0 items-center rounded-lg border border-line-strong px-2.5 text-[12px] font-medium">Message</span>
          </div>
          <p className="mt-2.5 line-clamp-2 text-[13px] leading-snug font-medium break-words">{title}</p>
          <Verified ex={ex} className="mt-1.5 max-w-full" />
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-faint"><FileText className="size-3" aria-hidden="true" /> {ex.proof} · {ex.team.length - 1} teammates</p>
        </li>
        <li className={cn(card, "p-3 opacity-60 max-sm:hidden")}>
          <div className="flex items-center gap-2.5">
            <Initials name="Jordan Lee" />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Jordan Lee</p><p className="truncate text-[11px] text-muted">{ex.major} · Class of 2026</p></div>
          </div>
        </li>
      </ul>
      <div className={cn("absolute right-3 bottom-3 left-3 flex items-center gap-2.5 rounded-xl border border-line bg-raised px-3 py-2.5 shadow-[var(--shadow-float)] transition-all duration-500 sm:left-auto sm:w-72", seen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Eye className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0 text-[12px] leading-snug"><span className="block text-faint">What {STUDENT.split(" ")[0]} sees</span><span className="font-medium">Viewed by Pratt &amp; Whitney</span> · just now</span>
      </div>
    </div>
  );
}

// 5. Everywhere: the verified work as one card, and the three places it goes from there: LinkedIn
// (Add to LinkedIn, built), the résumé (built), and anywhere else by its verify link (Handshake, an
// application). One idea per tile, so the view reads at a glance; the tiles arrive one after another.
export function EverywhereView({ ex, title, on }: ViewProps) {
  const [added, setAdded] = useState(false);
  const [copied, setCopied] = useState(false);
  const rise = (i: number) => ({ transitionDelay: on ? `${120 + i * 90}ms` : "0ms" });
  const tile = cn(card, "flex flex-col p-3.5 transition-[opacity,translate] duration-500 ease-out", on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0");
  return (
    <div className="flex h-full flex-col justify-center gap-3 overflow-hidden p-4 sm:gap-4 sm:p-6">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow)] sm:p-5">
        <div className="flex gap-3">
          <Seal size={34} />
          <div className="min-w-0">
            <p className="line-clamp-2 text-[15px] leading-snug font-semibold break-words">{title}</p>
            <Verified ex={ex} className="mt-1 max-w-full" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          <Link2 className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-2">brazework.com/v/8f2k4q</span>
          <button type="button" onClick={() => setCopied(true)} tabIndex={on ? 0 : -1} className="h-7 shrink-0 rounded-md border border-line-strong px-2 text-[11px] font-medium transition hover:bg-hover">{copied ? "Copied" : "Copy link"}</button>
        </div>
      </div>
      <ul aria-label="Where it goes" className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
        <li className={tile} style={rise(0)}>
          <p className={MONO}>LinkedIn</p>
          <p className="mt-1 text-[13px] leading-snug text-text-2">Under Licenses &amp; certifications, with the verify link.</p>
          <button type="button" onClick={() => setAdded(true)} tabIndex={on ? 0 : -1} className={cn("mt-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-3 pt-0 text-[12px] font-semibold transition max-sm:mt-2.5 sm:mt-3", added ? "border border-ok/60 text-ok" : "bg-accent text-on-accent")}>
            {added ? <><Check className="size-3.5" aria-hidden="true" /> Added to LinkedIn</> : "Add to LinkedIn"}
          </button>
        </li>
        <li className={tile} style={rise(1)}>
          <p className={MONO}>Résumé</p>
          <p className="mt-1 text-[13px] leading-snug text-text-2">A Verified projects section, as a PDF.</p>
          <p className="mt-auto truncate pt-2.5 text-[11px] text-faint">{ex.name} · {ex.signer}</p>
        </li>
        <li className={cn(tile, "max-sm:hidden")} style={rise(2)}>
          <p className={MONO}>Handshake, applications</p>
          <p className="mt-1 text-[13px] leading-snug text-text-2">Paste the link. Anyone can check who verified it.</p>
        </li>
      </ul>
      <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted"><Lock className="size-3 shrink-0" aria-hidden="true" />Grades stay private: only you and your professors see them.</p>
    </div>
  );
}
