"use client";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, Check, FolderGit2, Hash, Loader2, MessageSquare, Search, Sparkles, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { joinCommunity } from "@/app/(app)/communities/actions";
import { CommunityBadge } from "@/app/(app)/communities/_components/badge";
import { ConnectDialog } from "@/components/network/connect-dialog";
import { Avatar } from "@/components/ui";
import { membersLabel, PRIVACY_LABEL } from "@/lib/communities";
import { cn } from "@/lib/forge";
import { respondToRequest, sendConnectionRequest } from "@/lib/network";
import { searchForge, type CommunityHit, type PersonHit, type SearchResults } from "@/lib/search";

// The search bar at the top of every signed-in page: people, communities, projects, events and posts
// as you type, with Connect and Join right in the results, and a hand-off to Copilot for questions. Enter (or "See all results") opens /search.
// Press "/" anywhere to jump to it.
export function GlobalSearch() {
  const router = useRouter();
  const path = usePathname();
  const listId = useId();
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<SearchResults | null>(null);
  const [loading, start] = useTransition();

  // Search shortly after typing stops; ignore answers to older queries.
  const latest = useRef("");
  useEffect(() => {
    const query = q.trim();
    latest.current = query;
    if (query.length < 2) return;
    const t = setTimeout(() => start(async () => {
      const r = await searchForge(query, 5).catch(() => null);
      if (latest.current === query) setRes(r);
    }), 220);
    return () => clearTimeout(t);
  }, [q]);

  // Close when the page changes, or on a click outside.
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); }
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, []);

  // Arrow keys move through the results; Escape closes.
  const move = (dir: 1 | -1) => {
    const items = [...(box.current?.querySelectorAll<HTMLElement>("[data-result]") ?? [])];
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = at === -1 ? (dir === 1 ? 0 : items.length - 1) : at + dir;
    if (next < 0) { input.current?.focus(); return; }
    items[Math.min(next, items.length - 1)]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); input.current?.focus(); }
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); move(1); }
    if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
  };

  const query = q.trim();
  const showPanel = open && query.length >= 2;
  // Only show answers for what is typed now; anything older reads as still searching.
  const cur = res && res.query === query ? res : null;
  const nothing = cur && !cur.people.length && !cur.communities.length && !cur.projects.length && !cur.events.length && !cur.posts.length;
  const askRow = cur && (
    <Link data-result href={`/copilot?q=${encodeURIComponent(query)}`} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition hover:bg-hover focus:bg-hover focus:outline-none">
      <span className="bg-accent-grad grid size-9 shrink-0 place-items-center rounded-xl text-on-accent"><Sparkles className="size-4" /></span>
      <span className="min-w-0"><span className="block truncate font-medium">Ask Copilot: &ldquo;{query}&rdquo;</span><span className="block text-xs text-faint">Answers with clubs, events and people from Forge</span></span>
    </Link>
  );

  return (
    <div ref={box} className="relative" onKeyDown={onKeyDown}>
      <form
        role="search"
        aria-label="Search Forge"
        onSubmit={(e) => { e.preventDefault(); if (query) { setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`); } }}
        className="glass flex h-12 items-center gap-3 rounded-2xl border border-line px-4 shadow-[var(--shadow)] transition focus-within:border-line-strong"
      >
        {loading ? <Loader2 className="size-[18px] shrink-0 animate-spin text-faint" /> : <Search className="size-[18px] shrink-0 text-faint" />}
        <label htmlFor="forge-search" className="sr-only">Search Forge</label>
        <input
          ref={input}
          id="forge-search"
          data-tour="search"
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search people, clubs, projects, events…"
          autoComplete="off"
          aria-controls={showPanel ? listId : undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button type="button" onClick={() => { setQ(""); input.current?.focus(); }} aria-label="Clear search" className="grid size-7 place-items-center rounded-full text-faint hover:bg-hover hover:text-text"><X className="size-4" /></button>
        ) : (
          <kbd className="hidden rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] text-faint sm:block" aria-hidden="true">/</kbd>
        )}
      </form>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            id={listId}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-[70dvh] overflow-y-auto rounded-3xl border border-line bg-surface p-2 shadow-[var(--shadow)]"
          >
            <p className="sr-only" aria-live="polite">
              {cur ? `${cur.people.length} people, ${cur.communities.length} communities, ${cur.projects.length} projects, ${cur.events.length} events, ${cur.posts.length} posts` : "Searching"}
            </p>
            {!cur && <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Searching…</div>}
            {cur?.question && askRow}
            {cur && cur.topics.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2 pb-1">
                {cur.topics.map((t) => <Link key={t} data-result href={`/feed?tab=latest&tag=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text-2 transition hover:bg-hover"><Hash className="size-3" /> {t}</Link>)}
              </div>
            )}
            {nothing && <p className="px-3 py-4 text-sm text-muted">Nothing on Forge matches &ldquo;{query}&rdquo; yet. Try a name, a field, a club or a topic.</p>}
            {cur && cur.people.length > 0 && (
              <section aria-label="People">
                <h3 className="px-3 pt-2 pb-1 font-mono text-[10px] tracking-wide text-faint uppercase">People</h3>
                <ul>{cur.people.map((p) => <PersonResult key={p.id} p={p} />)}</ul>
              </section>
            )}
            {cur && cur.communities.length > 0 && (
              <section aria-label="Communities">
                <h3 className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-wide text-faint uppercase">Communities</h3>
                <ul>{cur.communities.map((c) => <CommunityResult key={c.community.id} hit={c} />)}</ul>
              </section>
            )}
            {cur && cur.projects.length > 0 && (
              <section aria-label="Projects">
                <h3 className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-wide text-faint uppercase">Projects</h3>
                <ul>{cur.projects.map((x) => (
                  <li key={x.id}><Link data-result href={`/u/${x.ownerId}#projects`} className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-hover focus:bg-hover focus:outline-none">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><FolderGit2 className="size-4" /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block truncate text-xs text-faint">{x.owner}{x.status === "completed" ? " · Completed" : " · In progress"}</span></span>
                  </Link></li>
                ))}</ul>
              </section>
            )}
            {cur && cur.events.length > 0 && (
              <section aria-label="Events">
                <h3 className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-wide text-faint uppercase">Events</h3>
                <ul>{cur.events.map((x) => (
                  <li key={x.id}><Link data-result href={`/events/${x.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-hover focus:bg-hover focus:outline-none">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><CalendarDays className="size-4" /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{x.title}</span><span className="block truncate text-xs text-faint">{new Date(x.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {x.type} · {x.format}</span></span>
                  </Link></li>
                ))}</ul>
              </section>
            )}
            {cur && cur.posts.length > 0 && (
              <section aria-label="Posts">
                <h3 className="px-3 pt-3 pb-1 font-mono text-[10px] tracking-wide text-faint uppercase">Posts</h3>
                <ul>{cur.posts.map((x) => (
                  <li key={x.id}><Link data-result href={`/post/${x.id}`} className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-hover focus:bg-hover focus:outline-none">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><MessageSquare className="size-4" /></span>
                    <span className="min-w-0"><span className="block truncate text-sm">{x.body}</span><span className="block truncate text-xs text-faint">{x.author}</span></span>
                  </Link></li>
                ))}</ul>
              </section>
            )}
            {cur && !cur.question && askRow}
            {cur && !nothing && (
              <Link data-result href={`/search?q=${encodeURIComponent(query)}`} className="mt-1 flex items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-muted transition hover:bg-hover hover:text-text focus:bg-hover focus:outline-none">
                <Search className="size-4" /> See all results for &ldquo;{query}&rdquo;
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const pill = "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition disabled:opacity-60";
const primaryPill = cn(pill, "bg-accent-grad text-on-accent hover:-translate-y-px active:scale-95");
const donePill = cn(pill, "border border-line text-muted");

function PersonResult({ p }: { p: PersonHit }) {
  const name = `${p.firstName} ${p.lastName}`.trim() || "Forge member";
  const [status, setStatus] = useState(p.relationship.status);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const run = (next: typeof status, fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const before = status;
      setErr("");
      setStatus(next);
      const r = await fn().catch(() => ({ ok: false, message: "Couldn't do that. Check your connection." }));
      if (!r.ok) { setStatus(before); setErr(r.message); }
    });
  const sub = p.shared.length ? `Shares ${p.shared.slice(0, 2).join(", ")}` : p.headline || p.field;

  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-hover">
      <Link data-result href={`/u/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-text">
        <Avatar first={p.firstName} last={p.lastName} size={36} src={p.avatar} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{name}</span>
          {sub && <span className={cn("block truncate text-xs", p.shared.length ? "text-accent" : "text-faint")}>{sub}</span>}
          {err && <span role="alert" className="block text-xs text-danger">{err}</span>}
        </span>
      </Link>
      {status === "none" && <button type="button" data-result disabled={pending} onClick={() => setAsking(true)} className={primaryPill}><UserPlus className="size-3.5" /> Connect</button>}
      {status === "sent" && <span className={donePill}>Pending</span>}
      {status === "received" && p.relationship.connId && (
        <button type="button" data-result disabled={pending} onClick={() => run("connected", () => respondToRequest(p.relationship.connId!, true))} className={primaryPill}><Check className="size-3.5" /> Accept</button>
      )}
      {status === "connected" && <span className={donePill}><Check className="size-3.5" /> Connected</span>}
      <ConnectDialog
        firstName={p.firstName}
        open={asking}
        onClose={() => setAsking(false)}
        onSend={(note) => { setAsking(false); run("sent", () => sendConnectionRequest(p.id, note)); }}
      />
    </li>
  );
}

function CommunityResult({ hit }: { hit: CommunityHit }) {
  const c = hit.community;
  const [state, setState] = useState<"member" | "requested" | "none">(hit.role ? "member" : hit.requested ? "requested" : "none");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const sub = hit.shared.length ? `Matches ${hit.shared.slice(0, 2).join(", ")}` : `${membersLabel(c.member_count)} · ${PRIVACY_LABEL[c.privacy]}`;

  return (
    <li className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-hover">
      <Link data-result href={`/c/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-text">
        <CommunityBadge id={c.id} name={c.name} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{c.name}</span>
          <span className={cn("block truncate text-xs", hit.shared.length ? "text-accent" : "text-faint")}>{sub}</span>
          {err && <span role="alert" className="block text-xs text-danger">{err}</span>}
        </span>
      </Link>
      {state === "none" && (
        <button
          type="button"
          data-result
          disabled={pending}
          onClick={() => start(async () => {
            setErr("");
            const r = await joinCommunity(c.id).catch(() => ({ ok: false, message: "Couldn't join. Check your connection.", state: undefined }));
            if (r.ok) setState(c.privacy === "public" ? "member" : "requested");
            else setErr(r.message);
          })}
          className={primaryPill}
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Users className="size-3.5" />} {c.privacy === "public" ? "Join" : "Ask to join"}
        </button>
      )}
      {state === "requested" && <span className={donePill}>Requested</span>}
      {state === "member" && <span className={donePill}><Check className="size-3.5" /> Joined</span>}
    </li>
  );
}
