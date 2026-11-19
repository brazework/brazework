"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/forge";
import { claudeCodeSignIn, cursorLink, vscodeLink } from "@/lib/tool-setup";

// Add Brazework to Claude (the landing page's Connect section and /ai): the connector address with a
// copy button and the three steps in Claude, then one tap for the editors. Everything here is the
// one-click sign-in (lib/mcp-oauth.ts), so no token is shown or needed. `on`: whether a founder has
// switched sign-in on in Supabase (null while it's being checked). Until then, the card says so and
// points to the token path in Settings, so nobody follows steps that can't work yet.

export function ConnectCard({ endpoint, on, className }: { endpoint: string; on: boolean | null; className?: string }) {
  const ready = on !== false;
  return (
    <div className={cn("min-w-0 rounded-[1.25rem] border border-line bg-surface p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-semibold tracking-tight">Add Brazework to Claude</h3>
        {on === false && <span className="text-sm text-faint">Sign-in opens soon</span>}
      </div>
      <ol className="mt-4 flex flex-col gap-2.5 text-[15px] text-text-2">
        <Step n={1}>In Claude (the desktop app or claude.ai), open <b className="font-medium text-text">Settings → Connectors</b>.</Step>
        <Step n={2}>Choose <b className="font-medium text-text">Add custom connector</b>, name it Brazework, and paste this address:</Step>
      </ol>
      <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pr-1.5 pl-3">
        <code className="min-w-0 flex-1 truncate font-mono text-sm text-text" title={endpoint}>{endpoint}</code>
        <CopyButton text={endpoint} label="Copy address" />
      </div>
      <ol start={3} className="mt-3 text-[15px] text-text-2">
        <Step n={3}>Choose <b className="font-medium text-text">Connect</b> and log in to Brazework. Then ask: &ldquo;put what I finished today on my record.&rdquo;</Step>
      </ol>

      {ready ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm text-muted">Coding? One tap adds it to your editor; it asks you to log in the first time.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={cursorLink(endpoint)} className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium transition hover:bg-hover">Add to Cursor</a>
            <a href={vscodeLink(endpoint)} className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-medium transition hover:bg-hover">Add to VS Code</a>
          </div>
          <div className="mt-3 flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface-2 py-1.5 pr-1.5 pl-3">
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-text-2" title={claudeCodeSignIn(endpoint)}><span className="text-faint select-none">Claude Code $ </span>{claudeCodeSignIn(endpoint)}</code>
            <CopyButton text={claudeCodeSignIn(endpoint)} label="Copy command" />
          </div>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
          One-click sign-in isn&apos;t switched on yet. Until it is, make an account and connect with a token from{" "}
          <Link href="/settings/tools" className="font-medium text-text underline-offset-4 hover:underline">Settings → Your tools</Link>: Claude Code, Cursor, VS Code, Codex, Windsurf and Zed each get the exact command or link.
        </p>
      )}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-xs font-medium text-muted tabular-nums">{n}</span>
      <span className="min-w-0 pt-0.5">{children}</span>
    </li>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); }
        setTimeout(() => setState("idle"), 1600);
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-medium text-text shadow-sm ring-1 ring-line transition hover:bg-hover active:scale-95"
    >
      {state === "copied" ? <><Check className="size-3.5 text-ok" /> Copied</> : <><Copy className="size-3.5" /> {state === "failed" ? "Select and copy" : "Copy"}</>}
    </button>
  );
}
