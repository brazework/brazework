---
name: bug-triage-from-feedback
description: Triage a member bug or feedback report for Brazework without copying student data, and without building it while it is still waiting on a founder. Use for Feedback-label issues, in-app feedback, or a bug reported in the Forge chat.
---

# Bug triage from feedback

Find out whether the report is real, and write that down. Don't start the fix while the issue is still in Backlog waiting on a founder. Approving or denying member feedback is the founders' call.

## 1. Take the report

- Linear: team **Forge**, key `FIX`, label `Feedback`, or a bug issue a founder already moved to Todo.
- Or a message in the Forge chat. If there is no issue yet and the board accepts one, open a Bug issue. If it came from a member, leave the approve-or-deny decision to the founders. If the issue cap refuses the create, write the triage in the chat and stop. Don't invent an id.

## 2. Keep student data inside the product

FERPA: never copy a student's name, email, grade, roster, class work, or other education record into Linear, GitHub, chat, or a file in the repo.

Reproduce with local data only: `npm run dev` from `web/` (test members `maya@forge.test`, `josh@forge.test`, `ben@forge.test`, `cara@forge.test`, password `forge-test-pass-1`) or Demo University (`e2e/local-supabase.sh up && e2e/demo-university.sh`). Never use production, and never open `web/.env.local`.

Describe the bug with the local account and the steps. If the report only exists on a real student's record, say what you would need a founder to confirm, without pasting that record.

## 3. Write the triage

Comment on the issue, short:

- What the member hit, in one sentence, with no real student data.
- Reproduces on the local stack, does not reproduce, or could not be tried, and why.
- Area, when you know it: Clubs, Projects, Profiles, Feed & Events, Messages, Notifications, Companies, AI, or iPhone.
- Whether a founder still has to approve it.

Don't propose a fake reproduction, and don't claim a fix you did not run.

## 4. What happens next

- Still in Backlog: stop. The founders approve (Todo, with an owner) or deny (Canceled, with a one-line reason).
- Approved, and it is one bug: `linear-issue-to-pr`.
- Two issues already in progress: leave it queued.

No production SQL, no secrets, no force-push, no push to `main`.
