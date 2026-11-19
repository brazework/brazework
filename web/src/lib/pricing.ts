// What Brazework costs, in one place (the Product Hunt launch,
// docs/superpowers/specs/2026-11-19-product-hunt-launch-design.md). The landing page's Pricing
// section and /pricing both read it, so they can't disagree. Company prices match docs/strategy.md.
// Pure, and tested (tests/pricing.test.ts).
//
// The paid individual tier's name and prices aren't settled: change them here. It isn't sold yet
// (no checkout), so it's shown as coming. Never call it "Pro": Pro means pro verification, a
// professional at a verified company signing a milestone (supabase/pro-verification.sql).

export const PLUS = { name: "Plus", student: 6, everyone: 12, sold: false };

export type Audience = "builders" | "organizations" | "companies";
export type Tier = {
  id: string; audience: Audience; name: string; price: string; note: string; points: string[];
  cta: { label: string; href: string }; featured?: boolean; soon?: boolean;
};

export const AUDIENCES: { id: Audience; label: string; line: string }[] = [
  { id: "builders", label: "Builders", line: "Students and professionals. The record is free, forever." },
  { id: "organizations", label: "Clubs, networks and schools", line: "Free for every club. Networks and schools get a portal across their chapters." },
  { id: "companies", label: "Companies", line: "Find people by work someone signed, not by keywords they typed." },
];

export const TIERS: Tier[] = [
  {
    id: "free", audience: "builders", name: "Free", price: "$0", note: "Always, with no ads", featured: true,
    points: ["Your record: every build, with the people who signed it", "Ask anyone who saw it to sign: a professor, a manager, your club", "A share card for every signed milestone", "Clubs, study groups, events and Ember", "Be found by companies, and know when one looks"],
    cta: { label: "Log your first build", href: "/signup" },
  },
  {
    id: "plus", audience: "builders", name: PLUS.name, price: `$${PLUS.student}/mo`, note: `For students. $${PLUS.everyone}/mo for everyone else.`, soon: !PLUS.sold,
    points: ["Everything in Free", "Every company that looked, not just this week's", "Your own profile link", "A PDF portfolio of your signed work", "Private builds, and more AI drafts from your tools"],
    cta: { label: "Start free", href: "/signup" },
  },
  {
    id: "clubs", audience: "organizations", name: "Clubs", price: "Free", note: "For every student club and study group",
    points: ["Members, events, chat, roles and officer handoff", "Officers verify members' work", "A page that shows what the club builds", "Study groups with the members' own record of who led"],
    cta: { label: "Bring your club", href: "/#founding" },
  },
  {
    id: "network", audience: "organizations", name: "Networks and schools", price: "Per active chapter", note: "Set up with the founders",
    points: ["A portal across every chapter and campus", "Every chapter's members and their signed work, in one place", "Reporting: what members built and who signed it", "Sponsor reports your partners can read"],
    cta: { label: "Talk to us", href: "/#founding" },
  },
  {
    id: "talent", audience: "companies", name: "Find builders", price: "From $300", note: "Per seat, per month",
    points: ["Search members by signed work, field, school and class year", "Message them in their Requests", "Follow clubs and builders", "They see that you looked, so it starts warm"],
    cta: { label: "Talk to us", href: "/#founding" },
  },
  {
    id: "challenge", audience: "companies", name: "Sponsored challenge", price: "From $1,000", note: "Per chapter, per semester",
    points: ["Post a build challenge that clubs opt into", "Meet the winners, signed by their clubs", "Reporting on who took part and what they built", "Your name on the challenge and its share cards"],
    cta: { label: "Sponsor a challenge", href: "/#founding" },
  },
];

export const tiersFor = (a: Audience) => TIERS.filter((t) => t.audience === a);
