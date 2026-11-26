import { goalTitle, isGoalKind } from "@/lib/goals";
import type Anthropic from "@anthropic-ai/sdk";
import { can, rank } from "@/lib/communities";
import { EVENT_FORMATS, EVENT_TYPES } from "@/lib/events";
import type { Choice, Proposal, TorchQuestion, TorchRubricRow } from "@/lib/copilot-agent";
import { MAX_OPTION, MAX_OPTIONS, MIN_OPTIONS, cleanOptions, cleanThen } from "@/lib/ember-thread";
import { dbFeatures } from "@/lib/db-features";
import { newestFirst } from "@/lib/ember-record";
import { ALL_TOPICS, requestTime } from "@/lib/forge";
import { loadClubReport } from "@/lib/club-report";
import { GitHubError, fetchRepo, fetchUser, matchTopics, parseRepo, parseUser } from "@/lib/connectors/github";
import { loadGuide } from "@/lib/guide";
import { buildBuilders, rankBuilders, type Person, type VerifiedRow } from "@/lib/talent";
import type { createClient } from "@/lib/supabase/server";

// Copilot's tools. They run with the member's own Supabase session, so row-level security decides
// what they can see: Copilot never sees more than the member could. Nothing here writes. The
// propose_* tools only check a draft and hand it to the UI as a card; the member confirms it there,
// and the app's normal server action (with its own checks) does the saving.

type DB = Awaited<ReturnType<typeof createClient>>;
type MsRow = { id: string; project_id: string; title: string; status: string; community_id: string | null; achieved_on?: string | null };

/**
 * my_profile's open_milestones: what is still waiting for proof, newest first by the day each
 * happened, with that date, so "my latest milestone" is the first one. Pure (tests/ember-record-tools.test.ts).
 */
