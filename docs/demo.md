# 3-minute demo: the loop

For YC or a club. Runs locally on demo data, so nothing touches production.

## Set up (once, 2 minutes)

```sh
cd web
e2e/local-supabase.sh up                                # local Supabase with the test members
docker exec -i forge-e2e-db psql -q -U postgres -h localhost -d postgres < ../ios/scripts/seed-ui-tests.sql
FORGE_DEMO_SEED=1 node scripts/seed-demo.cjs            # example posts and replies (local only)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=$(cat e2e/.anon-key) npm run dev
```

Three browser windows: **Josh** (member), **Ben** (Rocketry Club owner) and **Cara** (admin of the verified company Acme Aerospace). Password for all: `forge-test-pass-1` (`josh@forge.test`, `ben@forge.test`, `cara@forge.test`). **Maya** (`maya@forge.test`) is a Brazework admin, for `/admin`.

## The script

1. **0:00, the problem (landing, 20 s).** "AI made résumés free. Proof is what's scarce now." Point at the live traction strip and the Students / Clubs / Companies buttons.
2. **0:20, Josh's first five minutes (40 s).** Home shows the checklist: he's in Rocketry Club. *Add what you're building*: create "Wind tunnel rig" on his profile. Back on Home, the composer already asks *Which project?* with it selected; share the update with Rocketry Club.
3. **1:00, ask for verification (30 s).** On the project, *Add milestone*: "Measured lift on 3 fin shapes", evidence link (a commit or video), show on profile. "No evidence, no request."
4. **1:30, the club verifies (40 s).** Ben's Home shows **Your week: 1 milestone waiting for you to verify**; his club page has the same in its To do list. Open it, look at the evidence, verify. Mention: officers only, never their own team's work, every step logged, revocable with a reason.
5. **2:10, proof on the profile (20 s).** Josh's profile: "Verified by Ben C. (owner), Rocketry Club · today." That badge is the product.
6. **2:30, the business (30 s).** Cara opens **Find builders**, searches "load cell": every result shows who verified the work and when. She posts a **challenge**; it goes live once sponsored (Stripe, or a pilot approved on `/admin`). Students and clubs are free; companies pay to sponsor. Ember drafts, never acts without approval, and never verifies.
7. **Close:** "One club leader says yes and 30 to 100 members come with them."
