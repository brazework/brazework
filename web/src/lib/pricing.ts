// What Brazework costs, in one place. /pricing, /schools and /plus read it, so they can't disagree.
// Prices match docs/strategy.md (schools first since 2026-11-26). Pure, and
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
export const SPONSORSHIP = { chapter: 2500, challengePrizes: 5000, serviceFee: 500 };
export const EMBER_DAILY_LIMIT = { free: 15, plus: 50 } as const;
export const EMBER_RESET = "Torch credits reset at midnight UTC.";
// What a school pays (founders, 2026-11-26; docs/strategy.md). Never per club, chapter or student, so a
// school never has a reason to keep anyone off. Every school pays, pilots included.
// - Pilot: one department for one semester, credited toward the first year.
// - Department: one department or college, a few faculty seats included, more at a seat price. Kept
//   under the amount most schools can sign without a formal bid, so a dean or chair can say yes.
// - Campus: every department and unlimited faculty, by enrollment band (a size, not a count of who
//   joins), so a school pays the same however many students and clubs come on.
export const SCHOOL = { pilot: 1500, department: 6000, seatsIncluded: 5, perSeat: 600 };
// Founding schools (founders, 2026-11-26): the first campuses pay `price`, locked for a few years; `list`
// is what a campus pays after those places are taken. A reason to sign this semester, and early
// schools pay no more than before. Keep `list` honest: it's the price later schools are really quoted.
export const FOUNDING = { schools: 10, lockYears: 3 };
export const CAMPUS_BANDS = [
  { upTo: 5000, price: 18000, list: 30000 },
  { upTo: 15000, price: 30000, list: 48000 },
  { upTo: Infinity, price: 45000, list: 72000 },
] as const;
/** A department's yearly price with this many faculty seats (the first few are included). */
export const departmentPrice = (seats: number) => SCHOOL.department + Math.max(0, Math.ceil(seats) - SCHOOL.seatsIncluded) * SCHOOL.perSeat;
/** A whole campus's yearly price, by its enrollment: the founding-school price, or the list price. */
export const campusPrice = (enrollment: number, founding = true) => { const b = CAMPUS_BANDS.find((x) => enrollment <= x.upTo)!; return founding ? b.price : b.list; };
/** What a campus of this size pays per student per year, in whole dollars and cents ("$2.00"). */
export const perStudent = (enrollment: number, founding = true) => `$${(campusPrice(enrollment, founding) / enrollment).toFixed(2)}`;
/** Past this many seats a campus license costs less than a department: say so where it's priced. */
export const seatsWhereCampusWins = () => Math.ceil((CAMPUS_BANDS[0].price - SCHOOL.department) / SCHOOL.perSeat) + SCHOOL.seatsIncluded;
// Companies: the hiring plan, a starter seat for a smaller or local employer, and sponsorships.
export const TALENT = { plan: 15000, planSeats: 2, starter: 4800 };
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
// What Plus will add but doesn't yet. Every page that lists Plus marks these "coming soon", so nobody
// pays for something that isn't built. Move an item out of this list when it ships.
export const PLUS_SOON = ["Your own profile link", "A PDF portfolio of your signed work", "More AI drafts from your tools"];

export type Audience = "schools" | "builders" | "companies";
export type Tier = {
  id: string; audience: Audience; name: string; price: string; note: string; points: string[];
  cta: { label: string; href: string }; featured?: boolean;
};

// Schools first (the realignment of 2026-11-26, docs/strategy.md): the school is the customer;
// students, clubs and signers never pay; companies come second. Plus isn't on the public price list:
// students use Brazework free. Its constants stay above for /plus and the app.
export const AUDIENCES: { id: Audience; label: string; line: string }[] = [
  { id: "schools", label: "Schools", line: "A portal for your faculty and offices. Never per student or per club." },
  { id: "builders", label: "Students and clubs", line: "Free, always. The record is the student's, for good." },
  { id: "companies", label: "Companies", line: "Find students by work their faculty and clubs signed." },
];

