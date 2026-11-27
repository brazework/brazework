"use client";
import { BadgeCheck, BookOpen, Check, ClipboardCheck, Download, FileText, Lock, Minus, Plus, Users } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";

// /schools: try the portal (2026-11-27). A working model of a school's Brazework, in four rooms the
// way faculty and offices use it: a course, its gradebook, the dean's evidence and student life's
// clubs. Grade a team's milestone against the rubric and verify it, and the gradebook, the evidence
// by ABET outcome and the club's numbers change with it. A guide at the top walks the three moves.
// Example school, people and numbers; nothing here is saved. Courses, rubric grading, the gradebook
// and the evidence export work today (app/(app)/c, supabase/courses*.sql).

type Sub = { id: string; team: string; members: string; title: string; file: string; club?: string; verified: boolean; scores: number[] };
const RUBRIC = [{ row: "Design and method", so: 1 }, { row: "Testing and results", so: 5 }, { row: "Teamwork", so: 4 }];
const OUTCOMES = ["Solving complex problems", "Engineering design", "Communication", "Ethics", "Teamwork", "Experimentation", "Learning"];
const START: Sub[] = [
  { id: "a", team: "Team Atlas", members: "Maya Chen, Noah Feld, Tara Singh", title: "Cut the pick-and-place cycle from 9.4 to 7.1 seconds", file: "cycle-test-500-runs.csv", verified: false, scores: [8, 9, 8] },
  { id: "b", team: "Team Vega", members: "Leo Park, Ana Ruiz", title: "Gripper holds 3 kg at ±0.05 mm over 200 picks", file: "grip-repeatability.xlsx", club: "Robotics Club", verified: false, scores: [7, 8, 9] },
  { id: "c", team: "Team Orion", members: "Sam Ortiz, Priya Nair", title: "Path planner avoids 12 of 12 obstacles at 0.5 m/s", file: "planner-run-04.mp4", verified: true, scores: [9, 9, 8] },
];
const BASE = [41, 28, 12, 9, 33, 46, 15];
const CLUBS = [{ name: "Robotics Club", members: 58, builds: 11 }, { name: "Rocketry Club", members: 34, builds: 9 }, { name: "Aerial Robotics", members: 21, builds: 6 }];
const ROOMS = [
  { id: "course", label: "Course", who: "Faculty", icon: BookOpen },
  { id: "gradebook", label: "Gradebook", who: "Faculty", icon: ClipboardCheck },
  { id: "evidence", label: "Evidence", who: "Dean", icon: BadgeCheck },
  { id: "clubs", label: "Clubs", who: "Student life", icon: Users },
] as const;
type Room = (typeof ROOMS)[number]["id"];

