"use client";
import { ArrowLeft, ArrowUpRight, Check, CircleDot, Copy, FileCode2, KeyRound, Loader2, Lock, Plug, ShieldCheck, Sparkles, Terminal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { createApiToken, listApiTokens, revokeApiToken, type ApiToken } from "@/lib/api-tokens";
import { cn, timeAgo } from "@/lib/forge";
import { TOOLS, isConnected, setupSteps, toolFor, type Step, type ToolInfo } from "@/lib/tool-setup";

// What an agent can do with Brazework today (the MCP server's read tools, lib/mcp.ts).
const CAN = ["Your profile and club-verified work", "Your clubs and this week's events", "Your projects and their milestones", "Your notifications", "Search clubs and people"];
const ASK = ["What's on in my clubs this week?", "Which of my projects still need a verified milestone?", "Find people in robotics I should meet."];

export function ToolsHub({ tokens, endpoint }: { tokens: ApiToken[]; endpoint: string }) {
  const [list, setList] = useState(tokens);
  const [open, setOpen] = useState<ToolInfo | null>(null);
  const active = list.filter((t) => !t.revoked_at);
  const statusFor = (tool: ToolInfo) => {
    const mine = active.filter((t) => toolFor(t.name)?.id === tool.id);
    if (mine.some(isConnected)) return "connected" as const;
    return mine.length ? ("waiting" as const) : ("none" as const);
  };
  // Stable, so the setup sheet's timers don't restart on every render.
  const refresh = useCallback(async () => setList(await listApiTokens()), []);
  const close = useCallback(() => setOpen(null), []);

  return (
    <div className="mt-6 space-y-6">
      {/* What it is, in one card: your agent reads your Brazework, safely. */}
      <section className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(closest-side,var(--accent),transparent)] opacity-[0.12]" />
        <div className="relative flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-text text-surface"><Plug className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Brazework, inside your agent</h2>
            <p className="mt-1 text-sm leading-relaxed text-text-2">Connect once and your coding agent knows what you&apos;re building, which clubs you&apos;re in and what&apos;s due this week, while you work.</p>
          </div>
        </div>
        <div className="relative mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium tracking-wide text-faint uppercase">It can read</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {CAN.map((c) => <li key={c} className="flex items-center gap-2 text-text-2"><Check className="size-3.5 shrink-0 text-ok" />{c}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium tracking-wide text-faint uppercase">Try asking</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {ASK.map((a) => <li key={a} className="flex items-start gap-2 text-text-2"><Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted" />&ldquo;{a}&rdquo;</li>)}
            </ul>
          </div>
        </div>
        <p className="relative mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted"><ShieldCheck className="size-3.5 shrink-0" /> Read-only: it can&apos;t post or change anything. Each tool gets its own token you can revoke here.</p>
      </section>

      {/* The tools. */}
      <section aria-label="Tools you can connect">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const s = statusFor(t);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t)} aria-label={`Connect ${t.name}`}
                  className="group glass-card flex h-full w-full items-start gap-3 rounded-3xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.4)] active:scale-[0.99]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 font-mono text-sm font-semibold tracking-tight">{t.monogram}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold tracking-tight">{t.name}</span>
                      {s === "connected" && <span className="inline-flex items-center gap-1 rounded-full bg-ok/12 px-2 py-0.5 text-[11px] font-medium text-ok"><Check className="size-3" />Connected</span>}
                      {s === "waiting" && <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted"><CircleDot className="size-3" />Not used yet</span>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-faint">{t.maker}</span>
                    <span className="mt-2 block text-sm text-text-2">{t.blurb}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-faint transition group-hover:text-text" />
                </button>
              </li>
            );
          })}
          <li>
            <div className="flex h-full items-start gap-3 rounded-3xl border border-dashed border-line p-4 text-left">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line text-faint"><Lock className="size-4" /></span>
              <span className="min-w-0">
                <span className="font-semibold tracking-tight text-text-2">Claude app</span>
                <span className="mt-0.5 block text-xs text-faint">claude.ai and Claude Desktop</span>
                <span className="mt-2 block text-sm text-muted">One-click sign-in is coming. Use Claude Code meanwhile.</span>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <Connected tokens={active} onRevoke={async (id) => { await revokeApiToken(id); await refresh(); }} />

      <AnimatePresence>
        {open && <SetupSheet key={open.id} tool={open} endpoint={endpoint} tokens={active} onClose={close} onChange={refresh} />}
      </AnimatePresence>
    </div>
  );
}

