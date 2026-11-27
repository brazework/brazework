import { FileText, Lock, Megaphone, CalendarDays, Link2, Eye, Check } from "lucide-react";
import { Seal } from "@/components/app/verified-seal";
import type { Audience } from "./audience-page";
import { Bubble, Face, Pill, Row, Screen } from "./screens";

// What the /for/* pages say (2026-11-27). Each step is what the product does today, told as one
// member's week; the screens are examples drawn in the app's look (screens.tsx). No prices.

export const STUDENTS: Audience = {
  id: "students",
  promise: "Free with your school email",
  title: "Your work, signed by the people who saw it.",
  lead: "Classes, clubs, projects and deadlines in one place. Your professor or club verifies what you built, and it stays yours after you graduate.",
  cta: { label: "Start your record", href: "/signup" },
  second: { label: "See how it works", href: "/#how" },
  storyH: "A milestone, from hand-in to everywhere",
  steps: [
    { title: "Join with your school email", body: "Your email places you at your school, with your classes and clubs waiting.",
      screen: <Screen title="Welcome, Maya" sub="Demo University"><div className="flex flex-col gap-2"><Row><span className="flex-1">ME 482 Robotics</span><Pill>Class</Pill></Row><Row><span className="flex-1">CS 485 Mobile Robotics</span><Pill>Class</Pill></Row><Row><span className="flex-1">Rocketry Club</span><Pill on>Joined</Pill></Row></div></Screen> },
    { title: "Hand in the milestone", body: "Submit it for the assignment, or log it under a club, with the file that proves it.",
      screen: <Screen title="Assignment 3: Cycle-time test" sub="ME 482 Robotics, due Friday"><p className="text-[15px] leading-snug font-semibold">Cut the pick-and-place cycle from 9.4 to 7.1 seconds</p><Row className="mt-3"><FileText className="size-4 text-muted" aria-hidden="true" /><span>cycle-test-500-runs.csv</span></Row><span className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-on-accent">Submit to ME 482</span></Screen> },
    { title: "Your professor verifies it", body: "Grading it verifies it. Only you and the course's faculty see the grade; the work goes on your record.",
      screen: <Screen title="Verified" sub="ME 482 Robotics"><div className="flex flex-col items-start gap-3"><Seal size={44} /><p className="text-[15px] leading-snug font-semibold">Cut the pick-and-place cycle from 9.4 to 7.1 seconds</p><p className="text-[13px] text-muted">Verified by Prof. Dana Ruiz, ME 482, Fall 2026</p><Row className="w-full"><Lock className="size-4 text-muted" aria-hidden="true" /><span>27 / 30, seen only by you and the course&apos;s faculty</span></Row></div></Screen> },
    { title: "Take it everywhere", body: "One link for LinkedIn, your résumé, Handshake or any application. Recruiters search by verified work, and you see who looked.",
      screen: <Screen title="Your record"><Row><Link2 className="size-4 text-muted" aria-hidden="true" /><span className="font-mono text-[12px]">brazework.com/v/8f2k4q</span></Row><Row className="mt-2"><Check className="size-4 text-ok" aria-hidden="true" /><span>Added to LinkedIn</span></Row><Row className="mt-2"><Eye className="size-4 text-muted" aria-hidden="true" /><span>Viewed by Pratt &amp; Whitney</span></Row></Screen> },
  ],
  facts: ["Free with your school email, always.", "Grades stay private: only you and your professors see them.", "Your record is yours after you graduate. Move your sign-in to a personal email and keep it."],
  close: "Start your record. It's free with your school email.",
};

export const PROFESSIONALS: Audience = {
  id: "professionals",
  promise: "Free to start",
  title: "What you ship, signed by the people you ship it with.",
  lead: "Log what you build at work. A coworker, tech lead or client signs it from their work email. Nothing is public until you choose, and your record moves with you when you change jobs.",
  cta: { label: "Start as a professional", href: "/signup?goal=job" },
  second: { label: "See Plus", href: "/plus" },
  storyH: "From shipped to signed to your next review",
  steps: [
    { title: "Log what you shipped", body: "A launch, a migration, a test rig. Leave out numbers your employer hasn't published: the person who signs still knows what you did.",
      screen: <Screen title="New milestone" sub="Northwind Aero"><p className="text-[15px] leading-snug font-semibold">Cut CI from 22 to 9 minutes with a shared build cache</p><Row className="mt-3"><FileText className="size-4 text-muted" aria-hidden="true" /><span>ci-before-after.png</span></Row><Row className="mt-2"><Lock className="size-4 text-muted" aria-hidden="true" /><span className="flex-1">Private until you choose</span><Pill on>Private</Pill></Row></Screen> },
    { title: "Your team signs it", body: "A coworker, tech lead or client signs from their work email, with no account needed. The signature says where it came from.",
      screen: <Screen title="Signed" sub="Just now"><div className="flex flex-col items-start gap-3"><Seal size={44} /><p className="text-[15px] leading-snug font-semibold">Cut CI from 22 to 9 minutes with a shared build cache</p><Row className="w-full"><Face name="R. Okoro" /><span className="min-w-0"><span className="block font-medium">R. Okoro, Staff Engineer</span><span className="block text-[12px] text-muted">Signed from a Northwind Aero work email</span></span></Row></div></Screen> },
    { title: "Ready for review season", body: "Your signed results over any period on one page, for a performance review or a promotion case.",
      screen: <Screen title="Review packet" sub="January to June"><div className="flex flex-col gap-2">{[["Cut CI from 22 to 9 minutes", "R. Okoro"], ["Billing on the new ledger, no downtime", "S. Iqbal"], ["On-call runbook adopted by 3 teams", "L. Brandt"]].map(([w, b], i) => <Row key={w}><Face name={b} tone={i} /><span className="min-w-0"><span className="block truncate font-medium">{w}</span><span className="block text-[12px] text-muted">Signed by {b}</span></span></Row>)}</div></Screen> },
    { title: "It moves with you", body: "Change jobs and your record comes too. With Plus you also see every company that looked.",
      screen: <Screen title="Companies that looked" sub="Last 90 days"><div className="flex flex-col gap-2">{["Acme Robotics", "Hartwell Labs", "Quarry Systems"].map((c, i) => <Row key={c}><Face name={c} tone={i + 1} /><span className="flex-1">{c}</span><Eye className="size-4 text-muted" aria-hidden="true" /></Row>)}<span className="mt-1"><Pill>With Plus</Pill></span></div></Screen> },
  ],
  facts: ["Nothing is public until you choose, so work for your employer never shows by accident.", "The people who sign never pay and never need an account.", "Start free. Plus adds more Torch and every company that looked; the price is on the pricing page."],
  close: "Start your record at work. It's free to start.",
};

export const CLUBS: Audience = {
  id: "clubs",
  promise: "Free for every club and member",
  title: "Run your club. Stand behind what it builds.",
  lead: "Members, events, announcements and chat in one place, instead of a Discord server, a Google Form and a group chat. Officers verify what members build, and it goes on their record with the club behind it.",
  cta: { label: "Bring your club", href: "/#pilot" },
  second: { label: "Join as a member", href: "/signup" },
  storyH: "A week in a club on Brazework",
  steps: [
    { title: "Set it up in minutes", body: "Invite members with a link. Officers, roles and the member list live in one place.",
      screen: <Screen title="Rocketry Club" sub="34 members"><div className="flex flex-col gap-2">{[["J. Reyes", "Safety officer"], ["Cara Diaz", "Officer"], ["Maya Chen", "Member"], ["Ben Adler", "Member"]].map(([n, r], i) => <Row key={n}><Face name={n} tone={i} /><span className="flex-1">{n}</span><span className="text-[12px] text-muted">{r}</span></Row>)}</div></Screen> },
    { title: "Events, announcements and chat", body: "Post an event and members RSVP. Announcements reach everyone, and the club has its own chat and feed.",
      screen: <Screen title="This week" sub="Rocketry Club"><div className="rounded-2xl border border-line bg-surface-2/50 p-3.5"><p className="inline-flex items-center gap-1.5 text-[12px] text-muted"><CalendarDays className="size-3.5" aria-hidden="true" />Saturday, 10:00, Range B</p><p className="mt-1 text-[15px] font-semibold">Static fire test</p><p className="mt-2 text-[12px] text-muted">18 going</p></div><Row className="mt-2.5"><Megaphone className="size-4 text-muted" aria-hidden="true" /><span>Bring safety glasses on Saturday.</span></Row></Screen> },
    { title: "Officers sign what members build", body: "A member asks the club to verify a milestone with its proof. An officer signs it, and it goes on the member's record.",
      screen: <Screen title="Asked to verify" sub="From Maya Chen"><p className="text-[15px] leading-snug font-semibold">Level 1 flight: 1,140 m apogee, both charges fired on time</p><Row className="mt-3"><FileText className="size-4 text-muted" aria-hidden="true" /><span>flight-log-0412.csv</span></Row><Row className="mt-2"><Seal size={18} /><span>Verified by J. Reyes, safety officer</span></Row></Screen> },
    { title: "Torch drafts the busywork", body: "Each week, a brief: what members built, who's active and what's coming. Torch drafts the announcement or the event, and an officer publishes it.",
      screen: <Screen title="Weekly brief" sub="Rocketry Club"><div className="grid grid-cols-3 gap-2 text-center">{[["9", "verified builds"], ["21", "active members"], ["2", "events"]].map(([n, l]) => <div key={l} className="rounded-xl border border-line bg-surface-2/50 px-1 py-2.5"><p className="text-xl font-semibold tabular-nums">{n}</p><p className="text-[10px] leading-tight text-muted">{l}</p></div>)}</div><div className="mt-3"><Bubble>Draft: Great week, nine builds verified. Static fire on Saturday!</Bubble></div><span className="mt-2.5 inline-flex h-8 items-center rounded-lg bg-accent px-3 text-[12px] font-semibold text-on-accent">Publish</span></Screen> },
    { title: "Sponsors and your school see it", body: "Sponsorships and challenge prizes go to the club and its winners in full. Your school sees what the club does, and companies meet the members who win.",
      screen: <Screen title="Challenge" sub="Sponsored by Northwind Aero"><p className="text-[15px] leading-snug font-semibold">Lightest airframe to survive a 20 g landing</p><Row className="mt-3"><Check className="size-4 text-ok" aria-hidden="true" /><span>Prizes go to the winners in full</span></Row><Row className="mt-2"><Eye className="size-4 text-muted" aria-hidden="true" /><span>Your school sees 9 verified builds this term</span></Row></Screen> },
  ],
  facts: ["Free for every club and member, always.", "Sponsorships and prizes go to the club and its winners in full.", "Nothing is verified without an officer's name on it."],
  close: "Bring your club. The founders set it up with you.",
};
