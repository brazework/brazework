"use client";
import { BadgeCheck, ExternalLink, FileCheck2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/forge";
import { RELATIONSHIPS } from "@/lib/vouch-email";
import { answerVouches, type InboxAsk } from "@/lib/vouches";

type Row = { pick: "vouch" | "decline" | "skip"; saw: string; knowsFrom: string };

// The other asks sent to the same address (supabase/signer-tools.sql), answered together: your name
// and role once, then for each one what you saw and how you know their work, or "I can't vouch".
// Each is checked on its own, under the same rules as a single vouch; one refused doesn't stop the rest.
export function MoreAsks({ token, asks, domain }: { token: string; asks: InboxAsk[]; domain: string }) {
  const [rows, setRows] = useState<Record<number, Row>>(() => Object.fromEntries(asks.map((a) => [a.id, { pick: "skip", saw: "", knowsFrom: "" }])));
  const [who, setWho] = useState({ name: "", title: "" });
  const [res, setRes] = useState<{ message: string; by: Record<number, { ok: boolean; message: string }> } | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (id: number, p: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...p } }));
  const chosen = asks.filter((a) => rows[a.id]?.pick !== "skip" && !res?.by[a.id]?.ok);
  const field = "mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none transition focus:border-line-strong";

  const send = () => start(async () => {
    setError("");
    const r = await answerVouches({ token, ...who, items: chosen.map((a) => ({ id: a.id, vouch: rows[a.id].pick === "vouch", saw: rows[a.id].saw, knowsFrom: rows[a.id].knowsFrom })) });
    if (!r.results) { setError(r.message); return; }
    setRes((prev) => ({ message: r.message, by: { ...(prev?.by ?? {}), ...Object.fromEntries(r.results!.map((x) => [x.id, x])) } }));
  });

  return (
    <section aria-labelledby="more-h" className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] sm:p-7">
      <h2 id="more-h" className="text-lg font-semibold tracking-tight">{asks.length === 1 ? "1 more ask is" : `${asks.length} more asks are`} waiting for you</h2>
      <p className="mt-1 text-sm text-muted">Sent to the same address, so you can answer them here together. Each needs its own sentence on what you saw.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Your name<input minLength={2} maxLength={80} autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} className={field} /></label>
        <label className="text-sm font-medium">Your role <span className="font-normal text-faint">(optional)</span><input maxLength={80} placeholder="e.g. Assistant Professor" value={who.title} onChange={(e) => setWho({ ...who, title: e.target.value })} className={field} /></label>
      </div>
      <ul className="mt-5 flex flex-col gap-4">
        {asks.map((a) => {
          const r = rows[a.id]; const out = res?.by[a.id];
          return (
            <li key={a.id} aria-label={a.title} className={cn("rounded-xl border p-4", out?.ok ? "border-line bg-surface-2/60" : "border-line")}>
              <p className="text-xs text-muted"><b className="font-semibold text-text-2">{a.member || "Someone"}</b> listed you as {RELATIONSHIPS[a.relationship]}{a.project && ` · ${a.project}`}</p>
              <h3 className="mt-1 font-semibold tracking-tight">{a.title}</h3>
              {a.detail && <p className="mt-1 text-sm leading-relaxed text-text-2">{a.detail}</p>}
              {a.links.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {a.links.map((u) => <li key={u}><a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"><FileCheck2 className="size-4 shrink-0" /><span className="truncate">{u.replace(/^https:\/\//, "")}</span><ExternalLink className="size-3.5 shrink-0 text-faint" /></a></li>)}
                </ul>
              )}
              {out?.ok ? <p role="status" className="mt-3 inline-flex items-center gap-1.5 text-sm"><BadgeCheck className="size-4" />{out.message}</p> : (
                <>
                  <fieldset className="mt-3 flex flex-wrap gap-2">
                    <legend className="sr-only">Your answer for {a.title}</legend>
                    {(["vouch", "decline", "skip"] as const).map((p) => (
                      <label key={p} className={cn("inline-flex h-9 cursor-pointer items-center rounded-lg border px-3 text-sm", r.pick === p ? "border-line-strong bg-hover font-medium" : "border-line text-muted")}>
                        <input type="radio" name={`pick-${a.id}`} value={p} checked={r.pick === p} onChange={() => set(a.id, { pick: p })} className="sr-only" />
                        {p === "vouch" ? "Vouch" : p === "decline" ? "I can't vouch" : "Not now"}
                      </label>
                    ))}
                  </fieldset>
                  {r.pick === "vouch" && (
                    <div className="mt-3 flex flex-col gap-3">
                      <label className="text-sm font-medium">What did you see them do?<textarea minLength={20} maxLength={600} rows={2} value={r.saw} onChange={(e) => set(a.id, { saw: e.target.value })} className={field} /></label>
                      <label className="text-sm font-medium">How do you know their work?<input minLength={3} maxLength={300} value={r.knowsFrom} onChange={(e) => set(a.id, { knowsFrom: e.target.value })} className={field} /></label>
                    </div>
                  )}
                  {out && !out.ok && <p role="alert" className="mt-2 text-sm text-danger">{out.message}</p>}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-faint">Each vouch shows on their record as your name, role and <b className="font-medium">{domain}</b>, with what you wrote. You sign as yourself, not on behalf of your employer.</p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      {res && <p role="status" className="mt-2 text-sm text-muted">{res.message}</p>}
      <Button className="mt-4" disabled={pending || chosen.length === 0} onClick={send}><BadgeCheck className="size-4" />{chosen.length > 1 ? `Answer these ${chosen.length}` : "Answer"}</Button>
    </section>
  );
}