// Connecting one tool: make its token, follow its steps, and see it connect.
function SetupSheet({ tool, endpoint, tokens, onClose, onChange }: { tool: ToolInfo; endpoint: string; tokens: ApiToken[]; onClose: () => void; onChange: () => Promise<void> }) {
  const [token, setToken] = useState<{ id: string; value: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const [connected, setConnected] = useState(false);
  const full = tokens.length >= 5;

  // Close on Escape.
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  // Once the token exists, watch for the tool's first call (every 3 seconds, for up to 5 minutes).
  useEffect(() => {
    if (!token || connected) return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      const rows = await listApiTokens().catch(() => []);
      const row = rows.find((r) => r.id === token.id);
      if (row && isConnected(row)) { setConnected(true); void onChange(); clearInterval(t); }
      if (n > 100) clearInterval(t);
    }, 3000);
    return () => clearInterval(t);
  }, [token, connected, onChange]);

  const create = () => start(async () => {
    setMsg("");
    const r = await createApiToken(tool.tokenName);
    if (!r.ok || !r.token) { setMsg(r.message || "Couldn't make a token. Try again."); return; }
    setToken({ id: r.id ?? "", value: r.token });
    await onChange();
  });

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label={`Connect ${tool.name}`} onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-7">
        <div className="flex items-start gap-3">
          <button type="button" onClick={onClose} aria-label="Back" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:text-text sm:hidden"><ArrowLeft className="size-4" /></button>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 font-mono text-sm font-semibold">{tool.monogram}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Connect {tool.name}</h2>
            <p className="text-xs text-faint">{tool.maker}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="hidden size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-hover hover:text-text sm:grid"><X className="size-4" /></button>
        </div>

        <ol className="mt-6 space-y-5">
          <StepRow n={1} done={Boolean(token)} title={token ? "Token made" : `Make a token for ${tool.name}`}>
            {!token ? (
              <>
                <p className="text-sm text-text-2">A private key that lets {tool.name} read your Brazework. It&apos;s shown once; you can revoke it any time.</p>
                <Button onClick={create} disabled={pending || full} className="mt-3">{pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Make token</Button>
                {full && <p className="mt-2 text-xs text-muted">You have 5 active tokens. Revoke one below first.</p>}
                {msg && <p role="alert" className="mt-2 text-xs text-danger">{msg}</p>}
              </>
            ) : <p className="text-sm text-text-2">It&apos;s filled in below. This is the only time it&apos;s shown.</p>}
          </StepRow>

          <StepRow n={2} done={connected} dim={!token} title={`Add Brazework to ${tool.name}`}>
            {token ? <div className="space-y-4">{setupSteps(tool.id, endpoint, token.value).map((s, i) => <StepView key={i} step={s} />)}</div>
              : <p className="text-sm text-muted">Your steps appear here once the token is made.</p>}
          </StepRow>

          <StepRow n={3} done={connected} dim={!token} title={connected ? `${tool.name} is connected` : "Check it works"}>
            {connected ? (
              <p className="text-sm text-text-2">Try asking it: <span className="text-text">&ldquo;{ASK[0]}&rdquo;</span></p>
            ) : token ? (
              <p role="status" className="inline-flex items-center gap-2 text-sm text-muted"><Loader2 className="size-3.5 animate-spin" /> Waiting for {tool.name}&apos;s first request…</p>
            ) : <p className="text-sm text-muted">We&apos;ll show it here the moment {tool.name} connects.</p>}
          </StepRow>
        </ol>
      </motion.div>
    </motion.div>
  );
}

function StepRow({ n, title, done, dim, children }: { n: number; title: string; done?: boolean; dim?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex gap-3 transition", dim && "opacity-55")}>
      <span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-ok text-white" : "border border-line text-muted")}>{done ? <Check className="size-3.5" /> : n}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </li>
  );
}

function StepView({ step }: { step: Step }) {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => { void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  if (step.kind === "link") {
    return (
      <div>
        <a href={step.href} className="bg-accent-grad inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium text-on-accent shadow-[0_8px_24px_-10px_var(--accent)] transition hover:-translate-y-px active:translate-y-0">{step.label} <ArrowUpRight className="size-4" /></a>
        {step.note && <p className="mt-2 text-xs text-muted">{step.note}</p>}
      </div>
    );
  }
  const text = step.text;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted">
          {step.kind === "command" ? <Terminal className="size-3.5 shrink-0" /> : <FileCode2 className="size-3.5 shrink-0" />}
          <span className="truncate">{step.label}</span>
        </p>
        <button type="button" onClick={() => copy(text)} aria-label={`Copy: ${step.label}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium transition hover:border-line-strong">
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}{copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* The file to paste into, in full: it's the part people need to read exactly. */}
      {step.kind === "file" && <p className="mt-1.5 font-mono text-[12px] break-all text-text-2">{step.path}</p>}
      <pre className="mt-2 max-h-56 overflow-auto rounded-2xl border border-line bg-surface-2 p-3.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-text-2"><code>{text}</code></pre>
      {step.note && <p className="mt-2 text-xs text-muted">{step.note}</p>}
    </div>
  );
}

// Your connected tools: which token, when it was last used, and revoke.
function Connected({ tokens, onRevoke }: { tokens: ApiToken[]; onRevoke: (id: string) => Promise<void> }) {
  const [pending, start] = useTransition();
  if (!tokens.length) return null;
  return (
    <section aria-label="Your tokens">
      <h2 className="text-xs font-medium tracking-wide text-faint uppercase">Your tokens</h2>
      <ul className="glass-card mt-3 divide-y divide-line overflow-hidden rounded-3xl">
        {tokens.map((t) => {
          const tool = toolFor(t.name);
          const on = isConnected(t);
          return (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 font-mono text-xs font-semibold">{tool?.monogram ?? <KeyRound className="size-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.name}</p>
                <p className="truncate text-xs text-faint"><span className="font-mono">{t.prefix}…</span> · {on ? <span className="text-ok">used {timeAgo(t.last_used_at!)}</span> : "not used yet"}</p>
              </div>
              <button type="button" disabled={pending} onClick={() => { if (!confirm(`Revoke "${t.name}"? It stops working right away.`)) return; start(() => onRevoke(t.id)); }}
                className="inline-flex h-8 shrink-0 items-center rounded-full border border-line px-3 text-xs font-medium transition hover:border-danger hover:text-danger">Revoke</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
