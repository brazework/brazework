// What Brazework costs (lib/pricing.ts): one config for /pricing, /schools and /plus. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { AUDIENCES, CAMPUS_SOON, PLUS, PLUS_TIER, SALES, SALES_KINDS, SCHOOL_SOON, TIERS, tiersFor } from "@/lib/pricing";

test("every audience has two or three tiers and exactly one primary call to action", () => {
  for (const a of AUDIENCES) {
    assert.ok([2, 3].includes(tiersFor(a.id).length), a.id);
    assert.equal(tiersFor(a.id).filter((t) => t.featured).length, 1, `${a.id}: one primary`);
  }
  for (const t of TIERS) {
    assert.ok(t.price && t.note && t.points.length >= 3, t.id);
    assert.match(t.cta.href, /^\/(signup|#pilot|book\?kind=(talent|chapter|challenge|school))$/, t.id);
  }
});

test("schools come first, students and clubs never pay, and every /book link is a kind the database accepts", () => {
  // The school is the customer (docs/strategy.md, 2026-11-26).
  assert.deepEqual(AUDIENCES.map((a) => a.id), ["schools", "builders", "companies"]);
  for (const t of tiersFor("builders")) assert.match(t.price, /^(\$0|Free)$/, t.id);
  assert.ok(!TIERS.some((t) => t.cta.href === "/plus"), "Plus isn't on the public price list");
  assert.ok(tiersFor("companies").every((t) => t.cta.href.startsWith("/book?kind=")));
  assert.ok(tiersFor("schools").every((t) => t.cta.href === "/book?kind=school"));
  for (const t of TIERS) {
    const kind = t.cta.href.match(/kind=(\w+)/)?.[1];
    if (kind) assert.ok((SALES_KINDS as readonly string[]).includes(kind), kind);
  }
  for (const k of SALES_KINDS) assert.ok(SALES[k].label && SALES[k].ask, k);
});

test("the record is free; the paid tier isn't called Pro and its prices come from one place", () => {
  assert.equal(tiersFor("builders")[0].price, "$0");
  assert.notEqual(PLUS.name.toLowerCase(), "pro", "Pro means pro verification");
  for (const t of TIERS) assert.ok(!/\bpro\b/i.test(t.name), t.name);
  assert.ok(!/\bpro\b/i.test(PLUS_TIER.name));
  assert.ok(PLUS_TIER.price.includes(String(PLUS.everyoneYear)) && PLUS_TIER.note.includes(String(PLUS.student)));
});

test("schools pay by department or campus and by faculty seat, never per club, chapter or student", async () => {
  const { SCHOOL, CAMPUS_BANDS, departmentPrice, campusPrice, seatsWhereCampusWins } = await import("@/lib/pricing");
  assert.equal(departmentPrice(0), SCHOOL.department, "the department alone");
  assert.equal(departmentPrice(SCHOOL.seatsIncluded), SCHOOL.department, "the included seats cost nothing extra");
  assert.equal(departmentPrice(10), 9_000);
  assert.equal(campusPrice(4000), 18_000);
  assert.equal(campusPrice(12000), 30_000);
  assert.equal(campusPrice(40000), 45_000);
  // Bands only go up with size, and a big department is told when the campus license is cheaper.
  for (let i = 1; i < CAMPUS_BANDS.length; i++) assert.ok(CAMPUS_BANDS[i].price > CAMPUS_BANDS[i - 1].price);
  assert.ok(departmentPrice(seatsWhereCampusWins()) >= campusPrice(1));
  // A price per club would give a school a reason to keep clubs off Brazework.
  for (const t of tiersFor("schools")) assert.ok(!/per (active )?(club|chapter|student)/i.test(`${t.price} ${t.note}`), t.id);
  const school = TIERS.find((t) => t.id === "school")!;
  assert.ok(school.price.includes("6,000") && school.note.includes("600"), "the card shows the department and the seat price");
  assert.ok(school.points.some((p) => /every student and every club/i.test(p)));
  assert.ok(TIERS.find((t) => t.id === "campus")!.points.some((p) => /unlimited faculty/i.test(p)));
});

test("every school pays, pilots included: the pilot is credited toward the first year", async () => {
  const { SCHOOL } = await import("@/lib/pricing");
  for (const t of tiersFor("schools")) assert.ok(!/^(free|\$0)$/i.test(t.price), `${t.id} is free`);
  const pilot = TIERS.find((t) => t.id === "pilot")!;
  assert.equal(pilot.price, `$${SCHOOL.pilot.toLocaleString("en-US")}`);
  assert.match(pilot.note, /credited toward your first year/i);
  assert.ok(SCHOOL.pilot < SCHOOL.department);
});

test("a school never pays for what isn't built: the portal marks what's coming", () => {
  const school = TIERS.find((t) => t.id === "school")!;
  for (const soon of SCHOOL_SOON) assert.ok(school.points.includes(`${soon} (building with pilot schools)`), soon);
  const campus = TIERS.find((t) => t.id === "campus")!;
  for (const soon of CAMPUS_SOON) assert.ok(campus.points.includes(`${soon} (building with pilot schools)`), soon);
  // Nothing on the pilot card is a promise: it's only what's built today.
  const pilot = TIERS.find((t) => t.id === "pilot")!;
  for (const soon of SCHOOL_SOON) assert.ok(!pilot.points.some((p) => p.includes(soon)), soon);
});

test("a chapter sponsorship goes to the club in full: Brazework takes no cut", () => {
  const sponsor = TIERS.find((t) => t.id === "sponsor")!;
  assert.match(sponsor.note, /all of it goes to the club/i);
  // Money meant for a club is never split with Brazework (founders, 2026-11-19).
  for (const t of TIERS) assert.ok(!/\b\d{1,2}% (goes )?to the club\b/i.test(`${t.note} ${t.points.join(" ")}`), t.id);
});

test("Plus never sells what isn't built: everything still coming is marked coming soon", async () => {
  const { PLUS_SOON } = await import("@/lib/pricing");
  const plus = PLUS_TIER;
  for (const soon of PLUS_SOON) assert.ok(plus.points.includes(`${soon} (coming soon)`), soon);
  assert.ok(plus.points.some((p) => p.includes("90 days") && !p.includes("coming soon")), "who looked over 90 days is built");
});

test("Plus leads with the review packet, says plainly it's free during launch, and shows the yearly prices", () => {
  const plus = PLUS_TIER;
  assert.match(plus.points[1], /review packet/i, "the packet is the first thing Plus adds");
  assert.match(plus.points[1], /free for everyone during launch/, "it's a Plus preview today, and says so");
  assert.ok(plus.note.includes(`$${PLUS.studentYear}`) && plus.price.includes(`$${PLUS.everyoneYear}`), plus.note);
  assert.ok(PLUS.everyoneYear < PLUS.everyone * 12 && PLUS.studentYear < PLUS.student * 12, "a year costs less than twelve months");
});


test("company search excludes sponsorships and service fees never reduce club or prize funds", async () => {
  const { SPONSORSHIP } = await import("@/lib/pricing");
  const talent = TIERS.find((t) => t.id === "talent")!;
  assert.equal(talent.price, "$15,000");
  assert.match(talent.note, /2 search and messaging seats/);
  assert.ok(talent.points.some((p) => /sponsorships.*separately/i.test(p)));
  assert.doesNotMatch(talent.points.join(" "), /two chapters sponsored/i);
  assert.equal(SPONSORSHIP.serviceFee, 500);
  const sponsor = TIERS.find((t) => t.id === "sponsor")!;
  assert.match(sponsor.note, /3,000 total/);
  assert.match(sponsor.points.join(" "), /5,500 total/);
  assert.match(TIERS.find((t) => t.id === "free")!.points.join(" "), /15 credits a day/);
  assert.match(PLUS_TIER.points.join(" "), /50 credits a day total/);
});
