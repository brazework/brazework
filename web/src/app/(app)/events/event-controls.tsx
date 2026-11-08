"use client";
import { motion } from "motion/react";
import { Bookmark, CalendarPlus, Check, Loader2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { cn } from "@/lib/forge";
import { toggleRsvp, toggleSave } from "./actions";

export type Marks = { going: boolean; saved: boolean; count: number };

// RSVP and save update right away and fall back to the server's state if the database refuses,
// like the vanilla app. The server re-renders in the same response, so nothing flicks back on success.
export function useEventMarks(eventId: string, initial: Marks) {
  const [, start] = useTransition();
  const [error, setError] = useState("");
  const [marks, setMarks] = useOptimistic(initial, (_, next: Marks) => next);
  const fail = { ok: false, message: "Couldn't save that. Check your connection." };

  const rsvp = () =>
    start(async () => {
      setError("");
      const going = !marks.going;
      setMarks({ ...marks, going, count: Math.max(0, marks.count + (going ? 1 : -1)) });
      const res = await toggleRsvp(eventId, going).catch(() => fail);
      if (!res.ok) setError(res.message);
    });

  const save = () =>
    start(async () => {
      setError("");
      const saved = !marks.saved;
      setMarks({ ...marks, saved });
      const res = await toggleSave(eventId, saved).catch(() => fail);
      if (!res.ok) setError(res.message);
    });

  return { marks, rsvp, save, error };
}

export function RsvpButton({ going, onClick, className }: { going: boolean; onClick: () => void; className?: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      aria-pressed={going}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition",
        going ? "border border-line-strong bg-raised text-text hover:bg-hover" : "bg-accent text-on-accent shadow-[var(--shadow)] hover:opacity-90",
        className,
      )}
    >
      {going ? <><Check className="size-4" /> Going</> : "RSVP"}
    </motion.button>
  );
}

export function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  const label = saved ? "Remove from saved events" : "Save event";
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full border transition",
        saved ? "border-line-strong bg-raised text-text" : "border-line text-muted hover:border-line-strong hover:text-text",
      )}
    >
      <Bookmark className={cn("size-[18px]", saved && "fill-current")} />
    </motion.button>
  );
}

// Downloads a real .ics from /events/[id]/ics, which opens in Google, Apple or Outlook calendars.
export function CalendarButton({ eventId, className }: { eventId: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <span className="inline-flex flex-col gap-1">
      <a
        href={`/events/${encodeURIComponent(eventId)}/ics`}
        download
        onClick={() => {
          setState("busy");
          setTimeout(() => setState("done"), 600);
          setTimeout(() => setState("idle"), 6000);
        }}
        className={cn("inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line px-4 text-sm text-text transition hover:border-line-strong hover:bg-hover", className)}
      >
        {state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
        Add to calendar
      </a>
      <span role="status" className="text-xs text-faint">{state === "done" ? "Downloaded. Open the file to add it to your calendar." : ""}</span>
    </span>
  );
}