export function openMilestones(rows: MsRow[]) {
  return newestFirst(rows.filter((m) => m.status === "draft" || m.status === "pending").map((m) => ({ ...m, on: m.achieved_on ?? "" })))
    .slice(0, 10)
    .map((m) => ({ id: m.id, title: snip(m.title, 120), date: m.on || undefined, project_id: m.project_id, waiting_on: m.community_id ? "a club" : "a person who saw it" }));
}

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_clubs",
    description: "Search clubs (communities) on Brazework by keyword and/or field. Returns up to 8, biggest first, each with its link path.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Keywords, e.g. 'rocketry' or 'formula'" }, field: { type: "string", description: "A field, e.g. 'Mechanical Engineering'" } } },
  },
  {
    name: "upcoming_events",
    description: "Published events on Brazework in the next N days (default 30), soonest first, optionally matching keywords. Each has its link path.",
    input_schema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 90 }, query: { type: "string" } } },
  },
  {
    name: "find_people",
    description: "Find Brazework members by keyword (name or headline) and/or field or interest. Returns up to 8, each with a profile link path.",
    input_schema: { type: "object", properties: { query: { type: "string" }, field: { type: "string" }, interest: { type: "string" } } },
  },
  {
    name: "find_builders",
    description: "For admins of a verified company or school only: members ranked by work their club verified (public verified milestones), matching skills or work keywords, optionally only those open to internships, full_time, research, co_founder, collaborators or mentoring. Returns up to 8 with who verified what, and a profile link path. Messages to them land in their Requests.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Skills or work, e.g. 'STM32 flight computer'" }, open_to: { type: "string" } } },
  },
  {
    name: "open_challenges",
    description: "Sponsored build challenges open for entries, soonest deadline first, optionally matching keywords. Each has its sponsor, prize, deadline and link path; members enter with a project they own.",
    input_schema: { type: "object", properties: { query: { type: "string" } } },
  },
  {
    name: "my_profile",
    description: "The member's own profile: headline, field, interests, clubs and roles, projects with milestone counts, the milestones still waiting for proof (newest first, each with the date it happened) and the guide steps they haven't done yet.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "club_overview",
    description: "One of the member's own clubs: size, recent posts, upcoming events, and for its moderators and up, milestones waiting for review and setup steps left.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
  },
  {
    name: "propose_post",
    description: "Prepare a feed post for the member to review and confirm. Use when they want to post something. It is NOT posted until they confirm.",
    input_schema: { type: "object", properties: { body: { type: "string", description: "The post, at most 3000 characters" }, kind: { type: "string", enum: ["update", "question", "result", "project"] }, tags: { type: "array", items: { type: "string" }, maxItems: 3, description: "Up to 3 of the member's interests" } }, required: ["body", "kind"] },
  },
  {
    name: "my_record",
    description: "The member's proven work: every milestone that was signed by a person, verified by a club or backed by GitHub, newest first, each with its date, project, who stood behind it and its proof link; plus how many are still waiting and a count per year. Use it to write a self-review, résumé bullets, a summary for a coworker, or the story of their record year by year. Write only from what it returns, and name who signed each result.",
    input_schema: { type: "object", properties: { since: { type: "string", description: "Optional YYYY-MM-DD: only work on or after this day (for example six months ago for a review)" } } },
  },
  {
    name: "whats_new",
    description: "What happened for the member since they last looked: unread notifications (a signature that came in, a milestone verified or declined, replies, club news), newest first. Use it when they ask what they missed or what changed.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "propose_project_edit",
    description: "Prepare a change to one of the member's own projects: its summary, its write-up or its link. Pass only the fields that change; the card shows what is there now beside the new text. Write from what the member told you or what github_repo returned, never invented results. It is NOT saved until they confirm.",
    input_schema: { type: "object", properties: { project_id: { type: "string" }, summary: { type: "string", description: "The one-paragraph summary, at most 600 characters" }, details: { type: "string", description: "The write-up, at most 5,000 characters" }, link: { type: "string", description: "An https link to the repo, doc or demo" } }, required: ["project_id"] },
  },
  {
    name: "propose_goal",
    description: "Prepare what the member is working toward, as a card they confirm: one of internship, job (their next full-time role, for students and working people), grad, research, competition, funding, with an optional field or area (target, like 'power electronics' or 'product design'). Ask what they want first if it isn't clear; never pick for them. The card also asks whether companies searching Brazework may see it. Setting a new goal replaces the active one. It is NOT set until they confirm.",
    input_schema: { type: "object", properties: { kind: { type: "string", enum: ["internship", "job", "grad", "research", "competition", "funding"] }, target: { type: "string", description: "The field or area, at most 80 characters; may be empty" }, why: { type: "string", description: "One sentence, in plain words, on why this fits what they said" } }, required: ["kind"] },
  },
  {
    name: "propose_memory",
    description: "Offer to remember something lasting the member told you, so it carries over to the next chat: where they're headed, who signs their work, how they like answers. One short sentence in their words, at most 200 characters. Never anything sensitive (health, money, family, passwords). It is NOT saved until they confirm, and they can forget it in Settings.",
    input_schema: { type: "object", properties: { fact: { type: "string", description: "What to remember, in their words, at most 200 characters" } }, required: ["fact"] },
  },
  {
    name: "propose_milestone",
    description: "Prepare a milestone on one of the member's projects for one of their clubs to verify. Get project and club ids from my_profile. It is NOT sent until they confirm.",
    input_schema: { type: "object", properties: { project_id: { type: "string" }, club_id: { type: "string" }, title: { type: "string", description: "What happened, at most 120 characters" }, evidence: { type: "string", description: "Required: an https link to a photo, video, file, commit or the club event where it happened. Ask the member for it; never invent one." }, detail: { type: "string", description: "Numbers and conditions, at most 600 characters" }, achieved_on: { type: "string", description: "YYYY-MM-DD" } }, required: ["project_id", "club_id", "title", "evidence"] },
  },
  {
    name: "propose_signature",
    description: "Prepare an ask for a person who saw the member's work to sign a milestone, by email: a coworker, tech lead, professor, TA, lab PI, mentor or client who isn't on the project. Two uses. A new milestone: pass project_id (from my_profile), title and evidence. A milestone already waiting: pass milestone_id from my_profile's open_milestones and nothing else about the milestone. Pass the person's email only if the member gave it; never guess one. Without it the card still shows, and the member types the address there. It is NOT sent until they confirm the card.",
    input_schema: { type: "object", properties: { milestone_id: { type: "string", description: "Only for a milestone already waiting: its id from open_milestones" }, project_id: { type: "string" }, title: { type: "string", description: "What happened, at most 120 characters, with the number if the member gave one" }, evidence: { type: "string", description: "For a new milestone, required: an https link to a pull request, commit, doc, photo, video or file. Ask the member for it; never invent one." }, detail: { type: "string", description: "Numbers, method, what it was measured against (optional)" }, achieved_on: { type: "string", description: "YYYY-MM-DD, the day it happened (default today)" }, email: { type: "string", description: "The signer's email, exactly as the member gave it" }, relationship: { type: "string", enum: ["professor", "ta", "pi", "manager", "mentor", "other"], description: "How the signer knows the work. Use the API value 'manager' for a coworker, including a tech lead. Use 'other' for a client." } } },
  },
  {
    name: "propose_join_club",
    description: "Prepare joining a club (its id is in its link /c/<id>). It is NOT joined until the member confirms.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
  },
  {
    name: "propose_rsvp",
    description: "Prepare RSVPing the member to an upcoming event (its id is in its link /events/<id>, from upcoming_events). They are NOT going until they confirm.",
    input_schema: { type: "object", properties: { event_id: { type: "string" } }, required: ["event_id"] },
  },
  {
    name: "propose_message",
    description: "Prepare a direct message to a person (their id is in their link /u/<id>, from find_people). Write a short, specific, friendly first message in the member's voice; mention why they're reaching out. If they aren't connected it arrives as a message request. NOT sent until the member confirms.",
    input_schema: { type: "object", properties: { person_id: { type: "string" }, body: { type: "string" } }, required: ["person_id", "body"] },
  },
  {
    name: "propose_follow",
    description: "Prepare following a person (their id is in their link /u/<id>). Not followed until the member confirms.",
    input_schema: { type: "object", properties: { person_id: { type: "string" } }, required: ["person_id"] },
  },
  {
    name: "propose_event",
    description: `Prepare a club event, for a club where the member is an admin or owner. type is one of: ${EVENT_TYPES.join(", ")}. format is one of: ${EVENT_FORMATS.join(", ")}. Times are ISO 8601 with a timezone offset. It is NOT published until they confirm.`,
    input_schema: { type: "object", properties: { club_id: { type: "string" }, title: { type: "string" }, description: { type: "string" }, type: { type: "string" }, format: { type: "string" }, location: { type: "string" }, topic: { type: "string" }, starts_at: { type: "string" }, ends_at: { type: "string" } }, required: ["club_id", "title", "starts_at"] },
  },
  {
    name: "club_report",
    description: "This week in one of the member's clubs (they must be a moderator, admin or owner): members and new joiners, posts this week vs last, the top post and most active members, upcoming events with RSVPs, milestones verified and waiting, join requests.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
  },
  {
    name: "verify_queue",
    description: "Milestones members asked the club to verify, oldest first, with their details and evidence links (for the club's moderators and up). Read-only: Torch never verifies; officers review each one themselves in the club's Verify tab.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
  },
  {
    name: "propose_club_post",
    description: "Prepare a post in one of the member's clubs (for example the weekly update, an announcement or a welcome). It is NOT posted until they confirm.",
    input_schema: { type: "object", properties: { club_id: { type: "string" }, body: { type: "string", description: "At most 3000 characters" }, kind: { type: "string", enum: ["update", "question", "result", "project"] } }, required: ["club_id", "body"] },
  },
  {
    name: "my_courses",
    description: "The member's classes on Brazework Courses, with their role. For classes they teach (owner, admin or moderator): each assignment and quiz with its id, due date, whether it's published, how many handed in and how many are graded. For classes they take: what's due, with whether they handed it in.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "course_roster",
    description: "For a class the member teaches: its students (id and name) and, given an assignment_id, who handed it in, when, and whether it was late. Use it before propose_extension.",
    input_schema: { type: "object", properties: { class_id: { type: "string" }, assignment_id: { type: "string" } }, required: ["class_id"] },
  },
  {
    name: "propose_quiz",
    description: "Write a quiz for a class the member teaches. Each question: prompt; type 'choice' (one right option: answer is its 0-based index), 'multi' (several right: answer is an array of indexes), 'number' (answer is the number, tolerance the allowed error) or 'short' (no answer: the professor scores it); options (2 to 10) for choice and multi; points. Write accurate questions with one defensible right answer, at the level of the course; never invent course facts you weren't given. closes_at is ISO 8601 with a timezone offset. publish false keeps it a draft (the default). Nothing is saved until the member confirms.",
    input_schema: { type: "object", properties: {
      class_id: { type: "string" }, title: { type: "string" }, instructions: { type: "string" }, closes_at: { type: "string" },
      questions: { type: "array", items: { type: "object", properties: { prompt: { type: "string" }, type: { type: "string", enum: ["choice", "multi", "number", "short"] }, options: { type: "array", items: { type: "string" } }, answer: {}, tolerance: { type: "number" }, points: { type: "number" } }, required: ["prompt", "type", "points"] } },
      show_score: { type: "boolean" }, publish: { type: "boolean" } }, required: ["class_id", "title", "questions"] },
  },
  {
    name: "propose_assignment",
    description: "Draft an assignment for a class the member teaches: title, instructions, due_at (ISO 8601 with offset), points, an optional rubric (rows of criterion and points, each optionally tagged with an ABET outcome '1' to '7'; with a rubric the points are its total), what students hand in (any of file, link, text, milestone), group_work, peer_eval (group work only), publish (false keeps it a draft, the default). Nothing is saved until the member confirms.",
    input_schema: { type: "object", properties: {
      class_id: { type: "string" }, title: { type: "string" }, instructions: { type: "string" }, due_at: { type: "string" }, points: { type: "number" },
      rubric: { type: "array", items: { type: "object", properties: { criterion: { type: "string" }, points: { type: "number" }, outcome: { type: "string" } }, required: ["criterion", "points"] } },
      submit_as: { type: "array", items: { type: "string", enum: ["file", "link", "text", "milestone"] } }, group_work: { type: "boolean" }, peer_eval: { type: "boolean" }, publish: { type: "boolean" } }, required: ["class_id", "title"] },
  },
  {
    name: "propose_announcement",
    description: "Draft an announcement to a class the member teaches (everyone in it is notified once they confirm). Nothing happens until the member confirms.",
    input_schema: { type: "object", properties: { class_id: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["class_id", "title", "body"] },
  },
  {
    name: "propose_extension",
    description: "Prepare an extension: a later due date on one assignment for one student in a class the member teaches (ids from my_courses and course_roster; due_at ISO 8601 with offset). Nothing happens until the member confirms.",
    input_schema: { type: "object", properties: { assignment_id: { type: "string" }, person_id: { type: "string" }, due_at: { type: "string" } }, required: ["assignment_id", "person_id", "due_at"] },
  },
  {
    name: "propose_attendance",
    description: "Prepare taking attendance in a class the member teaches: opens check-in with a code for minutes (5 to 60; default 15). Nothing happens until the member confirms.",
    input_schema: { type: "object", properties: { class_id: { type: "string" }, title: { type: "string" }, minutes: { type: "number" } }, required: ["class_id"] },
  },
  {
    name: "github_repo",
    description: "Read a public GitHub repository: description, languages, topics, stars, README text, releases and recent commits (with links). Accepts owner/repo or a github.com URL.",
    input_schema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] },
  },
  {
    name: "github_user",
    description: "A public GitHub profile and their most recently pushed repositories (not forks).",
    input_schema: { type: "object", properties: { username: { type: "string" } }, required: ["username"] },
  },
  {
    name: "propose_project",
    description: "Prepare a new project on the member's Brazework profile, usually from github_repo. title <= 120 chars, summary <= 600, details (the write-up) <= 5000, link to the repo or demo, up to 3 tags. It is NOT added until they confirm.",
    input_schema: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, details: { type: "string" }, link: { type: "string" }, tags: { type: "array", items: { type: "string" } }, status: { type: "string", enum: ["in_progress", "completed"] }, year: { type: "string" } }, required: ["title", "summary"] },
  },
];