export function Portal() {
  const [room, setRoom] = useState<Room>("course");
  const [subs, setSubs] = useState(START);
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<number[]>([]);
  const [exported, setExported] = useState(false);
  const sub = subs.find((s) => s.id === open);
  const done = subs.filter((s) => s.verified && s.id !== "c").length;
  const guide = [!!open || done > 0, done > 0, done > 0 && (room === "evidence" || room === "clubs" || exported)];

  const evidence = BASE.map((n, i) => n + subs.filter((s) => s.verified && s.id !== "c" && RUBRIC.some((r) => r.so === i)).length);
  const clubs = CLUBS.map((c) => ({ ...c, builds: c.builds + subs.filter((s) => s.verified && s.id !== "c" && s.club === c.name).length }));

  const score = (k: number, d: number) => setSubs((all) => all.map((s) => s.id === open ? { ...s, scores: s.scores.map((v, i) => (i === k ? Math.max(0, Math.min(10, v + d)) : v)) } : s));
  const verify = () => {
    setSubs((all) => all.map((s) => (s.id === open ? { ...s, verified: true } : s)));
    setFresh(RUBRIC.map((r) => r.so));
  };
  const go = (r: Room) => { setRoom(r); if (r !== "course") setOpen(null); };

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface story-device">
      {/* The guide: three moves, ticked as they're done. */}
      <ol aria-label="Try it" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface-2/50 px-4 py-3 text-[13px] sm:px-5">
        {["Open a team's submission", "Grade it and verify", "See it in Evidence or Clubs"].map((t, i) => (
          <li key={t} className={cn("inline-flex items-center gap-2 transition-colors", guide[i] ? "text-text" : "text-muted")}>
            <span aria-hidden="true" className={cn("grid size-5 place-items-center rounded-full text-[11px] font-semibold transition-colors", guide[i] ? "bg-ok text-white dark:text-[#06240f]" : "border border-line-strong")}>{guide[i] ? <Check className="size-3" strokeWidth={3} /> : i + 1}</span>
            {t}<span className="sr-only">{guide[i] ? " (done)" : ""}</span>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 md:grid-cols-[12rem_minmax(0,1fr)]">
        {/* The rooms: a sidebar on a laptop, a row of tabs on a phone. */}
        <div role="tablist" aria-label="Portal" className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line p-2 md:flex-col md:border-r md:border-b-0 md:p-3">
          <p className="hidden px-2 pt-1 pb-2 text-[12px] font-semibold md:block">Demo University</p>
          {ROOMS.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={room === r.id} onClick={() => go(r.id)}
              className={cn("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] transition active:scale-[0.98]", room === r.id ? "bg-hover font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
              <r.icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="flex flex-col leading-tight">{r.label}<span className="hidden text-[11px] font-normal text-faint md:block">{r.who}</span></span>
            </button>
          ))}
        </div>

        <div role="tabpanel" aria-label={ROOMS.find((r) => r.id === room)!.label} className="min-h-[26rem] p-4 sm:p-5">
          {room === "course" && !sub && (
            <div key="list" className="hero-rise">
              <p className="text-[12px] text-faint">ME 482 Robotics, Fall 2026</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">Assignment 3: Cycle-time test</h3>
              <p className="mt-1 text-[13px] text-muted">Hand in the milestone with its evidence. Grading it verifies it.</p>
              <ul className="mt-4 flex flex-col gap-2">
                {subs.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => setOpen(s.id)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3.5 py-3 text-left transition hover:border-line-strong active:scale-[0.99]">
                      <span className="min-w-0 flex-1"><span className="block text-[14px] font-medium">{s.team}</span><span className="block truncate text-[12px] text-muted">{s.title}</span></span>
                      {s.verified ? <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-ok"><BadgeCheck className="size-4" aria-hidden="true" />Verified</span> : <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[12px] text-text-2">To grade</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {room === "course" && sub && (
            <div key={sub.id} className="hero-rise">
              <button type="button" onClick={() => setOpen(null)} className="text-[13px] text-muted hover:text-text">← All submissions</button>
              <h3 className="mt-2 text-[16px] leading-snug font-semibold">{sub.title}</h3>
              <p className="mt-1 text-[12px] text-muted">{sub.team}: {sub.members}{sub.club ? `, with ${sub.club}` : ""}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2/50 px-2.5 py-1.5 text-[12px]"><FileText className="size-3.5" aria-hidden="true" />{sub.file}</p>
              <ul aria-label="Rubric" className="mt-4 flex flex-col divide-y divide-line rounded-xl border border-line">
                {RUBRIC.map((r, k) => (
                  <li key={r.row} className="flex items-center gap-3 px-3.5 py-2.5">
                    <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium">{r.row}</span><span className="block text-[11px] text-faint">ABET SO {r.so + 1}, {OUTCOMES[r.so]}</span></span>
                    <span className="flex items-center gap-1">
                      <button type="button" disabled={sub.verified} aria-label={`Lower ${r.row}`} onClick={() => score(k, -1)} className="grid size-8 place-items-center rounded-lg border border-line transition hover:bg-hover disabled:opacity-40"><Minus className="size-3.5" aria-hidden="true" /></button>
                      <span className="w-12 text-center text-[13px] tabular-nums" aria-live="polite">{sub.scores[k]} / 10</span>
                      <button type="button" disabled={sub.verified} aria-label={`Raise ${r.row}`} onClick={() => score(k, 1)} className="grid size-8 place-items-center rounded-lg border border-line transition hover:bg-hover disabled:opacity-40"><Plus className="size-3.5" aria-hidden="true" /></button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {sub.verified ? (
                  <p role="status" className="inline-flex items-start gap-2 text-[13px]"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden="true" />Verified by Prof. Dana Ruiz, on each teammate&apos;s record. {sub.scores.reduce((a, b) => a + b, 0)} / 30 stays private to the team and the course&apos;s faculty.</p>
                ) : (
                  <button type="button" onClick={verify} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-[14px] font-semibold text-on-accent transition active:scale-95"><BadgeCheck className="size-4" aria-hidden="true" />Grade and verify</button>
                )}
                {sub.verified && <button type="button" onClick={() => go("evidence")} className="text-[13px] font-medium text-text underline-offset-4 hover:underline">See it in Evidence →</button>}
              </div>
            </div>
          )}

          {room === "gradebook" && (
            <div key="gb" className="hero-rise">
              <h3 className="text-lg font-semibold tracking-tight">Gradebook, ME 482</h3>
              <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-muted"><Lock className="size-3.5" aria-hidden="true" />Seen only by the course&apos;s faculty and each student</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[22rem] text-left text-[13px]">
                  <thead className="bg-surface-2/60 text-[12px] text-muted"><tr><th className="px-3 py-2 font-medium">Team</th><th className="px-3 py-2 font-medium">A2</th><th className="px-3 py-2 font-medium">A3</th><th className="px-3 py-2 font-medium">Record</th></tr></thead>
                  <tbody>
                    {subs.map((s, i) => (
                      <tr key={s.id} className="border-t border-line"><td className="px-3 py-2.5 font-medium">{s.team}</td><td className="px-3 py-2.5 tabular-nums">{[27, 25, 28][i]} / 30</td><td className="px-3 py-2.5 tabular-nums">{s.verified ? `${s.scores.reduce((a, b) => a + b, 0)} / 30` : "—"}</td><td className="px-3 py-2.5">{s.verified ? <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" />Verified</span> : <span className="text-faint">Not yet</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[12px] text-faint">Export as CSV any time.</p>
            </div>
          )}

          {room === "evidence" && (
            <div key="ev" className="hero-rise">
              <h3 className="text-lg font-semibold tracking-tight">Evidence by ABET outcome</h3>
              <p className="mt-1 text-[13px] text-muted">Verified work across the department, Fall 2026. Your offices see counts, never a grade.</p>
              <ul className="mt-4 flex flex-col gap-2">
                {evidence.map((n, i) => (
                  <li key={OUTCOMES[i]} className="grid grid-cols-[3rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-[13px] sm:grid-cols-[11rem_minmax(0,1fr)_2.5rem]">
                    <span className="truncate text-text-2"><span className="sm:hidden">SO {i + 1}</span><span className="max-sm:hidden">SO {i + 1} {OUTCOMES[i]}</span></span>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--brand),var(--heat-amber))] transition-[width] duration-700" style={{ width: `${(n / 60) * 100}%` }} /></span>
                    <span className={cn("text-right tabular-nums transition-colors", fresh.includes(i) && done > 0 ? "font-semibold text-ok" : "text-muted")}>{n}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setExported(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] transition hover:bg-hover active:scale-95"><Download className="size-3.5" aria-hidden="true" />Download for the self-study</button>
                {exported && <span role="status" className="text-[12px] text-muted">Ready (an example: nothing downloads here).</span>}
                {done === 0 && <span className="text-[12px] text-faint">Verify a submission in Course and watch these move.</span>}
              </div>
            </div>
          )}

          {room === "clubs" && (
            <div key="cl" className="hero-rise">
              <h3 className="text-lg font-semibold tracking-tight">Clubs this semester</h3>
              <p className="mt-1 text-[13px] text-muted">Which clubs are active, how many students build with them, and what they made.</p>
              <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                {clubs.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-3 px-3.5 py-3 text-[13px]"><span className="font-medium">{c.name}</span><span className="text-muted tabular-nums">{c.members} members, {c.builds} verified builds</span></li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-faint">Class work done with a club counts for the club too. Try Team Vega.</p>
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-line px-4 py-2.5 text-[12px] text-faint sm:px-5">Example school, people and numbers. Nothing here is saved.</p>
    </div>
  );
}
