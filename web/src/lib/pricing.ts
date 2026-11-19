// What Brazework costs, in one place (the Product Hunt launch). The landing page's Pricing section and
// /pricing both read it, so they can't disagree. Company prices match docs/strategy.md. Pure, and
// tested (tests/pricing.test.ts).
//
// Plus's name and prices aren't settled: change them here. Whether it can be bought is decided at
// runtime (lib/billing.ts plusOnSale(): Stripe on and STRIPE_PRICE_PLUS set); until then /plus takes
// a place on the waitlist. Never call it "Pro": Pro means pro verification, a professional at a
// verified company signing a milestone (supabase/pro-verification.sql).

export const PLUS = { name: "Plus", student: 6, everyone: 12 };

export type Audience = "builders" | "companies" | "organizations";
export type Tier = {
  id: string; audience: Audience; name: string; price: string; note: string; points: string[];
  cta: { label: string; href: string }; featured?: boolean;
};

export const AUDIENCES: { id: Audience; label: string; line: string }[] = [
  { id: "builders", label: "Builders", line: "Students and professionals. The record is free, forever." },
  { id: "companies", label: "Companies", line: "Find people by work someone signed, not by keywords they typed." },
  { id: "organizations", label: "Clubs, networks and schools", line: "Free for every club. Networks and schools get a portal across their chapters." },
];

// Each audience has one primary call to action (featured); the other card's is quieter.
export const TIERS: Tier[] = [
  {
    id: "free", audience: "builders", name: "Free", price: "$0", note: "Always, with no ads", featured: true,
    points: ["Your record: every build, with the people who signed it", "Ask anyone who saw it to sign: a professor, a manager, your club", "A share card for every milestone, signed or waiting", "Clubs, study groups, events and your AI agent", "Be found by companies, and see who looked this week"],
    cta: { label: "Log your first build", href: "/signup" },
  },
  {
    id: "plus", audience: "builders", name: PLUS.name, price: `$${PLUS.student}/mo`, note: `For students. $${PLUS.everyone}/mo for everyone else.`,
    points: ["Everything in Free", "Every company that looked in the last 90 days, not just this week", "Your own profile link", "A PDF portfolio of your signed work", "More AI drafts from your tools"],
    cta: { label: "Get Plus", href: "/plus" },
  },
  {
    id: "talent", audience: "companies", name: "Find builders", price: "From $300", note: "Per seat, per month", featured: true,
    points: ["Search members by signed work, field, school and class year", "Message them in their Requests", "Follow clubs and builders", "They see that you looked, so it starts warm"],
    cta: { label: "Book a pilot", href: "/book?kind=talent" },
  },
  {
    id: "sponsor", audience: "companies", name: "Sponsor a chapter or a challenge", price: "From $1,000", note: "Per chapter, per semester",
    points: ["Your name on a chapter's page and its members' signed work", "Or post a build challenge that clubs opt into", "Meet the members who win, signed by their clubs", "Reporting on who took part and what they built"],
    cta: { label: "Sponsor a chapter", href: "/book?kind=chapter" },
  },
  {
    id: "clubs", audience: "organizations", name: "Clubs", price: "Free", note: "For every student club and study group",
    points: ["Members, events, chat, roles and officer handoff", "Officers verify members' work", "A page that shows what the club builds", "Study groups with the members' own record of who led"],
    cta: { label: "Bring your club", href: "/#founding" },
  },
  {
    id: "network", audience: "organizations", name: "Networks and schools", price: "Per active chapter", note: "Set up with the founders", featured: true,
    points: ["A portal across every chapter and campus", "Every chapter's members and their signed work, in one place", "Reporting: what members built and who signed it", "Sponsor reports your partners can read"],
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
  school: { label: "A demo for my school or network", ask: "A portal across your chapters, with reporting.", org: "School or network" },
  plus: { label: "Join the Plus waitlist", ask: "We'll email you when Plus opens, at the launch price.", org: null },
};
