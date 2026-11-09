import type Anthropic from "@anthropic-ai/sdk";
import { can, rank } from "@/lib/communities";
import { EVENT_FORMATS, EVENT_TYPES } from "@/lib/events";
import type { Proposal } from "@/lib/copilot-agent";
import { dbFeatures } from "@/lib/db-features";
import { ALL_TOPICS, requestTime } from "@/lib/forge";
import { loadClubReport } from "@/lib/club-report";
import { GitHubError, fetchRepo, fetchUser, matchTopics, parseRepo, parseUser } from "@/lib/connectors/github";
import { loadGuide } from "@/lib/guide";
import type { createClient } from "@/lib/supabase/server";

// Copilot's tools. They run with the member's own Supabase session, so row-level security decides
// what they can see: Copilot never sees more than the member could. Nothing here writes. The
// propose_* tools only check a draft and hand it to the UI as a card; the member confirms it there,
// and the app's normal server action (with its own checks) does the saving.

type DB = Awaited<ReturnType<typeof createClient>>;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_clubs",
    description: "Search clubs (communities) on Forge by keyword and/or field. Returns up to 8, biggest first, each with its link path.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "Keywords, e.g. 'rocketry' or 'formula'" }, field: { type: "string", description: "A field, e.g. 'Mechanical Engineering'" } } },
  },
  {
    name: "upcoming_events",
    description: "Published events on Forge in the next N days (default 30), soonest first, optionally matching keywords. Each has its link path.",
    input_schema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 90 }, query: { type: "string" } } },
  },
  {
    name: "find_people",
    description: "Find Forge members by keyword (name or headline) and/or field or interest. Returns up to 8, each with a profile link path.",
    input_schema: { type: "object", properties: { query: { type: "string" }, field: { type: "string" }, interest: { type: "string" } } },
  },
  {
    name: "my_profile",
    description: "The member's own profile: headline, field, interests, clubs and roles, projects with milestone counts, and the guide steps they haven't done yet.",
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
    name: "propose_milestone",
    description: "Prepare a milestone on one of the member's projects for one of their clubs to verify. Get project and club ids from my_profile. It is NOT sent until they confirm.",
    input_schema: { type: "object", properties: { project_id: { type: "string" }, club_id: { type: "string" }, title: { type: "string", description: "What happened, at most 120 characters" }, detail: { type: "string", description: "Numbers and conditions, at most 600 characters" }, achieved_on: { type: "string", description: "YYYY-MM-DD" } }, required: ["project_id", "club_id", "title"] },
  },
  {
    name: "propose_join_club",
    description: "Prepare joining a club (its id is in its link /c/<id>). It is NOT joined until the member confirms.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
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
    description: "Milestones members asked the club to verify, oldest first, with their details and evidence links (for the club's moderators and up). Use with propose_review.",
    input_schema: { type: "object", properties: { club_id: { type: "string" } }, required: ["club_id"] },
  },
  {
    name: "propose_club_post",
    description: "Prepare a post in one of the member's clubs (for example the weekly update, an announcement or a welcome). It is NOT posted until they confirm.",
    input_schema: { type: "object", properties: { club_id: { type: "string" }, body: { type: "string", description: "At most 3000 characters" }, kind: { type: "string", enum: ["update", "question", "result", "project"] } }, required: ["club_id", "body"] },
  },
  {
    name: "propose_review",
    description: "Prepare a verify-or-decline decision on a pending milestone from verify_queue, with a short note for the member (required when declining). The officer confirms or changes it; nothing is decided until then. Only recommend verifying when the details or evidence support it.",
    input_schema: { type: "object", properties: { milestone_id: { type: "string" }, verify: { type: "boolean" }, note: { type: "string", description: "At most 300 characters" } }, required: ["milestone_id", "verify"] },
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
    description: "Prepare a new project on the member's Forge profile, usually from github_repo. title <= 120 chars, summary <= 600, details (the write-up) <= 5000, link to the repo or demo, up to 3 tags. It is NOT added until they confirm.",
    input_schema: { type: "object", properties: { title: { type: "string" }, summary: { type: "string" }, details: { type: "string" }, link: { type: "string" }, tags: { type: "array", items: { type: "string" } }, status: { type: "string", enum: ["in_progress", "completed"] }, year: { type: "string" } }, required: ["title", "summary"] },
  },
];