// Every card can say what Torch does next once it's confirmed (the spec's part 3). makeExec keeps it only
// where the page can carry on; elsewhere it's dropped and the card is as before.
const THEN_PROP = { then: { type: "string", description: "Only when your instructions say you can carry a job through: the next step, in a few of the member's words, for after they confirm this card (\"log the milestone on it\"). Leave it out on the last step." } };
for (const t of TOOLS) if (t.name.startsWith("propose_")) Object.assign((t.input_schema.properties ??= {}) as Record<string, unknown>, THEN_PROP);

// Offered only where the page can show buttons (the Ask Torch bar and Torch's page send `choices`;
// app/api/copilot/route.ts). Elsewhere, and in group chats, Torch asks in words.
export const OFFER_CHOICES: Anthropic.Tool = {
  name: "offer_choices",
  description: `Show the member ${MIN_OPTIONS} to ${MAX_OPTIONS} short answers to the question you just asked, as buttons they tap. Use it only when you need one answer to go on and the answers are things you already have: their clubs, projects or waiting milestones, people a lookup returned, or yes and no. Each answer at most ${MAX_OPTION} characters, in the member's words. It ends your message, so write the question before calling it and nothing after. Nothing is saved.`,
  input_schema: { type: "object", properties: { options: { type: "array", items: { type: "string" }, minItems: MIN_OPTIONS, maxItems: MAX_OPTIONS } }, required: ["options"] },
};

// What Copilot hears back after a proposal: it's on screen, and the member decides.
const SHOWN = { shown_to_member: true, note: "The member sees this as a card and will confirm, edit or dismiss it. Don't say it's done; tell them to check the card." };
const pid = () => Math.random().toString(36).slice(2, 10);
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;
// How a signer knows the work (lib/vouch-email.ts RELATIONSHIPS; the database checks the same list).
const SIGNERS = ["professor", "ta", "pi", "manager", "mentor", "other"];

