"use client";
import { EyeOff, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";
import { setPublicLine } from "@/lib/milestones";

// Proof without revealing confidential work (supabase/redacted-proof.sql): the owner writes one line
// that other members see in place of a private signed milestone, with who stood behind it in general
// terms ("signed by a coworker at a verified company") and the month. Nothing else about it shows.
export function PublicLine({ id, line }: { id: string; line: string }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(line);
  const [text, setText] = useState(line);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const save = (value: string) => start(async () => {
    const r = await setPublicLine(id, value);
    setMsg({ ok: r.ok, text: r.message });
    if (r.ok) { setSaved(value.trim().replace(/\s+/g, " ")); setOpen(false); }
  });
  if (!open) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="inline-flex items-center gap-1 font-medium text-text-2 hover:text-text">
          <EyeOff className="size-3" /> {saved ? <>Public line: <span className="font-normal italic">&ldquo;{saved}&rdquo;</span></> : "Add a public line"}
        </button>
        {msg && <span role="status" className={msg.ok ? "text-muted" : "text-danger"}>{msg.text}</span>}
      </span>
    );
  }
  return (
    <form className="mt-1 flex w-full flex-col gap-1.5" onSubmit={(e) => { e.preventDefault(); save(text); }}>
      <label className="text-xs text-muted">
        One line other members see instead of this private milestone, with who signed it in general terms and the month. No names, numbers or details you can&apos;t share.
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={140} placeholder="e.g. Shipped a payments migration" aria-label="Public line" className={cn(inputCls, "mt-1 h-9 text-sm")} />
      </label>
      {msg && !msg.ok && <p role="alert" className="text-xs text-danger">{msg.text}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-60">{pending && <Loader2 className="size-3 animate-spin" />}Save line</button>
        {saved && <button type="button" disabled={pending} onClick={() => { setText(""); save(""); }} className="h-8 rounded-lg px-3 text-xs text-muted hover:bg-hover">Remove</button>}
        <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-lg px-3 text-xs text-muted hover:bg-hover">Cancel</button>
      </div>
    </form>
  );
}
