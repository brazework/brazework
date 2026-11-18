# Reliability targets (SLOs)

How reliable Brazework should be, how we measure it, and what we do when we miss (Linear FIX-132).

A **service level objective (SLO)** is a target for one thing members feel, measured the same way every time. The gap between the target and 100% is the **error budget**: how much failure we accept before reliability work comes before features. These targets are set for where we are today: two part-time founders, nobody on call overnight, no outside members yet. Raise them when that changes.

## The targets

| SLO | Target | Window | Error budget | Measured by |
|---|---|---|---|---|
| **Available:** the app answers and can reach its database | 99.5% of uptime checks of `https://brazework.com/api/health` return 200 | Rolling 30 days | 0.5% of checks: about 43 failed 5-minute checks, roughly 3.6 hours a month | The UptimeRobot monitor's uptime percentage (FIX-55) |
| **Responsive:** the app answers quickly | 95% of those checks respond in under 1 second | Rolling 30 days | 5% of checks may be slower | The same monitor's response times |

**Why these numbers.** 99.9% allows about 43 minutes of downtime a month, which needs someone able to respond within minutes at any hour. We can't promise that yet, so 99.5% is the honest target. One second is generous for a health check: on 2026-11-18, ten checks from a laptop all returned 200 in 0.14 to 0.24 seconds after a first, cold 0.80-second response, and the database round trip inside it (`ms` in the response) was 33 ms.

**What `/api/health` covers.** It returns 200 when the app is up and one small database query succeeds within 5 seconds, and 503 otherwise (`web/src/app/api/health/route.ts`). It doesn't cover sign-in, email or a slow page, so a member can have a bad time while it's green. Error reports in Sentry fill that gap below.

## Error reports (a response target, not an SLO yet)

Every new Sentry issue is looked at within 24 hours: fixed, linked to a Linear issue, or marked as expected with a reason. This turns into a measured SLO once Sentry is on in production and we have a few weeks of normal error rates to set a threshold from.

## When a budget is spent

| Budget used in the window | What we do |
|---|---|
| Under 50% | Nothing special. Ship features. |
| 50% or more | Say so in `/standup`. The next piece of work after the current one is the biggest cause of the failures. |
| 100% (target missed) | Feature work stops until the cause is fixed and a short write-up is in Linear: what happened, how we noticed, what stops it happening again. Deploys continue only for the fix. |

A miss caused by an outside provider (Vercel, Supabase) still counts. The write-up then says what we'd change to depend on it less, or why we accept it.

## Who looks, and when

- **Weekly:** `/standup` reports the 30-day uptime and the share of slow checks next to what shipped.
- **Monthly:** check that the targets still fit. Tighten them once there are outside members and the numbers have held for a full month.

## Not measured yet

- **Measurement starts when the uptime monitor is live.** Until then these are targets with no data. The monitor is a founder step in FIX-55.
- **Page speed for members** (how fast the feed loads in a real browser) is measured in CI by Lighthouse budgets, not in production. A production speed SLO needs real-user timing, which we don't collect.
