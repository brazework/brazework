import { ArrowRight, BadgeCheck, BookOpen, GraduationCap, MessageSquare, MessagesSquare, Users } from "lucide-react";
import Link from "next/link";
import { Seal } from "@/components/app/verified-seal";
import { Avatar } from "@/components/ui";
import { openClubChat } from "@/lib/chats";
import { cn, timeAgo } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";
import { loadConversations, loadGroups } from "../messages/data";
import { QuickChat, WeekPlanner, type DueItem } from "./student-client";

// Your school, for a student (2026-11-27): the portal a student opens every day. What's due this week
// (a strip of days to tap), your classes with their professor, what's next and what's verified, the
// chats you're in (class chats, team chats, direct messages) with a quick box to post to a class, and
// what's been verified this term. Classes run inside the school's LMS; this is the project side.
// Colour only for proof (verified green); motion only answers a tap (docs/design/app.md).

export type StudentClass = { id: string; name: string; course: string; term: string; member_count: number; projects: number };
type Owner = { id: string; owner_id: string | null; owner_name: string | null };
type Verified = { id: string; title: string; reviewer_name: string | null; reviewer_role: string | null; reviewed_at: string | null; community_id: string | null };

const greeting = (now: number) => { const h = new Date(now).getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

export async function StudentHome({ school, domain, official, classes, due, standing, clubs, now }: {
  school: string; domain: string; official: boolean; classes: StudentClass[]; due: DueItem[];
  standing: Map<string, { verified: number; waiting: number }>; clubs: { id: string; name: string; member_count: number }[]; now: number;
}) {
  const { supabase, user, profile } = await getViewer();
  const ids = classes.map((c) => c.id);
  const [owners, ver, groupsRes, convRes] = await Promise.all([
    ids.length ? supabase.from("communities").select("id, owner_id, owner_name").in("id", ids) : Promise.resolve({ data: [] }),
    ids.length && user ? supabase.from("milestones").select("id, title, reviewer_name, reviewer_role, reviewed_at, community_id").eq("owner_id", user.id).in("community_id", ids).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(6) : Promise.resolve({ data: [] }),
    loadGroups(),
    loadConversations(),
  ]);
  const ownerOf = new Map(((owners.data ?? []) as Owner[]).map((o) => [o.id, o]));
  const verified = (ver.data ?? []) as Verified[];
  const classChats = groupsRes.groups.filter((g) => g.kind !== "event" && g.community_id && ids.includes(g.community_id));
  const otherChats = groupsRes.groups.filter((g) => !classChats.includes(g)).slice(0, 3);
  const dms = convRes.convs.filter((c) => c.status === "active").slice(0, 3);
  const unread = [...classChats, ...otherChats].filter((g) => g.unread).length + dms.filter((c) => c.unread).length;
  const thisWeek = due.filter((d) => d.dueAt && new Date(d.dueAt).getTime() < now + 7 * 86_400_000).length;
  const verifiedTotal = [...standing.values()].reduce((t, s) => t + s.verified, 0);
  const label = (c: StudentClass) => c.course || c.name;
  // "ME 410 · Capstone Design" reads "Capstone Design" under its course code.
  const title = (c: StudentClass) => (c.course && c.name.startsWith(`${c.course} · `) ? c.name.slice(c.course.length + 3) : c.name);

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <p className="inline-flex items-center gap-1.5 text-sm text-muted"><GraduationCap className="size-4" aria-hidden="true" />{school}{official && <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" />On Brazework</span>}</p>
        <h1 suppressHydrationWarning className="mt-2 text-[clamp(1.9rem,5vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">{greeting(now)}, {profile?.first_name || "there"}.</h1>
        <p className="mt-2 text-[16px] text-muted">
          {[thisWeek ? `${thisWeek} due this week` : "Nothing due this week", `${verifiedTotal} verified this term`, unread ? `${unread} unread ${unread === 1 ? "chat" : "chats"}` : null].filter(Boolean).join(" · ")}
        </p>
        {!official && <p className="mt-3 max-w-2xl text-[13px] text-faint">{school} hasn&apos;t joined Brazework yet ({domain}). Your record is already yours; your classes show up here when it does.</p>}
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <WeekPlanner items={due} now={now} />

          <section aria-labelledby="classes-h">
            <h2 id="classes-h" className="text-lg font-semibold tracking-tight">Your classes</h2>
            {classes.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-5 text-sm text-muted">No classes yet. When your professor adds your class with your school email, it shows up here.</p>
            ) : (
              <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {classes.map((c) => {
                  const o = ownerOf.get(c.id);
                  const s = standing.get(c.id) ?? { verified: 0, waiting: 0 };
                  const next = due.find((d) => d.classId === c.id);
                  const chat = classChats.find((g) => g.community_id === c.id && g.kind === "club");
                  return (
                    <li key={c.id} className="glass-card flex flex-col rounded-2xl p-4 sm:p-5">
                      <p className="text-[12px] text-faint">{[c.course, c.term].filter(Boolean).join(" · ")}</p>
                      <Link href={`/c/${c.id}`} className="mt-1 text-[17px] leading-snug font-semibold tracking-tight hover:underline">{title(c)}</Link>
                      {o?.owner_name && <p className="mt-1 text-[13px] text-muted">{o.owner_name}</p>}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                        {s.verified > 0 ? <span className="inline-flex items-center gap-1 text-ok"><BadgeCheck className="size-3.5" aria-hidden="true" />{s.verified} verified</span> : <span className="text-muted">Nothing verified yet</span>}
                        {s.waiting > 0 && <span className="text-text-2">{s.waiting} waiting to be signed</span>}
                        <span className="text-muted">{c.projects} {c.projects === 1 ? "project" : "projects"}</span>
                      </div>
                      <p suppressHydrationWarning className="mt-3 min-h-[2.5em] text-[13px] text-text-2">{next ? <>Next: <span className="font-medium text-text">{next.title}</span></> : "Nothing due soon."}</p>
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                        <Link href={`/c/${c.id}/course`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] transition hover:bg-hover active:scale-95"><BookOpen className="size-3.5" aria-hidden="true" />Course</Link>
                        {chat ? (
                          <Link href={`/messages/g/${chat.id}`} className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] transition hover:bg-hover active:scale-95"><MessagesSquare className="size-3.5" aria-hidden="true" />Class chat{chat.unread && <span aria-label="unread" className="size-2 rounded-full bg-text" />}</Link>
                        ) : (
                          <form action={openClubChat.bind(null, c.id)}><button type="submit" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] transition hover:bg-hover active:scale-95"><MessagesSquare className="size-3.5" aria-hidden="true" />Class chat</button></form>
                        )}
                        {o?.owner_id && o.owner_id !== user?.id && <Link href={`/messages/new?to=${o.owner_id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] transition hover:bg-hover active:scale-95"><MessageSquare className="size-3.5" aria-hidden="true" />Message professor</Link>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6">
          <section aria-labelledby="chats-h" className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="chats-h" className="text-lg font-semibold tracking-tight">Chats</h2>
              <Link href="/messages" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">All chats</Link>
            </div>
            <div className="mt-3"><QuickChat classes={classes.map((c) => ({ id: c.id, label: label(c) }))} /></div>
            <ul className="mt-1 flex flex-col">
              {[...classChats, ...otherChats].map((g) => (
                <li key={g.id}>
                  <Link href={`/messages/g/${g.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-hover">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-text-2">{g.kind === "team" ? <Users className="size-4" aria-hidden="true" /> : <MessagesSquare className="size-4" aria-hidden="true" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[14px]", g.unread ? "font-semibold" : "font-medium")}>{g.title}</span>
                      <span className="block truncate text-[12px] text-muted">{g.lastBody ? `${g.lastFromMe ? "You" : g.lastSenderName}: ${g.lastBody}` : g.community_id && ids.includes(g.community_id) && g.kind === "club" ? "Class chat" : g.subtitle || "No messages yet"}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {g.lastAt && <span suppressHydrationWarning className="text-[11px] text-faint">{timeAgo(g.lastAt)}</span>}
                      {g.unread && <span aria-label="unread" className="size-2 rounded-full bg-text" />}
                    </span>
                  </Link>
                </li>
              ))}
              {dms.map((c) => (
                <li key={c.id}>
                  <Link href={`/messages/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-hover">
                    <Avatar first={c.other.firstName} last={c.other.lastName} size={36} src={c.other.avatar} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[14px]", c.unread ? "font-semibold" : "font-medium")}>{c.other.firstName} {c.other.lastName}</span>
                      <span className="block truncate text-[12px] text-muted">{c.lastBody ? `${c.lastFromMe ? "You: " : ""}${c.lastBody}` : c.other.headline}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {c.lastAt && <span suppressHydrationWarning className="text-[11px] text-faint">{timeAgo(c.lastAt)}</span>}
                      {c.unread && <span aria-label="unread" className="size-2 rounded-full bg-text" />}
                    </span>
                  </Link>
                </li>
              ))}
              {classChats.length + otherChats.length + dms.length === 0 && <li className="py-2 text-[13px] text-muted">No chats yet. Start your class&apos;s chat from a class card, or post above.</li>}
            </ul>
          </section>

          <section aria-labelledby="verified-h" className="glass-card rounded-2xl p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="verified-h" className="text-lg font-semibold tracking-tight">Verified this term</h2>
              <Link href="/profile" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Your record</Link>
            </div>
            {verified.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {verified.map((m) => (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-0.5 shrink-0"><Seal size={18} /></span>
                    <span className="min-w-0">
                      <span className="block text-[14px] leading-snug font-medium">{m.title}</span>
                      <span className="block text-[12px] text-muted">{[m.reviewer_name, m.reviewer_role].filter(Boolean).join(", ")}{m.reviewed_at ? <span suppressHydrationWarning> · {timeAgo(m.reviewed_at)}</span> : null}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-[13px] text-muted">When a professor grades a milestone you handed in, it&apos;s verified and shows here, and on your record for good.</p>}
          </section>

          {clubs.length > 0 && (
            <section aria-labelledby="clubs-h" className="glass-card rounded-2xl p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="clubs-h" className="text-lg font-semibold tracking-tight">Clubs at {school}</h2>
                <Link href="/communities" className="text-sm text-muted underline-offset-4 hover:text-text hover:underline">Find a club</Link>
              </div>
              <ul className="mt-2 flex flex-col">
                {clubs.slice(0, 5).map((c) => (
                  <li key={c.id}><Link href={`/c/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-[14px] transition hover:bg-hover"><span className="truncate font-medium">{c.name}</span><span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-muted">{c.member_count} members<ArrowRight className="size-3" aria-hidden="true" /></span></Link></li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
