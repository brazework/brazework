import { cache } from "react";
import { EVENT_COLS, EVENT_COLS_BASE, EVENT_WITH_HOST, EVENT_WITH_HOST_BASE } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";

// Which optional database updates this Supabase project has had: supabase/club-events.sql,
// supabase/media.sql, supabase/invites.sql, supabase/copilot.sql, supabase/milestones.sql, supabase/integrations.sql, supabase/group-chats.sql, supabase/project-stack.sql, supabase/club-profile.sql, supabase/mentions.sql, supabase/copilot-chats.sql, supabase/profile-extras.sql, supabase/mcp.sql and supabase/chat-extras.sql. The app runs on the same database before and after each one is applied, so
// pages ask for the new columns only when they exist, instead of failing. Probed once per request.
// 42703/PGRST204: no such column; 42P01/PGRST205: no such table; PGRST200: no such relationship;
// 42883/PGRST202: no such function.
const missing = (e: { code?: string } | null) => ["42703", "42P01", "42883", "PGRST200", "PGRST202", "PGRST204", "PGRST205"].includes(e?.code ?? "");

// Remembered across requests too: a feature that exists stays on (SQL files only add things), and a
// missing one is asked about again after a minute, so applying a file turns it on without a deploy.
type Features = Awaited<ReturnType<typeof probe>>;
let known: { at: number; f: Features } | null = null;
const RECHECK_MS = 60_000;

export const dbFeatures = cache(async (): Promise<Features> => {
  const allOn = known && Object.values(known.f).every(Boolean);
  if (known && (allOn || Date.now() - known.at < RECHECK_MS)) return known.f;
  const f = await probe();
  // Never forget a feature we've seen (a failed probe mid-outage shouldn't switch it off).
  const merged = known ? (Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || known!.f[k as keyof Features]])) as Features) : f;
  known = { at: Date.now(), f: merged };
  return merged;
});

async function probe() {
  const supabase = await createClient();
  const [ev, po, inv, cop, ms, intg, gc, st, cp, mn, cc, px, mcp, cx, pp, vf, ho, chl, spc, gy, clm, vc, wl] = await Promise.all([
    supabase.from("events").select("community_id").limit(1),
    supabase.from("posts").select("media").limit(1),
    supabase.from("community_invites").select("code").limit(1),
    supabase.rpc("copilot_ready"),
    supabase.from("milestones").select("id").limit(1),
    supabase.from("club_integrations").select("community_id").limit(1),
    supabase.from("chats").select("id").limit(1),
    supabase.from("projects").select("tools").limit(1),
    supabase.from("communities").select("logo_path").limit(1),
    supabase.from("posts").select("mentions").limit(1),
    supabase.from("copilot_chats").select("id").limit(1),
    supabase.from("profiles").select("open_to").limit(1),
    supabase.from("api_tokens").select("id").limit(1),
    supabase.from("message_reactions").select("emoji").limit(1),
    supabase.rpc("project_posts_ready"),
    supabase.from("verification_events").select("id").limit(1),
    supabase.from("club_handoffs").select("id").limit(1),
    supabase.rpc("challenges_ready"),
    supabase.from("project_details").select("specs").limit(1),
    supabase.from("profiles").select("grad_year").limit(1),
    supabase.from("club_claims").select("id").limit(1),
    supabase.rpc("video_captions_ready"),
    supabase.rpc("weekly_loop_ready"),
  ]);
  return { clubEvents: !missing(ev.error), media: !missing(po.error), invites: !missing(inv.error), copilot: !missing(cop.error), milestones: !missing(ms.error), integrations: !missing(intg.error), groupChats: !missing(gc.error), projectTools: !missing(st.error), clubProfile: !missing(cp.error), mentions: !missing(mn.error), copilotChats: !missing(cc.error), profileExtras: !missing(px.error), mcp: !missing(mcp.error), chatExtras: !missing(cx.error), projectPosts: !missing(pp.error), verification: !missing(vf.error), handoff: !missing(ho.error), challenges: !missing(chl.error), projectSpecs: !missing(spc.error), gradYear: !missing(gy.error), clubClaims: !missing(clm.error), videoCaptions: !missing(vc.error), weeklyLoop: !missing(wl.error) };
}

export async function eventCols(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_COLS : EVENT_COLS_BASE;
}

export async function eventWithHost(): Promise<string> {
  return (await dbFeatures()).clubEvents ? EVENT_WITH_HOST : EVENT_WITH_HOST_BASE;
}

// Posts: every column ("*" includes media once media.sql has run), plus the author's photo then.
export async function postSelect(): Promise<string> {
  return (await dbFeatures()).media ? "*, author:profiles!posts_author_id_fkey(avatar_path)" : "*";
}

// Milestone columns for timelines: with the verification badge details once verification.sql has run.
export async function milestoneCols(): Promise<string> {
  const base = "id, project_id, community_id, community_name, title, detail, evidence, achieved_on, status, reviewer_name, review_note";
  return (await dbFeatures()).verification ? `${base}, private, revoked_reason, reviewer_role, reviewed_at, escalated` : base;
}
