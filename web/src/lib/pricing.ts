// What Brazework costs, in one place (the Product Hunt launch). The landing page's Pricing section and
// /pricing both read it, so they can't disagree. Company prices match docs/strategy.md. Pure, and
// tested (tests/pricing.test.ts).
//
// Plus's name and prices aren't settled: change them here. Whether it can be bought is decided at
// runtime (lib/billing.ts plusOnSale(): Stripe on and STRIPE_PRICE_PLUS set); until then /plus takes
// a place on the waitlist. Never call it "Pro": Pro means pro verification, a professional at a
// verified company signing a milestone (supabase/pro-verification.sql).
//
// What Plus is for (Nov 19): students pay to be found (every company that looked); professionals pay
// to be recognized at work (the review packet: their signed work, ready for a review or promotion).

import { FEATURE_ACCESS } from "@/lib/plans";

// Monthly, and by the year at a third off: review cycles come once or twice a year, so a year is the
// natural unit for a professional. Yearly checkout needs its Stripe prices (lib/billing.ts plusPriceEnv).
export const PLUS = { name: "Plus", student: 6, everyone: 12, studentYear: 48, everyoneYear: 96 };
// What a school pays: a flat portal and a seat for each advisor who uses it. Never per club or
// chapter, so a school never has a reason to keep a club off Brazework (founders, 2026-11-19).
export const SCHOOL = { portal: 6000, seatsIncluded: 2, perAdvisor: 1200 };
/** A school's yearly price for this many advisors (the portal includes the first seats). */
export const schoolPrice = (advisors: number) => SCHOOL.portal + Math.max(0, Math.ceil(advisors) - SCHOOL.seatsIncluded) * SCHOOL.perAdvisor;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
// What Plus will add but doesn't yet. Every page that lists Plus marks these "coming soon", so nobody
// pays for something that isn't built. Move an item out of this list when it ships.
export const PLUS_SOON = ["Your own profile link", "A PDF portfolio of your signed work", "More AI drafts from your tools"];

export type Audience = "builders" | "companies" | "organizations";
export type Tier = {
  id: string; audience: Audience; name: string; price: string; note: string; points: string[];
  cta: { label: string; href: string }; featured?: boolean;
};

export const AUDIENCES: { id: Audience; label: string; line: string }[] = [
  { id: "builders", label: "Builders", line: "Students and professionals. The record is free, forever." },
  { id: "companies", label: "Companies", line: "Find people by work someone signed, not by keywords they typed." },
  { id: "organizations", label: "Clubs, networks and schools", line: "Free for every club. Schools pay for a portal and their advisors, never per club." },
];

// Each audience has one primary call to action (featured); the other card's is quieter.
export const TIERS: Tier[] = [
  {
    id: "free", audience: "builders", name: "Free", price: "$0", note: "Always, with no ads", featured: true,
    points: ["Your record: every build, with the people who signed it", "Ask anyone who saw it to sign: a professor, a manager, your club", "A share card for every milestone, signed or waiting", "Clubs, study groups, events and your AI agent", "Be found by companies, and see who looked this week"],
    cta: { label: "Log your first build", href: "/signup" },
  },
  {
    id: "plus", audience: "builders", name: PLUS.name, price: `$${PLUS.student}/mo`,
    note: `For students, or $${PLUS.studentYear} a year. Professionals: $${PLUS.everyone}/mo, or $${PLUS.everyoneYear} a year.`,
    points: [
      "Everything in Free",
      // Free while it's a Plus preview (lib/plans.ts), and the card says so: one word there changes both.
      `Review packets: your signed work over any period, ready for a performance review or a promotion case${FEATURE_ACCESS.reviewPacket === "plus-preview" ? " (free for everyone during launch)" : ""}`,
      "Every company that looked in the last 90 days, not just this week",
      ...PLUS_SOON.map((x) => `${x} (coming soon)`),
    ],
    cta: { label: "Get Plus", href: "/plus" },
  },
  {
    id: "talent", audience: "companies", name: "Find builders", price: "$15,000", note: "Per year, for 2 seats and 2 chapter sponsorships", featured: true,
    points: ["Search members by signed work, field, school and class year", "Message them in their Requests", "Two chapters sponsored each semester, your pick", "They see that you looked, so it starts warm"],
    cta: { label: "Book a pilot", href: "/book?kind=talent" },
  },
  {
    id: "sponsor", audience: "companies", name: "Sponsor a chapter or a challenge", price: "$2,500", note: "Per chapter, per semester. All of it goes to the club.",
    points: ["Your name on a chapter's page and its members' signed work", "Or post a build challenge that clubs opt into, from $5,000. Prizes go to the winners in full.", "Meet the members who win, signed by their clubs", "Reporting on who took part and what they built"],
    cta: { label: "Sponsor a chapter", href: "/book?kind=chapter" },
  },
  {
    id: "clubs", audience: "organizations", name: "Clubs", price: "Free", note: "For every student club and study group",
    points: ["Members, events, chat, roles and officer handoff", "Officers verify members' work", "A page that shows what the club builds", "Study groups with the members' own record of who led"],
    cta: { label: "Bring your club", href: "/#founding" },
  },
  {
    id: "network", audience: "organizations", name: "Schools and networks", price: usd(SCHOOL.portal), note: `Per year for a school, with ${SCHOOL.seatsIncluded} advisor seats. ${usd(SCHOOL.perAdvisor)} per extra advisor.`, featured: true,
    points: ["Every club included, however many join", "Your school's official account and its verified clubs", "Advisors approve clubs and follow what they build", "Reporting: what members built and who signed it", "The first 10 schools get their first semester free", "National networks: a portal across chapters, priced with the founders"],
    cta: { label: "Book a demo", href: "/book?kind=school" },
  },
];

export const tiersFor = (a: Audience) => TIERS.filter((t) => t.audience === a);

// What someone can ask the founders for (supabase/money.sql request_sales()), and how /book says it.
export const SALES_KINDS = ["talent", "chapter", "challenge", "school", "plus"] as const;
export type SalesKind = (typeof SALES_KINDS)[number];
export const SALES: Record<SalesKind, { label: string; ask: string; org: string | null }> = {
  talent: { label: "Search seats for my company", ask: "A pilot of Find builders: search signed work and message members.", org: "Company" },
  chapter: { label: "Sponsor a chapter", ask: "Your name on a chapter, with reporting on what its members build.", org: "Company" },
  challenge: { label: "Sponsor a build challenge", ask: "A challenge clubs opt into, and the members who win it.", org: "Company" },
  school: { label: "A demo for my school or network", ask: "A portal for your school's clubs and advisors, with reporting. Every club included.", org: "School or network" },
  plus: { label: "Join the Plus waitlist", ask: "We'll email you when Plus opens, at the launch price.", org: null },
};