// What a school gets that's built today, and what's being built with the pilot schools. Every card
// marks the second kind, so no school pays for something that isn't there yet.
// (Faculty lists, class projects and the evidence export shipped with the portal, supabase/school-portal.sql.)
export const SCHOOL_SOON = ["Deliverable schedules and peer evaluation for project courses", "ABET outcomes ticked at verification, export grouped by outcome", "Placement data: which employers viewed and contacted your students"];

// What the campus license adds that's still being built, marked the same way.
export const CAMPUS_SOON = ["Student life, career center and admissions views", "Single sign-on", "Blackboard, Canvas or Moodle connection (LTI)"];

// Each audience has one primary call to action (featured); the other cards' are quieter.
export const TIERS: Tier[] = [
  {
    id: "pilot", audience: "schools", name: "Semester pilot", price: usd(SCHOOL.pilot), note: "One department or a few classes, for one semester. Credited toward your first year.",
    points: ["Set up with you by the founders", "Your students and clubs on Brazework, grouped by your school email", "Your official school account and its verified clubs", "A semester report of what your students built and who signed it", "Your numbers, to decide on the full campus"],
    cta: { label: "Start a pilot", href: "/book?kind=school" },
  },
  {
    id: "school", audience: "schools", name: "Department", price: usd(SCHOOL.department), note: `Per year, with ${SCHOOL.seatsIncluded} faculty seats. ${usd(SCHOOL.perSeat)} per extra seat.`, featured: true,
    points: ["Every student and every club in the department included", "Classes by course and semester, with rosters from a CSV", "Faculty from your own list verify class projects", "Evidence export for accreditation: every verified milestone", "Your school's numbers: students, classes, verified work, active clubs", ...SCHOOL_SOON.map((x) => `${x} (building with pilot schools)`)],
    cta: { label: "Book a call", href: "/book?kind=school" },
  },
  {
    id: "campus", audience: "schools", name: "Campus", price: `From ${usd(CAMPUS_BANDS[0].price)}`, note: `Per year for the first ${FOUNDING.schools} founding schools, locked for ${FOUNDING.lockYears} years: ${usd(CAMPUS_BANDS[0].price)} up to ${CAMPUS_BANDS[0].upTo.toLocaleString("en-US")} students, ${usd(CAMPUS_BANDS[1].price)} up to ${CAMPUS_BANDS[1].upTo.toLocaleString("en-US")}, ${usd(CAMPUS_BANDS[2].price)} above. List price from ${usd(CAMPUS_BANDS[0].list)}.`,
    points: ["Every department, unlimited faculty seats", `At ${CAMPUS_BANDS[1].upTo.toLocaleString("en-US")} students, ${perStudent(CAMPUS_BANDS[1].upTo)} a student a year`, "Every club on campus, verified as yours", "A data agreement for student privacy (FERPA)", ...CAMPUS_SOON.map((x) => `${x} (building with pilot schools)`)],
    cta: { label: "Talk to us", href: "/book?kind=school" },
  },
  {
    id: "free", audience: "builders", name: "Students", price: "$0", note: "Always, with no ads", featured: true,
    points: ["Your record: every project, with the people who signed it", "Ask a professor, your club or a coworker to sign", "A share card for every milestone, signed or waiting", `Torch: ${EMBER_DAILY_LIMIT.free} credits a day`, "Keep it all when you graduate: move to a personal email", "Be found by companies, and see who looked"],
    cta: { label: "Start your record", href: "/signup" },
  },
  {
    id: "clubs", audience: "builders", name: "Clubs", price: "Free", note: "For every student club and study group",
    points: ["Members, events, chat, roles and officer handoff", "Officers verify members' work", "Club projects and a page that shows what the club builds", "Verified as your school's club, with its badge"],
    cta: { label: "Bring your club", href: "/#pilot" },
  },
  {
    id: "starter", audience: "companies", name: "Starter", price: usd(TALENT.starter), note: "Per year, for 1 search and messaging seat",
    points: ["Search students by signed work, field, school and class year", "Message them in their Requests", "For a smaller or local employer"],
    cta: { label: "Start with one seat", href: "/book?kind=talent" },
  },
  {
    id: "talent", audience: "companies", name: "Find builders", price: usd(TALENT.plan), note: `Per year, for ${TALENT.planSeats} search and messaging seats`, featured: true,
    points: ["Search students by signed work, field, school and class year", "Message them in their Requests", "Chapter sponsorships and challenges are priced separately", "They see that you looked, so it starts warm"],
    cta: { label: "Book a pilot", href: "/book?kind=talent" },
  },
  {
    id: "sponsor", audience: "companies", name: "Sponsor a chapter or a challenge", price: usd(SPONSORSHIP.chapter), note: `Per chapter, per semester. All of it goes to the club. Plus a separate ${usd(SPONSORSHIP.serviceFee)} service fee: ${usd(SPONSORSHIP.chapter + SPONSORSHIP.serviceFee)} total.`,
    points: ["Your name on a chapter's page and its members' signed work", `Challenges: from ${usd(SPONSORSHIP.challengePrizes)} in prizes plus a separate ${usd(SPONSORSHIP.serviceFee)} service fee (${usd(SPONSORSHIP.challengePrizes + SPONSORSHIP.serviceFee)} total). Prizes go to the winners in full.`, "Meet the members who win, signed by their clubs", "The service fee covers setup, coordination and reporting; it never comes out of club funds or prizes"],
    cta: { label: "Sponsor a chapter", href: "/book?kind=chapter" },
  },
];

