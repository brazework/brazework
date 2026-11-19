# Elite MCP, then the launch tie-up

Date: 2026-11-19. The user picked the ranked plan in full: "All four, in order". There are four PRs,
each with auto-merge.

## Intent
Someone adds Brazework to their AI assistant and, within a minute, has their first milestone drafted
from work they really finished. It's signed by a person who saw it. The pitch is: "Your AI drafts the
proof. A person who saw it signs."

## The four PRs
1. **Quick wins in chat.** No database step.
   - A `start` prompt, listed first. It reads the field, looks over the last 30 days in the tools the
     assistant can reach, picks the strongest finished work with proof, and writes it as the first
     milestone, ending with the link.
   - Every write returns `next` (a plain next step) and `open` (where to see it). For a milestone
     with no club, `next` names `request_signature` and the milestone's id.
   - Refusals keep the database's words and add the fix where there's a choice: a personal-address
     signer, a teammate, a limit, missing evidence. This lives in `lib/mcp-results.ts`.
   - Fixture tests run every field's playbook through every prompt for each kind of token. A prompt may
     name only the tools that token is offered. This caught `/shipped` telling a drafts-only token to
     call `request_signature`, which is now fixed.
   - Sharper tool descriptions (`me`: call it first; `log_milestone`: what comes back).
2. **One-click connect (OAuth).**
   - Supabase Auth's OAuth 2.1 server (public beta) is the authorization server. It does dynamic
     client registration, PKCE and discovery.
   - Brazework adds:
     - `/.well-known/oauth-protected-resource` for the MCP endpoint
     - a 401 that points there (`WWW-Authenticate: resource_metadata=…`)
     - a consent page in the app
     - the route accepting a Supabase access token, alongside the `forge_` tokens kept for GitHub
       Actions and CI
   - Founder step: switch on the OAuth server and dynamic apps in the Supabase dashboard. Nothing is
     changed from a session.
3. **A signed-milestone card in the chat.**
   - Through the MCP Apps extension (`io.modelcontextprotocol/ui`): a `ui://` resource that tool
     results point to.
   - Clients without the extension show the text, as today.
   - Tested in Claude before relying on it.
4. **The launch tie-up.**
   - The hero and the Product Hunt welcome lead with the one-line pitch.
   - A "waiting for a signature" share card.
   - A more polished signing page, with an invitation to join afterwards.
   - Demo profiles on the local stack for the video.
   - `docs/mcp-workflows.md` and the launch kit updated.
   - A founder checklist: Resend in production, sign-in providers, uptime and Sentry, and the test
     milestone on Josh's profile.

## Not in these PRs
Letting a signer use a personal address (Gmail) changes what a signature proves. It's the user's
decision, and it's still open.

## Calls made by the builder
- PR 1 needs no database step: next steps are added in the server from what the functions already
  return.
- `start` asks the member to start a project in Today when they have none, rather than adding a
  create-project tool.
