import type Anthropic from "@anthropic-ai/sdk";
import { rank } from "@/lib/communities";
import { dbFeatures } from "@/lib/db-features";
import { requestTime } from "@/lib/forge";
import { loadGuide } from "@/lib/guide";
import type { createClient } from "@/lib/supabase/server";

// Copilot's read-only tools. They run with the member's own Supabase session, so row-level
// security decides what they can see: Copilot never sees more than the member could.
// Nothing here writes.

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
];

// Keywords go into PostgREST filters, so keep only characters that can't change the filter's meaning.
const clean = (v: unknown, max = 60) => (typeof v === "string" ? v.replace(/[^\p{L}\p{N} '&.+#-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const snip = (s: string | null | undefined, n = 140) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export function makeExec(db: DB, userId: string) {
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
          clubs: ((clubs.data ?? []) as unknown as { role: string; communities: C | C[] | null }[]).flatMap((r) => (Array.isArray(r.communities) ? r.communities : r.communities ? [r.communities] : []).map((c) => ({ name: c.name, role: r.role, link: `/c/${c.id}` }))),
          projects: (projects.data ?? []).map((p) => ({ title: p.title, status: p.status, verified_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "verified").length, pending_milestones: msRows.filter((m) => m.project_id === p.id && m.status === "pending").length })),
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
      default:
        return { error: `Unknown tool ${name}.` };
    }
  };
}