// Plus, for /plus only: it isn't on the public price list (students use Brazework free; the
// realignment of 2026-11-26). It still sells review packets to professionals from /plus.
export const PLUS_TIER: Tier = {
    id: "plus", audience: "builders", name: PLUS.name, price: `$${PLUS.everyoneYear}/yr`,
    note: `For professionals, or $${PLUS.everyone}/mo. Students with a confirmed school email: $${PLUS.student}/mo or $${PLUS.studentYear}/year. Join the waitlist while paid plans are being set up.`,
    points: [
      "Everything in Free",
      // Free while it's a Plus preview (lib/plans.ts), and the card says so: one word there changes both.
      `Review packets: your signed work over any period, ready for a performance review or a promotion case${FEATURE_ACCESS.reviewPacket === "plus-preview" ? " (free for everyone during launch)" : ""}`,
      `More Torch: ${EMBER_DAILY_LIMIT.plus} credits a day total`,
      "Every company that looked in the last 90 days, not just this week",
      ...PLUS_SOON.map((x) => `${x} (coming soon)`),
    ],
    cta: { label: "Get Plus", href: "/plus" },
  };

export const tiersFor = (a: Audience) => TIERS.filter((t) => t.audience === a);

// What someone can ask the founders for (supabase/money.sql request_sales()), and how /book says it.
export const SALES_KINDS = ["talent", "chapter", "challenge", "school", "plus"] as const;
export type SalesKind = (typeof SALES_KINDS)[number];
export const SALES: Record<SalesKind, { label: string; ask: string; org: string | null }> = {
  talent: { label: "Search seats for my company", ask: "A pilot of Find builders: search signed work and message members.", org: "Company" },
  chapter: { label: "Sponsor a chapter", ask: "Your name on a chapter, with reporting on what its members build.", org: "Company" },
  challenge: { label: "Sponsor a build challenge", ask: "A challenge clubs opt into, and the members who win it.", org: "Company" },
  school: { label: "A pilot for my school", ask: "A semester pilot for a department or a few classes: your students' projects, verified by faculty and clubs, with a report at the end. Every student and club included.", org: "School or department" },
  plus: { label: "Join the Plus waitlist", ask: "We'll email you when Plus opens, at the launch price.", org: null },
};
