"use client";
import { ArrowRight, Check, ClipboardList, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { inputCls } from "@/components/ui";
import { sendToClassChat } from "@/lib/chats";
import { cn } from "@/lib/forge";

// The student portal's interactive parts (student-home.tsx): this week's work as a strip of days to
// tap, and a quick box to post in a class's chat. Motion only answers a tap (docs/design/app.md).

export type DueItem = { id: string; classId: string; course: string; title: string; dueAt: string | null; points: number; group: boolean };

const DAY = 86_400_000;
const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

function countdown(due: string | null, now: number) {
  if (!due) return "No due date";
  const ms = new Date(due).getTime() - now;
  if (ms < 0) return "Late";
  const h = Math.round(ms / 3_600_000);
  if (h < 1) return "Due within the hour";
  if (h < 24) return `Due in ${h} ${h === 1 ? "hour" : "hours"}`;
  const d = Math.round(ms / DAY);
  return `Due in ${d} ${d === 1 ? "day" : "days"}`;
}

export function WeekPlanner({ items, now }: { items: DueItem[]; now: number }) {
  const today = startOfDay(now);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => today + i * DAY), [today]);
  const [day, setDay] = useState<number | null>(null);
  const on = (d: number, it: DueItem) => !!it.dueAt && new Date(it.dueAt).getTime() >= d && new Date(it.dueAt).getTime() < d + DAY;
  const shown = day === null ? items : items.filter((it) => on(day, it));
  const late = items.filter((it) => it.dueAt && new Date(it.dueAt).getTime() < now);

  return (
    <section aria-labelledby="week-h" className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week-h" className="text-lg font-semibold tracking-tight">This week</h2>
        {day !== null && <button type="button" onClick={() => setDay(null)} className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Show everything</button>}
      </div>
      <div role="group" aria-label="Pick a day" className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const n = items.filter((it) => on(d, it)).length;
          const date = new Date(d);
          return (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(day === d ? null : d)} suppressHydrationWarning
              aria-label={`${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}${n ? `, ${n} due` : ", nothing due"}`}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition active:scale-95",
                day === d ? "border-text bg-text text-bg" : d === today ? "border-line-strong bg-surface" : "border-line bg-surface/60 hover:border-line-strong")}>
              <span suppressHydrationWarning className={cn("text-[11px]", day === d ? "text-bg/80" : "text-muted")}>{date.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span suppressHydrationWarning className="text-[17px] font-semibold tabular-nums">{date.getDate()}</span>
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", n ? (day === d ? "bg-bg" : "bg-text") : "bg-transparent")} />
            </button>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {shown.map((it) => {
          const isLate = !!it.dueAt && new Date(it.dueAt).getTime() < now;
          return (
            <li key={it.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
              <ClipboardList className="size-4 shrink-0 text-text-2" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{it.title}</span>
                <span className="block truncate text-[13px] text-muted">{[it.course, `${it.points} points`, it.group ? "Group work" : null].filter(Boolean).join(" · ")}</span>
              </span>
              <span suppressHydrationWarning className={cn("hidden shrink-0 text-[13px] sm:block", isLate ? "font-medium text-danger" : "text-text-2")}>{countdown(it.dueAt, now)}</span>
              <Link href={`/c/${it.classId}/course/a/${it.id}`} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent transition hover:opacity-90 active:scale-95">
                Hand in <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-sm text-muted">
            {day === null ? "Nothing due in the next two weeks. Log what you're building while it's fresh." : "Nothing due that day."}
          </li>
        )}
      </ul>
      {day === null && late.length > 0 && <p className="mt-3 text-[13px] text-danger">{late.length} past due. Hand it in, or ask your professor for an extension.</p>}
    </section>
  );
}

export function QuickChat({ classes }: { classes: { id: string; label: string }[] }) {
  const [cid, setCid] = useState(classes[0]?.id ?? "");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string; id?: string } | null>(null);
  if (!classes.length) return null;
  const send = () => start(async () => {
    const r = await sendToClassChat(cid, text);
    setResult(r);
    if (r.ok) setText("");
  });
  return (
    <form aria-label="Message a class" onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(); }} className="flex flex-col gap-2">
      {classes.length > 1 && (
        <select aria-label="Class" value={cid} onChange={(e) => { setCid(e.target.value); setResult(null); }} className={cn(inputCls, "h-9 text-sm")}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} maxLength={2000} aria-label={`Message ${classes.find((c) => c.id === cid)?.label ?? "your class"}`}
          placeholder={`Message ${classes.find((c) => c.id === cid)?.label ?? "your class"}`} className={cn(inputCls, "h-10 min-w-0 flex-1")} />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Send" className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-on-accent transition hover:opacity-90 active:scale-95 disabled:opacity-40">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      <p role="status" className="min-h-5 text-[13px]">
        {result?.ok && <span className="inline-flex items-center gap-1.5 text-text-2"><Check className="size-3.5 text-ok" aria-hidden="true" />Sent. <Link href={`/messages/g/${result.id}`} className="font-medium text-text underline-offset-4 hover:underline">Open the chat</Link></span>}
        {result && !result.ok && <span className="text-danger">{result.message}</span>}
      </p>
    </form>
  );
}