// Keywords go into PostgREST filters, so keep only characters that can't change the filter's meaning.
const clean = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '&.+#-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const snip = (s: string | null | undefined, n = 140) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// `carryOn`: the page can carry on after a yes, so a card keeps the next step Torch gave it.
export function makeExec(db: DB, userId: string, onProposal: (p: Proposal) => void = () => {}, onChoice: (c: Choice) => void = () => {}, { carryOn = false }: { carryOn?: boolean } = {}) {
  return async (name: string, input: unknown): Promise<unknown> => {
    const a = (input ?? {}) as Record<string, unknown>;
    const then = carryOn ? cleanThen(a.then) : "";
    const propose = (p: Proposal) => onProposal(then ? { ...p, then } : p);
    switch (name) {
      case "search_clubs": {
        const q = clean(a.query), field = clean(a.field);
        let req = db.from("communities").select("id, name, field, type, privacy, member_count, about, topics").neq("type", "class").order("member_count", { ascending: false }).limit(8);
        if (q) req = req.or(`name.ilike.*${q}*,about.ilike.*${q}*`);
        if (field) req = req.ilike("field", `%${field}%`);
        const { data, error } = await req;
        if (error) return { error: "Club search failed." };
        return (data ?? []).map((c) => ({ name: c.name, field: c.field, members: c.member_count, joining: c.privacy === "public" ? "open" : "approval", about: snip(c.about), topics: (c.topics ?? []).slice(0, 5), link: `/c/${c.id}` }));
      }
      case "upcoming_events": {
        const days = Math.min(90, Math.max(1, Number(a.days) || 30));
        const q = clean(a.query);
        const now = requestTime();
        let req = db.from("events").select("id, title, type, format, location, starts_at, rsvp_count, description").eq("status", "published")
          .gt("starts_at", new Date(now).toISOString()).lt("starts_at", new Date(now + days * 864e5).toISOString()).order("starts_at", { ascending: true }).limit(10);
        if (q) req = req.or(`title.ilike.*${q}*,description.ilike.*${q}*,topic.ilike.*${q}*`);
        const { data, error } = await req;
        if (error) return { error: "Event lookup failed." };
        return (data ?? []).map((e) => ({ title: e.title, type: e.type, format: e.format, where: e.format === "Online" ? "Online" : e.location, starts: e.starts_at.slice(0, 16).replace("T", " ") + " UTC", going: e.rsvp_count, link: `/events/${e.id}` }));
      }
      case "find_people": {
        const q = clean(a.query), field = clean(a.field), interest = clean(a.interest, 40);
        let req = db.from("profiles").select("id, first_name, last_name, headline, field").eq("onboarded", true).neq("id", userId).limit(8);
        if (q) req = req.or(`first_name.ilike.*${q}*,last_name.ilike.*${q}*,headline.ilike.*${q}*`);
        if (field) req = req.ilike("field", `%${field}%`);
        if (interest) req = req.contains("interests", [interest]);
        const { data, error } = await req;
        if (error) return { error: "People search failed." };
        return (data ?? []).map((p) => ({ name: `${p.first_name} ${p.last_name}`.trim(), headline: snip(p.headline, 100), field: p.field, link: `/u/${p.id}` }));
      }
      case "find_builders": {
        const f = await dbFeatures();
        const { data: adm } = await db.from("organization_admins").select("organizations(verification_status, type)").eq("uid", userId).limit(1);
        const org = (adm?.[0] as unknown as { organizations: { verification_status: string; type: string } | null } | undefined)?.organizations;
        if (!org || org.verification_status !== "verified" || org.type === "forge") return { error: "Finding builders is for admins of a verified company or school. They can register at /org." };
        let mq = db.from("milestones").select(`id, owner_id, community_id, community_name, title, reviewer_name, reviewed_at${f.verification ? ", reviewer_role" : ""}, projects(title, tags, tools)`).eq("status", "verified").order("reviewed_at", { ascending: false }).limit(1000);
        if (f.verification) mq = mq.eq("private", false);
        const { data: rows } = await mq;
        const verified = (rows ?? []) as unknown as VerifiedRow[];
        const ids = [...new Set(verified.map((r) => r.owner_id))];
        const { data: people } = ids.length ? await db.from("profiles").select(`id, first_name, last_name, headline, field${f.profileExtras ? ", open_to" : ""}`).in("id", ids) : { data: [] };
        const list = rankBuilders(buildBuilders(verified, (people ?? []) as unknown as Person[]), { q: clean(a.query, 120), openTo: clean(a.open_to, 20) });
        return list.slice(0, 8).map((b) => ({
          name: `${b.person.first_name} ${b.person.last_name}`.trim(), headline: snip(b.person.headline, 100), verified: b.verified,
          clubs: b.clubs.map((c) => c.name), skills: b.skills.slice(0, 8), open_to: b.person.open_to ?? [],
          latest: b.latest.slice(0, 2).map((r) => ({ title: r.title, verified_by: r.reviewer_name, club: r.community_name })),
          link: `/u/${b.person.id}`,
        }));
      }
      case "open_challenges": {
        if (!(await dbFeatures()).challenges) return { error: "Challenges aren't switched on yet." };
        const q = clean(a.query);
        let req = db.from("challenges").select("id, title, brief, prize, topic, deadline, organizations(name)").eq("status", "open").gt("deadline", new Date(requestTime()).toISOString()).order("deadline", { ascending: true }).limit(8);
        if (q) req = req.or(`title.ilike.*${q}*,brief.ilike.*${q}*,topic.ilike.*${q}*`);
        const { data, error } = await req;
        if (error) return { error: "Challenge search failed." };
        return ((data ?? []) as unknown as { id: string; title: string; brief: string; prize: string; topic: string; deadline: string; organizations: { name: string } | null }[])
          .map((c) => ({ title: c.title, sponsor: c.organizations?.name ?? "", prize: c.prize, topic: c.topic, deadline: c.deadline, brief: snip(c.brief, 240), link: `/challenges/${c.id}` }));
      }
      case "my_profile": {
        const f = await dbFeatures();
        const [me, clubs, projects, ms, guide, fromTools] = await Promise.all([
          db.from("profiles").select("first_name, last_name, headline, field, interests, bio").eq("id", userId).maybeSingle(),
          db.from("community_members").select("role, communities(id, name)").eq("uid", userId).limit(30),
          db.from("projects").select("id, title, status").eq("owner_id", userId).limit(20),
          f.milestones ? db.from("milestones").select("id, project_id, title, status, community_id, achieved_on").eq("owner_id", userId).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [] as MsRow[] }),
          loadGuide(),
          // Cards the member's AI tools left over MCP (supabase/tool-actions.sql), waiting for them.
          f.toolActions ? db.from("tool_drafts").select("id", { count: "exact", head: true }).eq("status", "waiting") : Promise.resolve({ count: 0 }),
        ]);
        type C = { id: string; name: string };
        const msRows = (ms.data ?? []) as MsRow[];
        return {
          name: `${me.data?.first_name ?? ""} ${me.data?.last_name ?? ""}`.trim(), headline: me.data?.headline, field: me.data?.field, interests: me.data?.interests, bio: snip(me.data?.bio, 300),
          clubs: ((clubs.data ?? []) as unknown as { role: string; communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []).map((c) => ({ id: c.id, name: c.name, role: r.role, link: `/c/${c.id}` }))),
          projects: (projects.data ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status, verified_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "verified").length, pending_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "pending").length })),
          // Still waiting for proof: propose_signature takes one of these ids to ask a person about it.
          open_milestones: openMilestones(msRows),
          steps_left: (guide?.member ?? []).filter((s) => !s.done).map((s) => ({ step: s.label, where: s.href })),
          waiting_from_your_tools: { count: fromTools.count ?? 0, where: "/drafts" },
        };
      }
      case "club_overview": {
        const id = clean(a.club_id, 64).replace(/\s/g, "");
        if (!id) return { error: "Which club? Pass its id from the link /c/<id>." };
        const { data: m } = await db.from("community_members").select("role").eq("community_id", id).eq("uid", userId).maybeSingle();
        if (!m) return { error: "The member isn't in that club, so Copilot can only describe it from search_clubs." };
        const f = await dbFeatures();
        const officer = rank(m.role) >= 3;
        const now = new Date(requestTime()).toISOString();
        const [c, recent, events, waiting, guide] = await Promise.all([
          db.from("communities").select("name, field, privacy, member_count, about, rules").eq("id", id).maybeSingle(),
          db.from("posts").select("id", { count: "exact", head: true }).eq("community_id", id).gt("created_at", new Date(requestTime() - 14 * 864e5).toISOString()),
          f.clubEvents ? db.from("events").select("id, title, starts_at").eq("community_id", id).gt("starts_at", now).order("starts_at").limit(5) : Promise.resolve({ data: [] as { id: string; title: string; starts_at: string }[] }),
          officer && f.milestones ? db.from("milestones").select("id", { count: "exact", head: true }).eq("community_id", id).eq("status", "pending") : Promise.resolve({ count: null }),
          officer ? loadGuide() : Promise.resolve(null),
        ]);
        return {
          name: c.data?.name, field: c.data?.field, members: c.data?.member_count, joining: c.data?.privacy === "public" ? "open" : "approval", your_role: m.role,
          about: snip(c.data?.about, 300), has_rules: !!c.data?.rules?.trim(), posts_last_14_days: recent.count ?? 0,
          upcoming_events: ((events.data ?? []) as { id: string; title: string; starts_at: string }[]).map((e) => ({ title: e.title, starts: e.starts_at.slice(0, 10), link: `/events/${e.id}` })),
          ...(officer ? {
            milestones_waiting_for_review: waiting.count ?? 0,
            review_link: `/c/${id}/manage?tab=verify`,
            setup_steps_left: (guide?.clubs.find((g) => g.id === id)?.steps ?? []).filter((s) => !s.done).map((s) => ({ step: s.label, where: s.href })),
          } : {}),
          link: `/c/${id}`,
        };
      }
      case "propose_post": {
        const body = typeof a.body === "string" ? a.body.trim().slice(0, 3000) : "";
        if (!body) return { error: "The post is empty." };
        const kind = (["update", "question", "result", "project"] as const).find((k) => k === a.kind) ?? "update";
        const tags = (Array.isArray(a.tags) ? a.tags : []).filter((t): t is string => typeof t === "string" && ALL_TOPICS.includes(t)).slice(0, 3);
        propose({ id: pid(), kind: "post", body, postKind: kind, tags });
        return SHOWN;
      }
      case "propose_milestone": {
        const projectId = String(a.project_id ?? ""), clubId = String(a.club_id ?? "");
        if (!ID_RE.test(projectId) || !ID_RE.test(clubId)) return { error: "Use the project and club ids from my_profile." };
        const [proj, mem] = await Promise.all([
          db.from("projects").select("title").eq("id", projectId).eq("owner_id", userId).maybeSingle(),
          db.from("community_members").select("communities(name)").eq("community_id", clubId).eq("uid", userId).maybeSingle(),
        ]);
        if (!proj.data) return { error: "That isn't one of the member's projects." };
        const club = (mem.data as unknown as { communities: { name: string } | null } | null)?.communities;
        if (!club) return { error: "The member isn't in that club, and only their clubs can verify their milestones." };
        const title = typeof a.title === "string" ? a.title.trim().slice(0, 120) : "";
        if (!title) return { error: "Say what happened." };
        const evidence = typeof a.evidence === "string" ? a.evidence.trim() : "";
        if (!/^https:\/\/\S{4,290}$/i.test(evidence)) return { error: "A milestone needs evidence: ask the member for an https link to a photo, video, file, commit or the club event. Don't make one up." };
        const day = typeof a.achieved_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.achieved_on) ? a.achieved_on : new Date(requestTime()).toISOString().slice(0, 10);
        propose({ id: pid(), kind: "milestone", project_id: projectId, project_title: proj.data.title, club_id: clubId, club_name: club.name, title, evidence, detail: typeof a.detail === "string" ? a.detail.trim().slice(0, 600) : "", achieved_on: day });
        return SHOWN;
      }
      case "my_record": {
        const since = typeof a.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.since) ? a.since : "";
        // The columns every proof is told from (signatures: vouches.sql; privacy: verification.sql; GitHub: backed.sql).
        let q = db.from("milestones").select("project_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, vouched_by, private, milestone_backings(repo_full_name, ref)").eq("owner_id", userId).order("achieved_on", { ascending: false }).limit(200);
        if (since) q = q.gte("achieved_on", since);
        const [ms, projects] = await Promise.all([q, db.from("projects").select("id, title").eq("owner_id", userId).limit(50)]);
        if (ms.error) return { error: "Reading the record failed. Say so, and don't guess what's on it." };
        type Backing = { repo_full_name?: string; ref?: string };
        type Row = { project_id: string; community_name?: string | null; title: string; detail?: string | null; evidence?: string | null; achieved_on?: string | null; status: string; reviewer_name?: string | null; vouched_by?: string | null; private?: boolean | null; milestone_backings?: Backing | Backing[] | null };
        const rows = (ms.data ?? []) as unknown as Row[];
        const titles = new Map(((projects.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
        const backing = (m: Row) => (Array.isArray(m.milestone_backings) ? m.milestone_backings[0] : m.milestone_backings) ?? null;
        // Who stood behind it, in the words the record itself uses.
        const proof = (m: Row) => {
          const b = backing(m);
          const by = m.vouched_by ? `signed by ${m.vouched_by}` : m.status === "verified" ? `verified by ${m.reviewer_name || "an officer"}${m.community_name ? ` of ${m.community_name}` : ""}` : "";
          const git = b?.repo_full_name ? `backed by GitHub (${b.repo_full_name}${b.ref ? `#${b.ref}` : ""})` : "";
          return [by, git].filter(Boolean).join("; ");
        };
        const proven = rows.filter((m) => m.status === "verified" || m.status === "logged");
        const byYear: Record<string, number> = {};
        for (const m of proven) { const y = (m.achieved_on ?? "").slice(0, 4); if (y) byYear[y] = (byYear[y] ?? 0) + 1; }
        return {
          proven: proven.slice(0, 40).map((m) => ({ title: m.title, detail: snip(m.detail, 220), date: m.achieved_on, project: titles.get(m.project_id) ?? "", proof: proof(m), evidence: m.evidence || undefined, shown_on_profile: m.private === false })),
          proven_total: proven.length, by_year: byYear,
          still_waiting: rows.filter((m) => m.status === "draft" || m.status === "pending").length,
          link: `/u/${userId}`,
          note: "Write only from these results. Name who signed or verified each one. shown_on_profile false means the member keeps that one private: fine to use for their own review, and say so if they plan to share it.",
        };
      }
      case "whats_new": {
        const { data, error } = await db.from("notifications").select("kind, actor_first, actor_last, community_name, snippet, created_at, read").eq("user_id", userId).order("created_at", { ascending: false }).limit(30);
        if (error) return { error: "Reading notifications failed." };
        const rows = (data ?? []) as { kind: string; actor_first: string | null; actor_last: string | null; community_name: string | null; snippet: string | null; created_at: string; read: boolean | null }[];
        const unread = rows.filter((n) => !n.read);
        return {
          unread: unread.length,
          items: (unread.length ? unread : rows).slice(0, 12).map((n) => ({ what: n.kind.replace(/_/g, " "), from: `${n.actor_first ?? ""} ${n.actor_last ?? ""}`.trim() || undefined, about: snip(n.snippet, 140) || undefined, club: n.community_name || undefined, when: n.created_at, unread: !n.read })),
          link: "/notifications",
        };
      }
      case "propose_memory": {
        const fact = typeof a.fact === "string" ? a.fact.trim().replace(/\s+/g, " ").slice(0, 200) : "";
        if (!fact) return { error: "Say what to remember, in one short sentence." };
        propose({ id: pid(), kind: "memory", body: fact });
        return SHOWN;
      }
      case "propose_goal": {
        const kind = String(a.kind ?? "");
        if (!isGoalKind(kind)) return { error: "Pick one of: internship, job, grad, research, competition, funding." };
        const target = typeof a.target === "string" ? a.target.trim().replace(/[<>]/g, "").slice(0, 80) : "";
        const why = typeof a.why === "string" ? a.why.trim().slice(0, 240) : "";
        propose({ id: pid(), kind: "goal", goal_kind: kind, target, title: goalTitle({ kind, target }), why });
        return SHOWN;
      }
      case "propose_project_edit": {
        const projectId = String(a.project_id ?? "");
        if (!ID_RE.test(projectId)) return { error: "Use a project id from the member details or my_profile." };
        const [{ data: p }, { data: d }] = await Promise.all([
          db.from("projects").select("title, summary").eq("id", projectId).eq("owner_id", userId).maybeSingle(),
          db.from("project_details").select("details, link").eq("project_id", projectId).maybeSingle(),
        ]);
        const proj = p as { title: string; summary: string | null } | null;
        if (!proj) return { error: "That isn't one of the member's projects, and only the owner can change one." };
        const now = d as { details?: string | null; link?: string | null } | null;
        const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
        const summary = text(a.summary, 600), details = text(a.details, 5000), link = text(a.link, 300);
        if (link !== undefined && !/^https:\/\/\S{4,290}$/i.test(link)) return { error: "The link has to be an https address." };
        if (summary === undefined && details === undefined && link === undefined) return { error: "Say what should change: the summary, the write-up or the link." };
        propose({ id: pid(), kind: "project_edit", project_id: projectId, project_title: proj.title, ...(summary !== undefined && { summary }), ...(details !== undefined && { details }), ...(link !== undefined && { link }), before: { summary: proj.summary ?? "", details: now?.details ?? "", link: now?.link ?? "", specs: [] } });
        return SHOWN;
      }
      case "propose_signature": {
        const relationship = SIGNERS.includes(String(a.relationship)) ? String(a.relationship) : "other";
        const given = typeof a.email === "string" ? a.email.trim().toLowerCase() : "";
        // An address that doesn't look like one is dropped, not guessed at: the member types it on the card.
        const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(given) && given.length <= 254 ? given : "";
        const milestoneId = String(a.milestone_id ?? "");
        if (milestoneId) {
          if (!ID_RE.test(milestoneId)) return { error: "Use a milestone id from my_profile's open_milestones." };
          const { data: m } = await db.from("milestones").select("id, project_id, title, detail, evidence, achieved_on, status").eq("id", milestoneId).eq("owner_id", userId).maybeSingle();
          const row = m as { id: string; project_id: string; title: string; detail: string | null; evidence: string | null; achieved_on: string | null; status: string } | null;
          if (!row?.id) return { error: "That isn't one of the member's milestones." };
          if (row.status !== "draft" && row.status !== "pending") return { error: "That milestone isn't waiting for proof, so nobody needs to be asked." };
          const { data: proj } = await db.from("projects").select("title").eq("id", row.project_id).maybeSingle();
          propose({ id: pid(), kind: "signature", milestone_id: row.id, project_id: row.project_id, project_title: (proj as { title?: string } | null)?.title ?? "your project", title: row.title, evidence: row.evidence ?? "", detail: row.detail ?? "", achieved_on: row.achieved_on ?? "", email, relationship });
          return SHOWN;
        }
        const projectId = String(a.project_id ?? "");
        if (!ID_RE.test(projectId)) return { error: "Use a project id from my_profile. If the member has no project yet, prepare one with propose_project first." };
        const { data: proj } = await db.from("projects").select("title").eq("id", projectId).eq("owner_id", userId).maybeSingle();
        if (!proj) return { error: "That isn't one of the member's projects." };
        const title = typeof a.title === "string" ? a.title.trim().slice(0, 120) : "";
        if (!title) return { error: "Say what happened." };
        const evidence = typeof a.evidence === "string" ? a.evidence.trim() : "";
        if (!/^https:\/\/\S{4,290}$/i.test(evidence)) return { error: "A milestone needs evidence: ask the member for an https link to a pull request, commit, doc, photo, video or file. Don't make one up." };
        const day = typeof a.achieved_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.achieved_on) ? a.achieved_on : new Date(requestTime()).toISOString().slice(0, 10);
        propose({ id: pid(), kind: "signature", milestone_id: "", project_id: projectId, project_title: (proj as { title: string }).title, title, evidence, detail: typeof a.detail === "string" ? a.detail.trim().slice(0, 600) : "", achieved_on: day, email, relationship });
        return SHOWN;
      }
      case "propose_join_club": {
        const clubId = String(a.club_id ?? "");
        if (!ID_RE.test(clubId)) return { error: "Use the club id from its link /c/<id>." };
        const [c, mem] = await Promise.all([
          db.from("communities").select("name, privacy").eq("id", clubId).maybeSingle(),
          db.from("community_members").select("role").eq("community_id", clubId).eq("uid", userId).maybeSingle(),
        ]);
        if (!c.data) return { error: "No club with that id." };
        if (mem.data) return { error: "The member is already in this club." };
        propose({ id: pid(), kind: "join", club_id: clubId, club_name: c.data.name, privacy: c.data.privacy === "approval" ? "approval" : "public" });
        return SHOWN;
      }
      case "propose_rsvp": {
        const eventId = String(a.event_id ?? "");
        if (!ID_RE.test(eventId)) return { error: "Use the event id from its link /events/<id>." };
        const [ev, mine] = await Promise.all([
          db.from("events").select("title, starts_at, format, location, rsvp_count, status").eq("id", eventId).maybeSingle(),
          db.from("event_rsvps").select("event_id").eq("event_id", eventId).eq("user_id", userId).maybeSingle(),
        ]);
        if (!ev.data || ev.data.status !== "published") return { error: "No upcoming event with that id." };
        if (Date.parse(ev.data.starts_at) < requestTime()) return { error: "That event has already started." };
        if (mine.data) return { error: "The member is already going." };
        propose({ id: pid(), kind: "rsvp", event_id: eventId, title: ev.data.title, starts_at: ev.data.starts_at, where: ev.data.format === "Online" ? "Online" : ev.data.location ?? "", going: ev.data.rsvp_count ?? 0 });
        return SHOWN;
      }
      case "propose_message": {
        const personId = String(a.person_id ?? "");
        const body = String(a.body ?? "").trim().slice(0, 2000);
        if (!/^[0-9a-f-]{36}$/i.test(personId) || personId === userId) return { error: "Use a person's id from their link /u/<id> (not the member's own)." };
        if (!body) return { error: "Write the message to propose." };
        const person = await db.from("profiles").select("first_name, last_name, headline").eq("id", personId).maybeSingle();
        if (!person.data) return { error: "No member with that id." };
        propose({ id: pid(), kind: "message", person_id: personId, name: `${person.data.first_name} ${person.data.last_name}`.trim(), headline: person.data.headline ?? "", body });
        return SHOWN;
      }
      case "propose_follow": {
        const personId = String(a.person_id ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(personId) || personId === userId) return { error: "Use a person's id from their link /u/<id> (not the member's own)." };
        const [person, already] = await Promise.all([
          db.from("profiles").select("first_name, last_name, headline").eq("id", personId).maybeSingle(),
          db.from("follows").select("target").eq("follower", userId).eq("target", personId).maybeSingle(),
        ]);
        if (!person.data) return { error: "No member with that id." };
        if (already.data) return { error: "The member already follows them." };
        propose({ id: pid(), kind: "follow", person_id: personId, name: `${person.data.first_name} ${person.data.last_name}`.trim(), headline: person.data.headline ?? "" });
        return SHOWN;
      }
      case "propose_event": {
        const clubId = String(a.club_id ?? "");
        if (!ID_RE.test(clubId)) return { error: "Use the club id from its link /c/<id>." };
        const [mem, c] = await Promise.all([
          db.from("community_members").select("role").eq("community_id", clubId).eq("uid", userId).maybeSingle(),
          db.from("communities").select("name, topics").eq("id", clubId).maybeSingle(),
        ]);
        if (!mem.data || !can(mem.data.role, "hostEvents")) return { error: "Only the club's admins and owner can host its events." };
        if (!(await dbFeatures()).clubEvents) return { error: "Club events aren't switched on yet." };
        const start = new Date(String(a.starts_at ?? ""));
        if (Number.isNaN(start.getTime()) || start.getTime() < requestTime()) return { error: "Give a start time in the future, ISO 8601 with an offset." };
        const endRaw = new Date(String(a.ends_at ?? ""));
        const end = Number.isNaN(endRaw.getTime()) || endRaw <= start ? new Date(start.getTime() + 2 * 3600e3) : endRaw;
        const topics = ((c.data?.topics ?? []) as string[]).filter((t) => ALL_TOPICS.includes(t));
        const topic = typeof a.topic === "string" && ALL_TOPICS.includes(a.topic) ? a.topic : topics[0] ?? "";
        propose({
          id: pid(), kind: "event", club_id: clubId, club_name: c.data?.name ?? "your club",
          title: typeof a.title === "string" ? a.title.trim().slice(0, 120) : "", description: typeof a.description === "string" ? a.description.trim().slice(0, 2000) : "",
          type: (EVENT_TYPES as readonly string[]).includes(String(a.type)) ? String(a.type) : "Workshop",
          format: (EVENT_FORMATS as readonly string[]).includes(String(a.format)) ? String(a.format) : "In person",
          location: typeof a.location === "string" ? a.location.trim().slice(0, 160) : "", topic, starts_at: start.toISOString(), ends_at: end.toISOString(),
        });
        return SHOWN;
      }
      case "club_report":
      case "verify_queue": {
        const clubId = String(a.club_id ?? "");
        if (!ID_RE.test(clubId)) return { error: "Use the club id from its link /c/<id>." };
        const { data: m } = await db.from("community_members").select("role").eq("community_id", clubId).eq("uid", userId).maybeSingle();
        if (!m || rank(m.role) < 3) return { error: "Only the club's moderators, admins and owner can see this." };
        if (name === "club_report") {
          const r = await loadClubReport(db, clubId);
          return r ? { ...r, report_link: `/c/${clubId}/manage?tab=report` } : { error: "No club with that id." };
        }
        if (!(await dbFeatures()).milestones) return { error: "Milestones aren't switched on yet." };
        const { data, error } = await db.from("milestones").select("id, owner_id, title, detail, evidence, achieved_on, created_at, project:projects(title), owner:profiles!milestones_owner_id_fkey(first_name, last_name)").eq("community_id", clubId).eq("status", "pending").order("created_at", { ascending: true }).limit(15);
        if (error) return { error: "Couldn't load the queue." };
        type Q = { id: string; owner_id: string; title: string; detail: string; evidence: string; achieved_on: string; created_at: string; project: { title: string } | null; owner: { first_name: string; last_name: string } | null };
        return ((data ?? []) as unknown as Q[]).map((q) => ({ milestone_id: q.id, member: q.owner ? `${q.owner.first_name} ${q.owner.last_name}`.trim() : "A member", is_you: q.owner_id === userId, project: q.project?.title, title: q.title, detail: snip(q.detail, 300), evidence: q.evidence || null, happened: q.achieved_on, waiting_days: Math.floor((requestTime() - Date.parse(q.created_at)) / 864e5) }));
      }
      case "propose_club_post": {
        const clubId = String(a.club_id ?? "");
        if (!ID_RE.test(clubId)) return { error: "Use the club id from its link /c/<id>." };
        const body = typeof a.body === "string" ? a.body.trim().slice(0, 3000) : "";
        if (!body) return { error: "The post is empty." };
        const { data: m } = await db.from("community_members").select("communities(name)").eq("community_id", clubId).eq("uid", userId).maybeSingle();
        const club = (m as unknown as { communities: { name: string } | null } | null)?.communities;
        if (!club) return { error: "The member isn't in that club, so they can't post there." };
        const kind = (["update", "question", "result", "project"] as const).find((k) => k === a.kind) ?? "update";
        propose({ id: pid(), kind: "club_post", club_id: clubId, club_name: club.name, body, postKind: kind });
        return SHOWN;
      }
      case "propose_review": {
        // Verification is a person checking evidence; Torch never prepares or makes that decision.
        if (true as boolean) return { error: "Torch doesn't verify milestones. Officers review each one in the club's Verify tab." };
        const id = String(a.milestone_id ?? "");
        if (!ID_RE.test(id)) return { error: "Use a milestone_id from verify_queue." };
        if (!(await dbFeatures()).milestones) return { error: "Milestones aren't switched on yet." };
        const { data: ms } = await db.from("milestones").select("id, owner_id, community_id, community_name, title, detail, evidence, status, owner:profiles!milestones_owner_id_fkey(first_name, last_name)").eq("id", id).maybeSingle();
        const q = ms as unknown as { owner_id: string; community_id: string; community_name: string; title: string; detail: string; evidence: string; status: string; owner: { first_name: string; last_name: string } | null } | null;
        if (!q) return { error: "No milestone with that id that the member can see." };
        if (q.status !== "pending") return { error: "That milestone has already been reviewed." };
        if (q.owner_id === userId) return { error: "Members can't review their own milestones." };
        const { data: m } = await db.from("community_members").select("role").eq("community_id", q.community_id).eq("uid", userId).maybeSingle();
        if (!m || rank(m.role) < 3) return { error: "Only the club's moderators, admins and owner can review milestones." };
        const verify = a.verify === true;
        const note = typeof a.note === "string" ? a.note.trim().slice(0, 300) : "";
        propose({ id: pid(), kind: "review", milestone_id: id, club_name: q.community_name, member: q.owner ? `${q.owner.first_name} ${q.owner.last_name}`.trim() : "A member", title: q.title, detail: q.detail, evidence: q.evidence, verify, note });
        return SHOWN;
      }
      case "my_courses": {
        if (!(await dbFeatures()).courses) return { error: "Courses aren't switched on yet." };
        const { data: classes } = await db.rpc("my_classes");
        const list = (classes ?? []) as { id: string; name: string; course: string; term: string; role: string }[];
        if (!list.length) return { classes: [], note: "The member isn't in any class on Brazework." };
        const teaching = list.filter((c) => rank(c.role) >= 3);
        const out: Record<string, unknown>[] = [];
        for (const c of teaching.slice(0, 8)) {
          const [asg, subs, grs] = await Promise.all([
            db.from("assignments").select("id, title, due_at, published, kind").eq("community_id", c.id).order("due_at", { ascending: true, nullsFirst: false }).limit(40),
            db.from("submissions").select("assignment_id").eq("community_id", c.id).limit(5000),
            db.from("grades").select("assignment_id, released").eq("community_id", c.id).limit(5000),
          ]);
          const n = (rows: { assignment_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.assignment_id === id).length;
          out.push({ class_id: c.id, name: c.name, term: c.term, role: "teaching", link: `/c/${c.id}/course`,
            assignments: ((asg.data ?? []) as { id: string; title: string; due_at: string | null; published: boolean; kind?: string }[]).map((a) => ({ assignment_id: a.id, title: a.title, kind: a.kind ?? "assignment", due: a.due_at, published: a.published, handed_in: n(subs.data as { assignment_id: string }[] | null, a.id), graded: n(grs.data as { assignment_id: string }[] | null, a.id) })) });
        }
        const { data: due } = await db.rpc("my_due", { p_days: 30 });
        for (const c of list.filter((x) => rank(x.role) < 3)) {
          out.push({ class_id: c.id, name: c.name, term: c.term, role: "student", link: `/c/${c.id}/course`,
            due: ((due ?? []) as { id: string; community_id: string; title: string; due_at: string | null; submitted_at: string | null; graded: boolean }[]).filter((d) => d.community_id === c.id).map((d) => ({ title: d.title, due: d.due_at, handed_in: !!d.submitted_at, graded: d.graded, link: `/c/${c.id}/course/a/${d.id}` })) });
        }
        return { classes: out };
      }
      case "course_roster": {
        const cid = String(a.class_id ?? "");
        if (!ID_RE.test(cid)) return { error: "Use a class_id from my_courses." };
        const { data: st, error } = await db.rpc("course_students", { p_cid: cid });
        if (error) return { error: "Only the class's professor or teaching assistants can see its roster." };
        const students = ((st ?? []) as { uid: string; first_name: string; last_name: string }[]).map((x) => ({ person_id: x.uid, name: `${x.first_name} ${x.last_name}`.trim() }));
        const aid = String(a.assignment_id ?? "");
        if (!aid) return { students };
        if (!ID_RE.test(aid)) return { error: "Use an assignment_id from my_courses." };
        const [as_, subs] = await Promise.all([
          db.from("assignments").select("title, due_at").eq("id", aid).eq("community_id", cid).maybeSingle(),
          db.from("submissions").select("uid, project_id, submitted_at").eq("assignment_id", aid).limit(2000),
        ]);
        const asg = as_.data as { title: string; due_at: string | null } | null;
        if (!asg) return { error: "No assignment with that id in this class." };
        const by = new Map(((subs.data ?? []) as { uid: string; submitted_at: string }[]).map((x) => [x.uid, x.submitted_at]));
        return { assignment: asg.title, due: asg.due_at, students: students.map((x) => ({ ...x, handed_in: by.get(x.person_id) ?? null, late: !!(by.get(x.person_id) && asg.due_at && by.get(x.person_id)! > asg.due_at) })) };
      }
      case "propose_quiz": case "propose_assignment": case "propose_announcement": case "propose_attendance": {
        const cid = String(a.class_id ?? "");
        if (!ID_RE.test(cid)) return { error: "Use a class_id from my_courses." };
        const [{ data: c }, { data: m }] = await Promise.all([
          db.from("communities").select("name, type").eq("id", cid).maybeSingle(),
          db.from("community_members").select("role").eq("community_id", cid).eq("uid", userId).maybeSingle(),
        ]);
        const klass = c as { name: string; type: string } | null;
        if (!klass || klass.type !== "class") return { error: "That isn't a class." };
        if (!m || rank((m as { role: string }).role) < 3) return { error: "Only the class's professor or teaching assistants can do that. Students can ask Torch what's due." };
        const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
        const when = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : "");
        if (name === "propose_announcement") {
          const title = text(a.title, 160), body = text(a.body, 10000);
          if (!title || !body) return { error: "An announcement needs a title and a message." };
          onProposal({ id: pid(), kind: "announcement", class_id: cid, class_name: klass.name, title, body });
          return SHOWN;
        }
        if (name === "propose_attendance") {
          const minutes = Math.min(60, Math.max(5, Math.round(Number(a.minutes) || 15)));
          onProposal({ id: pid(), kind: "attendance", class_id: cid, class_name: klass.name, title: text(a.title, 120), minutes });
          return SHOWN;
        }
        const title = text(a.title, 160);
        if (!title) return { error: "Give it a title." };
        if (name === "propose_quiz") {
          const raw = Array.isArray(a.questions) ? a.questions : [];
          if (!raw.length || raw.length > 60) return { error: "A quiz has 1 to 60 questions." };
          const questions: TorchQuestion[] = [];
          for (const [i, q] of raw.entries()) {
            const o = q as Record<string, unknown>;
            const type = (["choice", "multi", "number", "short"] as const).find((t) => t === o.type);
            const prompt = text(o.prompt, 2000), points = Number(o.points);
            if (!type || !prompt || !(points > 0 && points <= 1000)) return { error: `Question ${i + 1} needs words, a type and some points.` };
            const options = Array.isArray(o.options) ? o.options.map((x) => text(x, 300)).filter(Boolean).slice(0, 10) : [];
            const base = { id: `q${i + 1}`, prompt, type, points };
            if (type === "choice") {
              const ans = Number(o.answer);
              if (options.length < 2 || !Number.isInteger(ans) || ans < 0 || ans >= options.length) return { error: `Question ${i + 1}: give 2 to 10 options and the index of the right one.` };
              questions.push({ ...base, options, answer: ans });
            } else if (type === "multi") {
              const ans = (Array.isArray(o.answer) ? o.answer : []).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x < options.length);
              if (options.length < 2 || !ans.length) return { error: `Question ${i + 1}: give 2 to 10 options and the indexes of the right ones.` };
              questions.push({ ...base, options, answer: [...new Set(ans)] });
            } else if (type === "number") {
              const ans = Number(o.answer);
              if (!Number.isFinite(ans)) return { error: `Question ${i + 1}: give the right number.` };
              questions.push({ ...base, answer: ans, tolerance: Math.abs(Number(o.tolerance) || 0) });
            } else questions.push(base);
          }
          onProposal({ id: pid(), kind: "quiz", class_id: cid, class_name: klass.name, title, instructions: text(a.instructions, 20000), closes_at: when(a.closes_at), questions, show_score: a.show_score !== false, publish: a.publish === true });
          return SHOWN;
        }
        const rubric: TorchRubricRow[] = (Array.isArray(a.rubric) ? a.rubric : []).slice(0, 20).map((r) => r as Record<string, unknown>)
          .map((r) => ({ criterion: text(r.criterion, 200), points: Math.max(0, Number(r.points) || 0), ...(/^[1-7]$/.test(String(r.outcome ?? "")) ? { outcome: String(r.outcome) } : {}) }))
          .filter((r) => r.criterion);
        const submit_as = (Array.isArray(a.submit_as) ? a.submit_as : ["file", "link"]).filter((k): k is string => ["file", "link", "text", "milestone"].includes(String(k)));
        const points = rubric.length ? rubric.reduce((t, r) => t + r.points, 0) : Math.max(0, Math.min(10000, Number(a.points) || 100));
        const group = a.group_work === true;
        onProposal({ id: pid(), kind: "assignment", class_id: cid, class_name: klass.name, title, instructions: text(a.instructions, 20000), due_at: when(a.due_at), points, rubric, submit_as: submit_as.length ? submit_as : ["file", "link"], group_work: group, peer_eval: group && a.peer_eval === true, publish: a.publish === true });
        return SHOWN;
      }
      case "propose_extension": {
        const aid = String(a.assignment_id ?? ""), who = String(a.person_id ?? "");
        if (!ID_RE.test(aid) || !/^[0-9a-f-]{36}$/i.test(who)) return { error: "Use an assignment_id from my_courses and a person_id from course_roster." };
        if (typeof a.due_at !== "string" || Number.isNaN(Date.parse(a.due_at))) return { error: "Give the new due date as ISO 8601 with a timezone offset." };
        const { data: asg } = await db.from("assignments").select("title, community_id").eq("id", aid).maybeSingle();
        const row = asg as { title: string; community_id: string } | null;
        if (!row) return { error: "No assignment with that id that the member can see." };
        const { data: st, error } = await db.rpc("course_students", { p_cid: row.community_id });
        if (error) return { error: "Only the class's professor or teaching assistants give extensions." };
        const s = ((st ?? []) as { uid: string; first_name: string; last_name: string }[]).find((x) => x.uid === who);
        if (!s) return { error: "That person isn't a student in this class." };
        onProposal({ id: pid(), kind: "extension", class_id: row.community_id, assignment_id: aid, assignment_title: row.title, person_id: who, name: `${s.first_name} ${s.last_name}`.trim(), due_at: new Date(a.due_at).toISOString() });
        return SHOWN;
      }
      case "github_repo": {
        const r = parseRepo(String(a.repo ?? ""));
        if (!r) return { error: "Give a repository as owner/repo or a github.com link." };
        try {
          const repo = await fetchRepo(r.owner, r.repo);
          return { ...repo, readme: repo.readme.slice(0, 2000), suggested_topics: matchTopics([...repo.topics, ...repo.languages]) };
        } catch (e) { return { error: e instanceof GitHubError ? e.message : "GitHub lookup failed." }; }
      }
      case "github_user": {
        const u = parseUser(String(a.username ?? ""));
        if (!u) return { error: "Give a GitHub username." };
        try { return await fetchUser(u); } catch (e) { return { error: e instanceof GitHubError ? e.message : "GitHub lookup failed." }; }
      }
      case "propose_project": {
        const title = typeof a.title === "string" ? a.title.trim().slice(0, 120) : "";
        const summary = typeof a.summary === "string" ? a.summary.trim().slice(0, 600) : "";
        if (!title || !summary) return { error: "A project needs a title and a summary." };
        const link = typeof a.link === "string" && /^https?:\/\/\S+$/i.test(a.link.trim()) ? a.link.trim().slice(0, 300) : "";
        const status = a.status === "completed" ? "completed" : "in_progress";
        const year = status === "completed" && typeof a.year === "string" && /^\d{4}$/.test(a.year) ? a.year : "";
        const tags = (Array.isArray(a.tags) ? a.tags : []).filter((t): t is string => typeof t === "string" && ALL_TOPICS.includes(t)).slice(0, 3);
        propose({ id: pid(), kind: "project", title, summary, details: typeof a.details === "string" ? a.details.trim().slice(0, 5000) : "", link, tags, status, year, source: link.includes("github.com") ? "GitHub" : "" });
        return SHOWN;
      }
      case "offer_choices": {
        const c = cleanOptions(a.options);
        if ("error" in c) return c;
        onChoice({ id: pid(), options: c.options });
        return { shown_to_member: true, note: "The member sees these as buttons and may tap one or type an answer. Your message ends here." };
      }
      default:
        return { error: `Unknown tool ${name}.` };
    }
  };
}
