// Load test (k6) for the busiest paths, against the LOCAL stack only (e2e/serve.sh), never production.
// Run it with: npm run load   (or the "Load test" workflow in GitHub Actions, on demand)
//   browse:  logged-in members reading the feed, a club, the network and projects; 0 → 200 at once
//   signups: a chapter signing up the same night, 3 new accounts a second for a minute
// Thresholds (the build of this run fails if missed): reads p95 < 500 ms and < 1% errors;
// sign-ups p95 < 1.5 s. Results print at the end; FIX-32 in Linear records them.
import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE || "http://localhost:3200";
const SUPABASE = __ENV.SUPABASE || "http://localhost:54321";
const COOKIE = __ENV.COOKIE || "";
const ANON = __ENV.ANON || "";
const PAGES = ["/feed", "/c/rkt", "/network", "/projects"];

export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      exec: "browse",
      stages: [{ duration: "30s", target: 50 }, { duration: "60s", target: 200 }, { duration: "30s", target: 200 }, { duration: "15s", target: 0 }],
    },
    signups: { executor: "constant-arrival-rate", exec: "signup", rate: 3, timeUnit: "1s", duration: "60s", preAllocatedVUs: 10, startTime: "30s" },
  },
  thresholds: {
    "http_req_duration{kind:read}": ["p(95)<500"],
    "http_req_failed{kind:read}": ["rate<0.01"],
    "http_req_duration{kind:signup}": ["p(95)<1500"],
    checks: ["rate>0.99"],
    // Per-page timings in the summary (a limit no run reaches, so these only report).
    ...Object.fromEntries(PAGES.map((p) => [`http_req_duration{page:${p}}`, ["p(95)<600000"]])),
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
};

// Print each distinct unexpected answer once per virtual member, so a failure says what came back.
const seen = new Set();
function note(what) { if (!seen.has(what)) { seen.add(what); console.warn(what); } }

export function browse() {
  const page = PAGES[Math.floor(Math.random() * PAGES.length)];
  const res = http.get(BASE + page, { headers: { Cookie: COOKIE }, redirects: 0, tags: { kind: "read", page } });
  // A redirect to /login would mean the session didn't apply: count it as a failure, not a fast page.
  check(res, { "page loads for a member": (r) => r.status === 200 });
  if (res.status !== 200) note(`${page} → ${res.status}${res.headers.Location ? ` ${res.headers.Location}` : ""}`);
  sleep(1 + Math.random());
}

export function signup() {
  const email = `load-${__VU}-${__ITER}-${Date.now()}@forge.test`;
  const res = http.post(`${SUPABASE}/auth/v1/signup`, JSON.stringify({
    email, password: "load-test-pass-1",
    data: { firstName: "Load", lastName: "Test", birthday: "2004-01-01", accountType: "student" },
  }), { headers: { "Content-Type": "application/json", apikey: ANON }, tags: { kind: "signup" } });
  check(res, { "sign-up accepted": (r) => r.status === 200 });
  if (res.status !== 200) note(`sign-up → ${res.status} ${String(res.body).slice(0, 120)}`);
}
