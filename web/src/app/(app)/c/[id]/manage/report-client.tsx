"use client";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { revokeClubReport, shareClubReport } from "@/lib/club-share";
import { Lookups, Rich } from "@/app/(app)/copilot/copilot-client";
import { ProposalCard } from "@/components/copilot/proposal-card";
import { useCopilot } from "@/components/copilot/use-copilot";
import type { Proposal } from "@/lib/copilot-agent";
import type { ClubReport } from "@/lib/club-report";

// The quick template: this week's numbers as a club post, no AI needed.
function template(r: ClubReport) {
  const lines = [`This week in ${r.name}:`];
  if (r.newMembers) lines.push(`- Welcome to our ${r.newMembers} new member${r.newMembers === 1 ? "" : "s"}${r.newMemberNames.length ? `: ${r.newMemberNames.join(", ")}` : ""}!`);
  lines.push(`- ${r.posts.thisWeek} post${r.posts.thisWeek === 1 ? "" : "s"} this week${r.topPost ? `. Top post by ${r.topPost.author}.` : "."}`);
  if (r.milestones?.verifiedThisWeek) lines.push(`- ${r.milestones.verifiedThisWeek} milestone${r.milestones.verifiedThisWeek === 1 ? "" : "s"} verified by the club.`);
  if (r.upcoming.length) lines.push(`- Coming up: ${r.upcoming.slice(0, 3).map((e) => `${e.title} (${new Date(e.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })})`).join(", ")}.`);
  lines.push("", "Built something this week? Add it to a project on your profile and ask the club to verify it.");
  return lines.join("\n");
}

export function ClubUpdate({ report, clubId, copilot }: { report: ClubReport; clubId: string; copilot: boolean }) {
  const ai = useCopilot();
  const [text, setText] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [cards, setCards] = useState<Proposal[]>([]);
  const draft = () => {
    setCards([]);
    void ai.run(
      { task: "ask", input: `Use club_report for club ${clubId}, then draft this week's update for ${report.name} with propose_club_post: welcome new members by name, point to the top post, list what's coming up, and invite members to ask the club to verify their milestones. Keep it short and use only the report's numbers.` },
      (full, t, p) => { setText(full); setTools(t); setCards(p); },
    );
  };
  return (
    <section className="grad-edge rounded-3xl border p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Write this week&apos;s update</h3>
          <p className="text-sm text-muted">A short post for the club from these numbers. You review it before it&apos;s posted.</p>
        </div>
        {copilot && <button type="button" onClick={draft} disabled={ai.busy} className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-sm font-medium text-on-accent disabled:opacity-50"><Sparkles className="size-4" /> {ai.busy ? "Drafting…" : "Draft with Copilot"}</button>}
        <button type="button" onClick={() => { setText(""); setTools([]); setCards([{ id: `t${Date.now()}`, kind: "club_post", club_id: clubId, club_name: report.name, body: template(report), postKind: "update" }]); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-4 text-sm text-text-2 hover:bg-hover"><FileText className="size-4" /> Quick template</button>
      </div>
      {(text || tools.length > 0) && <div className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text-2"><Lookups tools={tools} live={ai.busy} /><Rich text={text} /></div>}
      {ai.error && <p role="alert" className="mt-2 text-sm text-danger">{ai.error}</p>}
      {cards.map((p) => <ProposalCard key={p.id} p={p} />)}
    </section>
  );
}

// "Share with sponsors": a private link to the club's semester report (public information only).
export function ShareReport({ clubId, token: initial }: { clubId: string; token: string | null }) {
  const [token, setToken] = useState(initial);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${token}` : "";
  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">Share with sponsors</h3>
          <p className="mt-1 max-w-xl text-sm text-muted">A link to this semester&apos;s report: events and attendance, members&apos; club-verified work and challenge wins. Public information only; anyone with the link can open it, no account needed.</p>
        </div>
        {!token && (
          <button type="button" disabled={pending} onClick={() => start(async () => { const r = await shareClubReport(clubId); if (r.ok && r.token) setToken(r.token); else setMsg(r.message); })} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent disabled:opacity-50">
            {pending && <Loader2 className="size-4 animate-spin" />} Create link
          </button>
        )}
      </div>
      {token && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input id="report-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Report link" className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-4 font-mono text-xs text-text-2" />
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }} className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm hover:bg-hover">{copied ? "Copied" : "Copy"}</button>
          <a href={`/r/${token}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm hover:bg-hover">Open</a>
          <button type="button" disabled={pending} onClick={() => start(async () => { if (!confirm("Turn off this link? Anyone who has it won't be able to open the report.")) return; const r = await revokeClubReport(clubId); if (r.ok) setToken(null); setMsg(r.message); })} className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-danger hover:bg-hover">Turn off</button>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
