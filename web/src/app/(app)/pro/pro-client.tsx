"use client";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Panel } from "@/components/app/page-ui";
import { Seal, VerifiedStamp } from "@/components/app/verified-seal";
import { cn } from "@/lib/forge";
import { becomePro, proVerify, type QueueItem } from "@/lib/pro";

const MIN = 40;

// Set up: your employer comes from your email; you add your role and the areas you can judge.
export function ProSetup({ employer, groups }: { employer: string; groups: { name: string; topics: string[] }[] }) {
  const [title, setTitle] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toggle = (t: string) => setAreas((a) => (a.includes(t) ? a.filter((x) => x !== t) : a.length < 5 ? [...a, t] : a));
  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await becomePro(title, areas); if (r.ok) router.refresh(); else setError(r.message); }); }}>
      <Panel className="p-5 sm:p-6">
        <div className="flex items-center gap-3"><Seal size={34} tone="pro" /><div><p className="text-xs text-faint">Your employer, from your email</p><p className="text-lg font-semibold">{employer}</p></div></div>
        <label htmlFor="pro-title" className="mt-6 block text-xs font-medium tracking-wide text-faint uppercase">Your role</label>
        <input id="pro-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Senior Mechanical Engineer"
          className="mt-2 h-11 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] outline-none focus:border-line-strong" />
        <fieldset className="mt-6">
          <legend className="text-xs font-medium tracking-wide text-faint uppercase">Areas you can judge <span className="normal-case">({areas.length}/5)</span></legend>
          <div className="mt-2 flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="mb-1.5 text-xs text-muted">{g.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.topics.map((t) => (
                    <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={areas.includes(t)}
                      className={cn("rounded-full border px-3 py-1 text-xs transition", areas.includes(t) ? "border-transparent bg-text text-surface" : "border-line text-text-2 hover:border-line-strong")}>{t}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={pending || title.trim().length < 2 || !areas.length} className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-text px-5 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-40">
          {pending && <Loader2 className="size-4 animate-spin" />} Start reviewing
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      </Panel>
    </form>
  );
}

// One milestone to review: what it is, the club's stamp, the evidence, and your sign-off with a note.
export function ReviewCard({ m }: { m: QueueItem }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const left = MIN - note.trim().length;
  return (
    <article aria-label={`Review: ${m.title}`} className="glass-card rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <VerifiedStamp club={m.community_name} clubId={m.community_id} by={m.reviewer_name} size="sm" />
        {m.matches && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">In your areas</span>}
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">{m.title}</h2>
      <p className="text-sm text-muted"><Link href={`/u/${m.owner_id}`} className="font-medium text-text hover:underline">{m.owner_name}</Link> · <Link href={`/projects/${m.project_id}`} className="hover:underline">{m.project_title}</Link></p>
      {m.detail && <p className="mt-2 text-sm leading-relaxed text-text-2">{m.detail}</p>}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {m.evidence && /^https?:\/\//.test(m.evidence) && <a href={m.evidence} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-medium hover:underline"><ExternalLink className="size-3.5" /> Evidence</a>}
        <Link href={`/projects/${m.project_id}`} className="font-medium hover:underline">The build&apos;s updates →</Link>
      </div>
      {done ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-ok"><Check className="size-4" /> Signed. It shows on {m.owner_name.split(" ")[0]}&apos;s profile.</p>
      ) : (
        <form className="mt-4" onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await proVerify(m.id, note); if (r.ok) setDone(true); else setError(r.message); }); }}>
          <label htmlFor={`note-${m.id}`} className="text-xs font-medium text-faint">What did you check?</label>
          <textarea id={`note-${m.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
            placeholder="Watched the test video and checked the load cell log against the stated peak."
            className="mt-1.5 w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] outline-none focus:border-line-strong" />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" disabled={pending || left > 0} className="inline-flex h-10 items-center gap-2 rounded-lg bg-text px-4 text-sm font-semibold text-surface transition hover:opacity-90 disabled:opacity-40">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Seal size={16} tone="pro" />} Pro-verify
            </button>
            <span className="text-xs text-faint">{left > 0 ? `${left} more characters: say what you checked` : "Ready to sign"}</span>
          </div>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </form>
      )}
    </article>
  );
}
