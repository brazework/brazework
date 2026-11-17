"use client";
import { BadgeCheck, Check, Clock, Flag, Hammer, Inbox as InboxIcon, PenLine, RotateCcw, Sun, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/forge";
import { PLACES, tourHint, type Place, type Tour } from "@/lib/landing-demo";

// The app, small enough to try: a working copy of Brazework's five places with example data. The
// places share one story, so what you do in one shows up in the next: sign Maya's milestone in Club
// and it's on her Proof, and a company's request is waiting in Inbox. One line under the frame says
// what to try next (lib/landing-demo.ts, tourHint).
const ICONS = { today: Sun, build: Hammer, club: Users, proof: BadgeCheck, inbox: InboxIcon } as const;

type S = Tour & { posted: boolean; asked: boolean };
const START: S = { verified: false, accepted: false, posted: false, asked: false };

export function AppTour() {
  const [place, setPlace] = useState<Place>("today");
  const [s, setS] = useState<S>(START);
  const set = (patch: Partial<S>) => setS((v) => ({ ...v, ...patch }));
  const hint = tourHint(place, s);
  const about = PLACES.find((p) => p.id === place)!.about;
  // A dot on the place the hint points at, the way the app marks something waiting for you.
  const dot = (id: Place) => hint.go === id;

  return (
    <div>
      <div className="overflow-hidden rounded-[1.25rem] border border-line bg-bg shadow-[var(--shadow-float)] md:grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
        {/* Laptop: the app's sidebar. Phone: its top bar (the places move to the tab bar below). */}
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3 md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:px-3 md:py-4">
          <span className="flex items-center gap-2 px-1 text-[15px] font-semibold tracking-tight"><BrandMark size={20} /> Brazework</span>
          <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-medium text-on-accent md:mt-4 md:ml-0 md:h-9 md:justify-center md:text-sm"><PenLine className="size-3.5" /> Log work</span>
          <div role="tablist" aria-label="Places in the app" aria-orientation="vertical" className="mt-4 hidden flex-col gap-0.5 md:flex">
            {PLACES.map((p) => <PlaceTab key={p.id} id={p.id} label={p.label} on={place === p.id} dot={dot(p.id)} onPick={setPlace} wide />)}
          </div>
          <div className="mt-6 hidden px-2 md:block">
            <p className="text-xs font-medium text-faint">Your clubs</p>
            <ul className="mt-2 flex flex-col gap-2 text-sm text-text-2">
              {["Rocketry Club", "Robotics Society", "CHEM 201 Study Group"].map((c) => <li key={c} className="flex items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded bg-surface-2 text-[10px] font-semibold">{c[0]}</span><span className="truncate">{c}</span></li>)}
            </ul>
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          <div id="tour-panel" role="tabpanel" aria-label={PLACES.find((p) => p.id === place)!.label} className={cn("h-[30rem] overflow-hidden p-4 sm:p-6", place === "today" && "tour-panel")}>
            {place === "today" && <Today s={s} set={set} />}
            {place === "build" && <Build s={s} set={set} />}
            {place === "club" && <Club s={s} set={set} />}
            {place === "proof" && <Proof s={s} />}
            {place === "inbox" && <Inbox s={s} set={set} />}
          </div>
          {/* Phone: the app's own tab bar. */}
          <div role="tablist" aria-label="Places in the app" className="grid grid-cols-5 border-t border-line bg-surface px-1 py-1.5 md:hidden">
            {PLACES.map((p) => <PlaceTab key={p.id} id={p.id} label={p.label} on={place === p.id} dot={dot(p.id)} onPick={setPlace} />)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[15px] text-text-2"><span className="font-semibold text-text">{PLACES.find((p) => p.id === place)!.label}.</span> {about}</p>
        <div className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-3.5 text-sm" aria-live="polite">
          <span className={cn("size-2 shrink-0 rounded-full", hint.done ? "bg-ok" : "bg-[#f28c28]")} aria-hidden="true" />
          <span className="min-w-0 flex-1 text-text-2">{hint.text}</span>
          {hint.go && <button type="button" onClick={() => setPlace(hint.go!)} className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3 text-xs font-medium text-on-accent transition hover:opacity-90">Open {PLACES.find((p) => p.id === hint.go)!.label}</button>}
          {hint.done && (
            <>
              <Link href="/signup" className="inline-flex h-8 shrink-0 items-center rounded-lg bg-accent px-3 text-xs font-medium text-on-accent transition hover:opacity-90">Start yours</Link>
              <button type="button" onClick={() => { setS(START); setPlace("today"); }} aria-label="Start the tour over" className="grid size-8 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:bg-hover hover:text-text"><RotateCcw className="size-3.5" /></button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlaceTab({ id, label, on, dot, onPick, wide }: { id: Place; label: string; on: boolean; dot: boolean; onPick: (p: Place) => void; wide?: boolean }) {
  const Icon = ICONS[id];
  return (
    <button type="button" role="tab" aria-selected={on} aria-controls="tour-panel" onClick={() => onPick(id)}
      className={cn("relative transition-colors", wide
        ? "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm"
        : "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px]",
      on ? "bg-surface-2 font-medium text-text" : "text-muted hover:bg-hover hover:text-text")}>
      <Icon className={wide ? "size-4" : "size-[1.125rem]"} /> {label}
      {dot && <span className={cn("absolute size-2 rounded-full bg-[#f28c28]", wide ? "top-3.5 right-3" : "top-1.5 right-[calc(50%-1rem)]")}><span className="sr-only">(try this next)</span></span>}
    </button>
  );
}

// ── The five places ─────────────────────────────────────────────────────────────────────────────
const MILESTONE = "Beat the course in 41.2 seconds";
const card = "rounded-xl border border-line bg-surface";
const btn = "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition";
const primary = `${btn} bg-accent text-on-accent hover:opacity-90`;
const quiet = `${btn} border border-line hover:border-line-strong hover:bg-hover`;

function Av({ children, size = "size-9" }: { children: React.ReactNode; size?: string }) {
  return <span aria-hidden="true" className={cn("grid shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-text-2", size)}>{children}</span>;
}
function Status({ signed, by = "Rocketry Club" }: { signed: boolean; by?: string }) {
  return signed
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-2.5 py-1 text-xs font-medium text-ok"><Check className="size-3.5" /> Verified by {by}</span>
    : <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2"><Clock className="size-3.5" /> Waiting for {by}</span>;
}
function Title({ children, note }: { children: React.ReactNode; note?: string }) {
  return <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="text-xl font-semibold tracking-tight">{children}</h3>{note && <p className="text-xs text-muted">{note}</p>}</div>;
}

function Today({ s, set }: { s: S; set: (p: Partial<S>) => void }) {
  return (
    <div>
      <p className={cn(card, "flex items-center gap-2.5 px-3.5 py-2.5 text-sm")}><Flag className="size-4 shrink-0 text-text-2" /><span className="min-w-0"><span className="font-medium">Next up:</span> <span className="text-text-2">{s.verified ? "share your signed run with the two labs that viewed it." : "your 41.2 second run is waiting for Rocketry Club to sign."}</span></span></p>
      <div className={cn(card, "mt-3 p-3.5")}>
        <p className="text-xs text-muted">What did you build today, Maya?</p>
        <p className="mt-1.5 text-[15px] leading-snug">{s.posted ? <span className="text-faint">Share a build update, a photo, a question</span> : "Sensor board rev B is assembled. All five IR sensors read clean on the bench."}</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="truncate text-xs text-muted">On Line-following robot</span>
          {s.posted ? <span className="inline-flex h-9 items-center gap-1.5 text-sm text-ok"><Check className="size-4" /> Posted</span> : <button type="button" onClick={() => set({ posted: true })} className={primary}>Post</button>}
        </div>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {s.posted && <Post who="Maya Patel" initials="MP" meta="Avionics, flight software, now" text="Sensor board rev B is assembled. All five IR sensors read clean on the bench." foot="Ask your club to verify a milestone on this project" />}
        <Post who="Ben Cho" initials="BC" meta="Propulsion lead, Rocketry Club, 5h" text="Launch day is Saturday. Who is driving?" />
        <Post who="Maya Patel" initials="MP" meta="Avionics, flight software, 1d" text="First full run on the course: 41.2 s. PID gains finally tuned, and the left sensor was the problem all along." />
      </ul>
    </div>
  );
}
function Post({ who, initials, meta, text, foot }: { who: string; initials: string; meta: string; text: string; foot?: string }) {
  return (
    <li className={cn(card, "p-3.5")}>
      <div className="flex items-center gap-2.5"><Av>{initials}</Av><p className="min-w-0 text-sm leading-tight"><span className="font-medium">{who}</span><span className="block truncate text-xs text-muted">{meta}</span></p></div>
      <p className="mt-2.5 text-[15px] leading-snug text-text-2">{text}</p>
      {foot && <p className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2.5 text-xs text-muted"><BadgeCheck className="size-3.5" /> {foot}</p>}
    </li>
  );
}

function Build({ s, set }: { s: S; set: (p: Partial<S>) => void }) {
  return (
    <div>
      <Title note="1 project">Build</Title>
      <div className={cn(card, "p-4")}>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[17px] font-semibold tracking-tight">Line-following robot</p><span className="flex items-center gap-1.5 text-xs text-muted"><span className="size-1.5 rounded-full bg-text" /> In progress</span></div>
        <p className="mt-1.5 text-sm leading-snug text-muted">Autonomous robot that follows a taped course with 5 IR sensors and a PID loop.</p>
        <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line">
          <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
            <p className="min-w-0 text-sm"><span className="font-medium">{MILESTONE}</span><span className="block text-xs text-muted">Best of 3 runs, timed by the club. Evidence attached.</span></p>
            <Status signed={s.verified} />
          </li>
          <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-3">
            <p className="min-w-0 text-sm"><span className="font-medium">Sensor board rev B assembled</span><span className="block text-xs text-muted">Logged today. Not sent to anyone yet.</span></p>
            {s.asked ? <Status signed={false} /> : <button type="button" onClick={() => set({ asked: true })} className={quiet}>Ask the club to sign</button>}
          </li>
        </ul>
      </div>
      <p className="mt-3 text-sm text-muted">A milestone is one result someone else can check. <a href="#projects" className="font-medium text-text underline decoration-line-strong underline-offset-4 hover:decoration-text">See this robot in 3D</a></p>
    </div>
  );
}

function Club({ s, set }: { s: S; set: (p: Partial<S>) => void }) {
  return (
    <div>
      <Title note="Viewing as Ben Cho, an officer">Rocketry Club</Title>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[["24", "Members"], ["7", "Posts this week"], [s.verified ? "13" : "12", "Verified this term"]].map(([n, l]) => <div key={l} className={cn(card, "px-2 py-2.5")}><dd className="text-lg font-semibold tabular-nums">{n}</dd><dt className="text-[11px] leading-tight text-muted">{l}</dt></div>)}
      </dl>
      <div className={cn(card, "mt-3 p-4")}>
        <p className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="size-4" /> Signatures waiting on you</p>
        <p className="mt-1 hidden text-xs text-muted sm:block">Verify only what the club saw happen: a test, a build night, a competition result.</p>
        <div className="mt-3 rounded-lg bg-surface-2/70 p-3.5">
          <div className="flex items-center gap-2.5"><Av>MP</Av><p className="text-sm leading-tight"><span className="font-medium">Maya Patel</span> asks the club to verify<span className="block text-xs text-muted">Line-following robot</span></p></div>
          <p className="mt-3 text-[15px] font-semibold tracking-tight">{MILESTONE}</p>
          <p className="text-sm text-muted">Best of 3 runs on the competition course, timed by the club.</p>
          <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
            {s.verified
              ? <p className="flex items-start gap-1.5 text-sm font-medium text-ok"><Check className="mt-0.5 size-4 shrink-0" /> Verified. It&apos;s on Maya&apos;s record with your name and today&apos;s date.</p>
              : <><button type="button" onClick={() => set({ verified: true })} className={primary}><Check className="size-4" /> Verify</button><span className="text-xs text-muted">or decline with a reason</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Proof({ s }: { s: S }) {
  const rows = [
    ...(s.verified ? [{ t: MILESTONE, by: "Verified by Rocketry Club", meta: "Checked by Ben C. today, on Line-following robot", fresh: true }] : []),
    { t: "Led a session of CHEM 201 Study Group", by: "Confirmed by the group's owner", meta: "Fall 2026", fresh: false },
    { t: "Flight computer passed vibration test", by: "Verified by Robotics Society", meta: "Checked by Ana R., Oct 8", fresh: false },
  ];
  return (
    <div>
      <div className="mb-4 flex items-center gap-3"><Av size="size-11">MP</Av><div><h3 className="text-xl leading-tight font-semibold tracking-tight">Maya Patel</h3><p className="text-sm text-muted">Avionics and flight software, class of 2027</p></div></div>
      <div className={cn(card, "p-4")}>
        <p className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="size-4 text-ok" /> Proof <span className="font-normal text-muted">signed by people who saw it</span></p>
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {rows.map((r) => (
            <li key={r.t} className="flex gap-3 py-3 first:pt-1 last:pb-0">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok text-white dark:text-[#06240f]"><Check className="size-3" strokeWidth={3} /></span>
              <p className="min-w-0 text-sm"><span className="font-medium">{r.t}</span>{r.fresh && <span className="ml-2 rounded bg-[color-mix(in_oklab,var(--ok)_8%,var(--surface))] px-1.5 py-0.5 text-[11px] font-medium text-ok">New</span>}<span className="block text-text-2">{r.by}</span><span className="block text-xs text-muted">{r.meta}</span></p>
            </li>
          ))}
        </ul>
      </div>
      {!s.verified && <p className="mt-3 flex items-start gap-2 text-sm text-muted"><Clock className="mt-0.5 size-4 shrink-0" /> The 41.2 second run isn&apos;t here yet. It&apos;s waiting for Rocketry Club, and only signed work is public.</p>}
    </div>
  );
}

function Inbox({ s, set }: { s: S; set: (p: Partial<S>) => void }) {
  return (
    <div>
      <Title note={s.verified && !s.accepted ? "1 request" : undefined}>Inbox</Title>
      {!s.verified ? (
        <div className={cn(card, "px-4 py-8 text-center")}>
          <p className="text-sm font-medium">No requests yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">Companies find you through signed work. Maya&apos;s run is still waiting for her club.</p>
        </div>
      ) : (
        <div className={cn(card, "p-4")}>
          <div className="flex items-center gap-2.5"><Av>CD</Av><p className="text-sm leading-tight"><span className="font-medium">Cara Diaz</span><span className="block text-xs text-muted">Recruiter, Acme Aerospace</span></p></div>
          <p className="mt-3 max-w-md rounded-2xl rounded-tl-sm bg-surface-2 px-3.5 py-2.5 text-[15px] leading-snug">Saw your verified run on Brazework. Free to talk about our robotics internship?</p>
          {s.accepted && <p className="mt-2 ml-auto w-fit max-w-md rounded-2xl rounded-tr-sm bg-accent px-3.5 py-2.5 text-[15px] leading-snug text-on-accent">Yes! Thursday afternoon works. Thank you for reaching out.</p>}
          <div className="mt-3 flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
            {s.accepted
              ? <p className="text-xs text-muted">She could only message you because you accepted. Whether you&apos;ve read a message is never shown.</p>
              : <><button type="button" onClick={() => set({ accepted: true })} className={primary}>Accept</button><span className="text-xs text-muted">or decline, and she isn&apos;t told</span></>}
          </div>
        </div>
      )}
    </div>
  );
}
