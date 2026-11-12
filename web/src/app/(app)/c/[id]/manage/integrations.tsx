"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bot, CalendarSync, Check, GitBranch, Loader2, MessageCircle, Plug, Unplug } from "lucide-react";
import { useState, useTransition } from "react";
import { connectDiscord, disconnectDiscord, updateDiscordSettings } from "@/lib/connectors/club-actions";
import { cn } from "@/lib/forge";

type Discord = { connected: boolean; masked: string; events: boolean; milestones: boolean; updates: boolean };

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1.5 text-left text-sm">
      <span className="text-text-2">{label}</span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-accent-grad" : "bg-raised")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow", on ? "right-0.5" : "left-0.5")} />
      </span>
    </button>
  );
}

// Manage → Integrations: connect the tools the club already uses.
export function Integrations({ cid, discord: initial, available }: { cid: string; discord: Discord; available: boolean }) {
  const [d, setD] = useState(initial);
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const opts = { events: d.events, milestones: d.milestones, updates: d.updates };
  const run = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => start(async () => { const r = await fn(); setMsg({ ok: r.ok, text: r.message }); if (r.ok) after?.(); });
  const card = "rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)]";

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#5865F2] text-white"><MessageCircle className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">Discord</h3>
            <p className="text-sm text-muted">Announce new club events, verified milestones and weekly updates in your server.</p>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", d.connected ? "bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] text-ok" : "bg-surface-2 text-muted")}>{d.connected ? "Connected" : "Not connected"}</span>
        </div>
        {!available ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Integrations switch on once <code className="font-mono text-xs">supabase/integrations.sql</code> has run.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {d.connected ? (
              <p className="text-sm text-muted">Posting to webhook <span className="font-mono text-text-2">{d.masked}</span>. Mentions are always off, so Brazework can never ping @everyone.</p>
            ) : (
              <>
                <label htmlFor="hook" className="text-sm text-text-2">In Discord: <b className="font-medium">Server settings → Integrations → Webhooks → New webhook → Copy webhook URL</b>, then paste it here. Brazework sends a test message before saving.</label>
                <input id="hook" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/…" className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 font-mono text-sm outline-none focus:border-line-strong" />
              </>
            )}
            <div className="rounded-2xl bg-surface-2/60 p-2">
              <Toggle on={d.events} label="New club events" onChange={(v) => setD({ ...d, events: v })} />
              <Toggle on={d.milestones} label="Verified milestones" onChange={(v) => setD({ ...d, milestones: v })} />
              <Toggle on={d.updates} label="Weekly updates and posts officers share" onChange={(v) => setD({ ...d, updates: v })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {d.connected ? (
                <>
                  <button type="button" disabled={pending} onClick={() => run(() => updateDiscordSettings(cid, opts))} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save</button>
                  <button type="button" disabled={pending} onClick={() => confirm("Disconnect Discord? Brazework stops posting to that channel.") && run(() => disconnectDiscord(cid), () => setD({ ...d, connected: false, masked: "" }))} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-sm text-muted hover:text-danger"><Unplug className="size-4" /> Disconnect</button>
                </>
              ) : (
                <button type="button" disabled={pending || !url.trim()} onClick={() => run(() => connectDiscord(cid, url, opts), () => { setD({ ...d, connected: true, masked: `••••${url.trim().slice(-6)}` }); setUrl(""); })} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />} Connect and send a test</button>
              )}
              <AnimatePresence>{msg && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} role={msg.ok ? "status" : "alert"} className={cn("text-sm", msg.ok ? "text-ok" : "text-danger")}>{msg.text}</motion.span>}</AnimatePresence>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className={card}>
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-text text-bg"><GitBranch className="size-5" /></span><h3 className="font-semibold">GitHub</h3><span className="ml-auto rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-ok">Available</span></div>
          <p className="mt-3 text-sm text-muted">Members import public repos as projects (Add project → Import), and releases become milestones your club can verify. Copilot can read repos too.</p>
        </section>
        <section className={card}>
          <div className="flex items-center gap-3"><span className="bg-accent-grad grid size-10 place-items-center rounded-xl text-on-accent"><Bot className="size-5" /></span><h3 className="font-semibold">Copilot</h3><span className="ml-auto rounded-full bg-[color-mix(in_oklab,var(--ok)_14%,transparent)] px-2.5 py-1 text-xs font-medium text-ok">Built in</span></div>
          <p className="mt-3 text-sm text-muted">Reads this week&apos;s report and the verify queue, drafts updates, events and reviews, and shares to Discord. Nothing happens until an officer confirms.</p>
        </section>
      </div>

      <section className="rounded-3xl border border-dashed border-line-strong p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarSync className="size-4" /> Coming next</h3>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-muted sm:grid-cols-2">
          <li>· Calendar subscription for club events</li>
          <li>· Slack announcements</li>
          <li>· Onshape and Fusion 360 project imports</li>
          <li>· Use Brazework from any AI assistant (MCP)</li>
        </ul>
      </section>
    </div>
  );
}
