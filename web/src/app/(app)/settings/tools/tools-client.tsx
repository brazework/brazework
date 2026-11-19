"use client";
import { Orb } from "@/components/landing/orb";
import { ArrowLeft, ArrowUpRight, Check, CircleDot, Copy, FileCode2, KeyRound, Loader2, Lock, PenLine, ShieldCheck, Sparkles, Terminal, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { createApiToken, listApiTokens, revokeApiToken, setTokenCanPost, type ApiToken } from "@/lib/api-tokens";
import { cn, timeAgo } from "@/lib/forge";
import { TOOLS, draftsOnly, isConnected, setupSteps, toolFor, type Step, type ToolInfo } from "@/lib/tool-setup";
import { FieldRecipes } from "./recipes";

// What an agent can do with Brazework today (the MCP server's read tools, lib/mcp.ts).
const CAN = ["Your profile and club-verified work", "Your clubs and this week's events", "Your projects and their milestones", "Your notifications", "Search clubs and people"];
const ASK = ["What's on in my clubs this week?", "Which of my projects still need a verified milestone?", "Find people in robotics I should meet."];

// `writes`: tools may post for you once you allow it (supabase/mcp-writes.sql has run).
// `drafts`: tools can leave drafts you approve, and GitHub Actions can be connected (supabase/mcp-workflows.sql).
type Project = { id: string; title: string };
type Club = { id: string; name: string };
export function ToolsHub({ tokens, endpoint, writes = false, drafts = false, projects = [], clubs = [], field = "", signIn = false }: { tokens: ApiToken[]; endpoint: string; writes?: boolean; drafts?: boolean; projects?: Project[]; clubs?: Club[]; field?: string; signIn?: boolean }) {
  const [list, setList] = useState(tokens);
  const [open, setOpen] = useState<ToolInfo | null>(null);
  const tools = TOOLS.filter((t) => drafts || !draftsOnly(t.id));
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
        <div className="relative flex items-start gap-4">
          {/* The orb from the landing page (FIX-92): your agent and Brazework, connected. */}
          <Orb tone="auto" className="size-14 shrink-0" />
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
        {drafts ? (
          <p className="relative mt-4 flex items-start gap-2 rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-text-2"><PenLine className="mt-0.5 size-4 shrink-0 text-muted" /><span><strong className="font-medium text-text">It turns your work into your record.</strong> Start with <code className="font-mono text-[13px]">/start</code>, then <code className="font-mono text-[13px]">/shipped</code>, <code className="font-mono text-[13px]">/result</code> or <code className="font-mono text-[13px]">/week</code> in your assistant and it drafts the post or milestone from your own tools, with the proof. It waits in <Link href="/drafts" className="font-medium text-text underline-offset-4 hover:underline">Drafts</Link> for you to approve, or, if you let a tool post, it shows you first and asks.</span></p>
        ) : writes && (
          <p className="relative mt-4 flex items-start gap-2 rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-text-2"><PenLine className="mt-0.5 size-4 shrink-0 text-muted" /><span><strong className="font-medium text-text">If you let it,</strong> it can also post a build update for you, or log a milestone with its evidence for your club to verify. It asks you first, and the post or milestone says which tool made it.</span></p>
        )}
        <p className="relative mt-5 flex items-center gap-2 border-t border-line pt-4 text-xs text-muted"><ShieldCheck className="size-3.5 shrink-0" /> {drafts ? "Nothing goes out without you: tools leave drafts, unless you turn on posting for one. Nothing is ever changed or deleted." : writes ? "Read-only unless you turn on posting for a tool. Nothing is ever changed or deleted." : "Read-only: it can't post or change anything."} Each tool gets its own token you can revoke here.</p>
      </section>

      {/* One-click connect (lib/mcp-oauth.ts): add the address, sign in, approve. No token to copy. */}
      {signIn && <SignInCard endpoint={endpoint} />}

      {/* The tools. */}
      <section aria-label="Tools you can connect">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const s = statusFor(t);
            return (
              <li key={t.id}>
                <button type="button" onClick={() => setOpen(t)} aria-label={`Connect ${t.name}`}
                  className="group glass-card flex h-full w-full items-start gap-3 rounded-3xl p-4 text-left transition hover:border-line-strong active:scale-[0.99]">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 font-mono text-sm font-semibold tracking-tight">{t.monogram}</span>
                  <span className="min-w-0 flex-1">
                    {/* The status wraps under the name rather than squeezing it onto two lines. */}
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold tracking-tight whitespace-nowrap">{t.name}</span>
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

      <Connected tokens={active} writes={writes} onRevoke={async (id) => { await revokeApiToken(id); await refresh(); }} onPost={async (id, on) => { await setTokenCanPost(id, on); await refresh(); }} />

      {drafts && <FieldRecipes initialField={field} />}

      <AnimatePresence>
        {open && <SetupSheet key={open.id} tool={open} endpoint={endpoint} tokens={active} writes={writes} projects={projects} clubs={clubs} onClose={close} onChange={refresh} />}
      </AnimatePresence>
    </div>
  );
}

// Connecting one tool: make its token, follow its steps, and see it connect.
function SetupSheet({ tool, endpoint, tokens, writes, projects, clubs, onClose, onChange }: { tool: ToolInfo; endpoint: string; tokens: ApiToken[]; writes: boolean; projects: Project[]; clubs: Club[]; onClose: () => void; onChange: () => Promise<void> }) {
  const [canPost, setCanPost] = useState(false);
  // An automation (GitHub Actions) only ever leaves drafts, into one of your projects, and optionally
  // for one of your clubs to verify once you approve them.
  const automation = draftsOnly(tool.id);
  const [project, setProject] = useState(projects[0]?.id ?? "");
  const [club, setClub] = useState("");
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
    const r = await createApiToken(tool.tokenName, canPost && !automation);
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
                <p className="text-sm text-text-2">{automation
                  ? <>A private key that lets {tool.name} leave drafts in your Brazework, and nothing more: it can&apos;t post. You approve each one in Drafts. It&apos;s shown once; you can revoke it any time.</>
                  : <>A private key that lets {tool.name} read your Brazework. It&apos;s shown once; you can revoke it any time.</>}</p>
                {automation && (projects.length ? (<>
                  <label className="mt-3 block text-sm"><span className="font-medium">Which project its drafts go to</span>
                    <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project for drafts" className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px]">
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </label>
                  {clubs.length > 0 && (
                    <label className="mt-3 block text-sm"><span className="font-medium">Which club verifies them</span>
                      <select value={club} onChange={(e) => setClub(e.target.value)} aria-label="Club to verify" className="mt-1.5 h-10 w-full rounded-lg border border-line bg-surface px-3 text-[15px]">
                        <option value="">None: I&apos;ll ask someone to vouch</option>
                        {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                  )}
                </>) : <p className="mt-3 text-sm text-muted">Make a project first, so its drafts have somewhere to go. <Link href="/projects" className="font-medium text-text underline-offset-4 hover:underline">Projects</Link></p>)}
                {writes && !automation && <PostSwitch on={canPost} onChange={setCanPost} tool={tool.name} className="mt-3" />}
                <Button onClick={create} disabled={pending || full || (automation && !project)} className="mt-3">{pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Make token</Button>
                {full && <p className="mt-2 text-xs text-muted">You have 5 active tokens. Revoke one below first.</p>}
                {msg && <p role="alert" className="mt-2 text-xs text-danger">{msg}</p>}
              </>
            ) : <p className="text-sm text-text-2">It&apos;s filled in below. This is the only time it&apos;s shown.{canPost && <> {tool.name} can post updates for you; it asks first.</>}</p>}
          </StepRow>

          <StepRow n={2} done={connected} dim={!token} title={`Add Brazework to ${tool.name}`}>
            {token ? <div className="space-y-4">{setupSteps(tool.id, endpoint, token.value, { project, club }).map((s, i) => <StepView key={i} step={s} />)}</div>
              : <p className="text-sm text-muted">Your steps appear here once the token is made.</p>}
          </StepRow>

          <StepRow n={3} done={connected} dim={!token} title={connected ? `${tool.name} is connected` : "Check it works"}>
            {connected ? (
              <p className="text-sm text-text-2">{automation ? <>Merge a pull request: its milestone draft appears in <Link href="/drafts" className="font-medium text-text underline-offset-4 hover:underline">Drafts</Link>.</> : <>Try asking it: <span className="text-text">&ldquo;{canPost ? "Post an update about what I just shipped on my project." : ASK[0]}&rdquo;</span></>}</p>
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
        <a href={step.href} className="bg-accent-grad inline-flex h-11 items-center gap-2 rounded-lg px-5 text-sm font-medium text-on-accent transition active:translate-y-0">{step.label} <ArrowUpRight className="size-4" /></a>
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
        <button type="button" onClick={() => copy(text)} aria-label={`Copy: ${step.label}`} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium transition hover:border-line-strong">
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
function Connected({ tokens, writes, onRevoke, onPost }: { tokens: ApiToken[]; writes: boolean; onRevoke: (id: string) => Promise<void>; onPost: (id: string, on: boolean) => Promise<void> }) {
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
              {writes && (tool && draftsOnly(tool.id)
                ? <span className="hidden shrink-0 text-xs text-muted sm:inline">Drafts only</span>
                : <PostSwitch on={Boolean(t.scopes?.includes("post"))} onChange={(on) => start(() => onPost(t.id, on))} tool={t.name} compact disabled={pending} />)}
              <button type="button" disabled={pending} onClick={() => { if (!confirm(`Revoke "${t.name}"? It stops working right away.`)) return; start(() => onRevoke(t.id)); }}
                className="inline-flex h-8 shrink-0 items-center rounded-lg border border-line px-3 text-xs font-medium transition hover:border-danger hover:text-danger">Revoke</button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// "Can post": lets a tool post build updates as you (it still asks you first, in the tool).
function PostSwitch({ on, onChange, tool, compact, disabled, className }: { on: boolean; onChange: (on: boolean) => void; tool: string; compact?: boolean; disabled?: boolean; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3", compact && "shrink-0", className)}>
      <button type="button" role="switch" aria-checked={on} aria-label={`${tool} can post updates for me`} disabled={disabled} onClick={() => onChange(!on)}
        className={cn("relative h-6 w-10 shrink-0 rounded-full transition", on ? "bg-text" : "bg-line-strong/60")}>
        <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition", on && "translate-x-4")} />
      </button>
      {compact ? <span className="hidden text-xs text-muted sm:inline">Can post</span> : (
        <span className="text-sm"><span className="font-medium">Let it post updates for me</span><span className="block text-xs text-muted">Updates and milestones for your club to verify. It asks first, and they say &ldquo;via {tool}&rdquo;.</span></span>
      )}
    </label>
  );
}

// Shown once the OAuth server is switched on in Supabase: assistants that sign in need only the address.
function SignInCard({ endpoint }: { endpoint: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `claude mcp add --transport http brazework ${endpoint}`;
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {} };
  return (
    <section aria-labelledby="sign-in-connect" className="rounded-3xl border border-line bg-surface p-6 sm:p-7">
      <h2 id="sign-in-connect" className="text-lg font-semibold tracking-tight">Sign in from your assistant, no token</h2>
      <p className="mt-1 text-sm text-text-2">Add Brazework by its address. Your assistant opens Brazework, you approve it, and you&apos;re connected. It starts reading and leaving drafts; you can turn on posting for it below.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-surface-2 px-3 py-2 font-mono text-[13px]">{endpoint}</code>
        <button type="button" onClick={() => copy(endpoint)} className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm hover:bg-hover">{copied ? "Copied" : "Copy address"}</button>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-text-2">
        <li><strong className="font-medium text-text">Claude</strong> (web and desktop): Settings → Connectors → Add custom connector, and paste the address.</li>
        <li><strong className="font-medium text-text">Claude Code:</strong> <button type="button" onClick={() => copy(cmd)} className="font-mono text-[13px] underline-offset-4 hover:underline">{cmd}</button>, then <code className="font-mono text-[13px]">/mcp</code> to sign in.</li>
        <li><strong className="font-medium text-text">Cursor, VS Code and others:</strong> add an MCP server with this address; they ask you to sign in.</li>
      </ul>
      <p className="mt-3 text-xs text-muted">GitHub Actions and scripts still use a token: pick them below.</p>
    </section>
  );
}