// What Copilot hears back after a proposal: it's on screen, and the member decides.
const SHOWN = { shown_to_member: true, note: "The member sees this as a card and will confirm, edit or dismiss it. Don't say it's done; tell them to check the card." };
const pid = () => Math.random().toString(36).slice(2, 10);
const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

// Keywords go into PostgREST filters, so keep only characters that can't change the filter's meaning.
const clean = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '&.+#-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const snip = (s: string | null | undefined, n = 140) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function makeExec(db: DB, userId: string, onProposal: (p: Proposal) => void = () => {}) {
  return async (name: string, input: unknown): Promise<unknown> => {
    const a = (input ?? {}) as Record<string, unknown>;
    switch (name) {
      case "search_clubs": {
        const q = clean(a.query), field = clean(a.field);
        let req = db.from("communities").select("id, name, field, type, privacy, member_count, about, topics").order("member_count", { ascending: false }).limit(8);
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
      case "my_profile": {
        const f = await dbFeatures();
        const [me, clubs, projects, ms, guide] = await Promise.all([
          db.from("profiles").select("first_name, last_name, headline, field, interests, bio").eq("id", userId).maybeSingle(),
          db.from("community_members").select("role, communities(id, name)").eq("uid", userId).limit(30),
          db.from("projects").select("id, title, status").eq("owner_id", userId).limit(20),
          f.milestones ? db.from("milestones").select("project_id, status").eq("owner_id", userId).limit(300) : Promise.resolve({ data: [] as { project_id: string; status: string }[] }),
          loadGuide(),
        ]);
        type C = { id: string; name: string };
        const msRows = (ms.data ?? []) as { project_id: string; status: string }[];
        return {
          name: `${me.data?.first_name ?? ""} ${me.data?.last_name ?? ""}`.trim(), headline: me.data?.headline, field: me.data?.field, interests: me.data?.interests, bio: snip(me.data?.bio, 300),
          clubs: ((clubs.data ?? []) as unknown as { role: string; communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []).map((c) => ({ id: c.id, name: c.name, role: r.role, link: `/c/${c.id}` }))),
          projects: (projects.data ?? []).map((p) => ({ id: p.id, title: p.title, status: p.status, verified_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "verified").length, pending_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "pending").length })),
          steps_left: (guide?.member ?? []).filter((s) => !s.done).map((s) => ({ step: s.label, where: s.href })),
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
        onProposal({ id: pid(), kind: "post", body, postKind: kind, tags });
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
        const day = typeof a.achieved_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(a.achieved_on) ? a.achieved_on : new Date(requestTime()).toISOString().slice(0, 10);
        onProposal({ id: pid(), kind: "milestone", project_id: projectId, project_title: proj.data.title, club_id: clubId, club_name: club.name, title, detail: typeof a.detail === "string" ? a.detail.trim().slice(0, 600) : "", achieved_on: day });
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
        onProposal({ id: pid(), kind: "join", club_id: clubId, club_name: c.data.name, privacy: c.data.privacy === "approval" ? "approval" : "public" });
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
        onProposal({ id: pid(), kind: "follow", person_id: personId, name: `${person.data.first_name} ${person.data.last_name}`.trim(), headline: person.data.headline ?? "" });
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
        onProposal({
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
        onProposal({ id: pid(), kind: "club_post", club_id: clubId, club_name: club.name, body, postKind: kind });
        return SHOWN;
      }
      case "propose_review": {
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
        onProposal({ id: pid(), kind: "review", milestone_id: id, club_name: q.community_name, member: q.owner ? `${q.owner.first_name} ${q.owner.last_name}`.trim() : "A member", title: q.title, detail: q.detail, evidence: q.evidence, verify, note });
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
        onProposal({ id: pid(), kind: "project", title, summary, details: typeof a.details === "string" ? a.details.trim().slice(0, 5000) : "", link, tags, status, year, source: link.includes("github.com") ? "GitHub" : "" });
        return SHOWN;
      }
      default:
        return { error: `Unknown tool ${name}.` };
    }
  };
}
