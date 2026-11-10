// Events and the organizations that host them. Ported from public/js/events.js.
// The database decides who sees what (supabase/events.sql): members see published events until
// 24 hours after they end, and a hosting organization's admins always see their own, which is its
// past-events log. Safe to import from server and client code.

export const EVENT_TYPES = ["Career fair", "Networking", "Workshop", "Talk", "Hackathon", "Conference"] as const;
export const EVENT_FORMATS = ["Online", "In person", "Hybrid"] as const;
export const ORG_SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,001–5,000", "5,000+"] as const;
export const INDUSTRIES = [
  "Aerospace & Defense", "Automotive & Mobility", "Biotech & Pharma", "Chemicals & Materials", "Clean Energy",
  "Construction & Infrastructure", "Consumer Electronics", "Manufacturing", "Medical Devices", "Robotics & Automation",
  "Semiconductors", "Software & AI", "Telecommunications", "Research & Consulting",
] as const;
// Same list create_organization() rejects, so the form can say so before anyone types.
export const PERSONAL_MAIL = [
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com",
];
export const DROP_AFTER_MS = 24 * 3600000;
export const DAY_MS = 86400000;

export type EventType = (typeof EVENT_TYPES)[number];
export type EventFormat = (typeof EVENT_FORMATS)[number];
export type OrgType = "company" | "school" | "forge";
export type HostType = OrgType | "community";

export type ForgeEvent = {
  id: string;
  org_id: string | null;
  community_id: string | null;
  title: string;
  description: string;
  type: EventType;
  format: EventFormat;
  location: string;
  link: string;
  topic: string;
  starts_at: string;
  ends_at: string;
  status: "published" | "cancelled";
  rsvp_count: number;
  created_at: string;
};
export type HostedEvent = ForgeEvent & { host: string; host_type: HostType | "" };

export type Organization = {
  id: string;
  type: OrgType;
  name: string;
  domain: string | null;
  location: string;
  size: string;
  industries: string[];
  verification_status: "verified" | "suspended";
  created_at: string;
};

export const EVENT_COLS = "id, org_id, community_id, title, description, type, format, location, link, topic, starts_at, ends_at, status, rsvp_count, created_at";
export const EVENT_COLS_BASE = "id, org_id, title, description, type, format, location, link, topic, starts_at, ends_at, status, rsvp_count, created_at";
export const EVENT_WITH_HOST = `${EVENT_COLS}, organizations(name, type), communities(name)`;
// Before supabase/club-events.sql runs, events have no community_id (see lib/db-features.ts).
export const EVENT_WITH_HOST_BASE = `${EVENT_COLS_BASE}, organizations(name, type)`;

type One<T> = T | T[] | null;
type WithOrg = ForgeEvent & { organizations?: One<{ name: string; type: OrgType }>; communities?: One<{ name: string }> };
const first = <T,>(v: One<T> | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

// The host shown on an event: its verified organization, or the club (community) running it.
export function withHost(r: WithOrg): HostedEvent {
  const { organizations, communities, ...rest } = r;
  const o = first(organizations);
  const c = first(communities);
  return o ? { ...rest, host: o.name, host_type: o.type } : { ...rest, host: c?.name ?? "", host_type: c ? "community" : "" };
}

export const ORG_LABEL: Record<HostType, string> = { company: "Verified company", school: "Verified school", forge: "Forge", community: "Club event" };

export const isOver = (e: Pick<ForgeEvent, "ends_at">, now: number) => Date.parse(e.ends_at) <= now;
// Past or cancelled events go in the host's log; the rest are still coming up.
export const inLog = (e: ForgeEvent, now: number) => isOver(e, now) || e.status === "cancelled";

// How soon an event is, in words, from exact moments (so it's the same in every time zone):
// "Happening now", "Starts in 40m", "Starts in 3h", "Tomorrow", "In 5 days"; nothing further out.
export function whenBadge(e: Pick<ForgeEvent, "starts_at" | "ends_at">, now: number) {
  const start = Date.parse(e.starts_at), end = Date.parse(e.ends_at);
  if (now >= start && now < end) return { text: "Happening now", live: true };
  const mins = Math.round((start - now) / 60000);
  if (mins <= 0) return null;
  if (mins < 60) return { text: `Starts in ${mins}m`, live: false };
  if (mins < 24 * 60) return { text: `Starts in ${Math.round(mins / 60)}h`, live: false };
  if (mins < 48 * 60) return { text: "Tomorrow", live: false };
  if (mins < 7 * 24 * 60) return { text: `In ${Math.round(mins / (24 * 60))} days`, live: false };
  return null;
}

// Which section of the Events list an event falls in.
export function timeBucket(e: Pick<ForgeEvent, "starts_at" | "ends_at">, now: number): "now" | "soon" | "week" | "later" {
  const start = Date.parse(e.starts_at), end = Date.parse(e.ends_at);
  if (now >= start && now < end) return "now";
  if (start - now < 48 * 3600000) return "soon";
  if (start - now < 7 * 24 * 3600000) return "week";
  return "later";
}

// ---------- Dates ----------
// Every formatter takes an optional IANA time zone. Undefined = the viewer's own zone (in the browser);
// the server and the first (hydration) render pass "UTC" so their HTML matches. See events/local-time.tsx.

const fmt = (ts: string | number, tz: string | undefined, o: Intl.DateTimeFormatOptions) =>
  new Date(ts).toLocaleString("en-US", { ...o, timeZone: tz });

export const dateParts = (ts: string, tz?: string) => ({
  dow: fmt(ts, tz, { weekday: "short" }),
  day: fmt(ts, tz, { day: "numeric" }),
  mon: fmt(ts, tz, { month: "short" }),
});
export const monthLabel = (ts: string, tz?: string) => fmt(ts, tz, { month: "long", year: "numeric" });
export const clock = (ts: string | number, tz?: string) => fmt(ts, tz, { hour: "numeric", minute: "2-digit" });
export const fullDate = (ts: string | number, tz?: string) => fmt(ts, tz, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const dayKey = (ts: string | number, tz?: string) => fmt(ts, tz, { year: "numeric", month: "2-digit", day: "2-digit" });
export const monthKey = (ts: string | number, tz?: string) => fmt(ts, tz, { year: "numeric", month: "2-digit" });

export function timeRange(e: Pick<ForgeEvent, "starts_at" | "ends_at">, tz?: string) {
  const sameDay = dayKey(e.starts_at, tz) === dayKey(e.ends_at, tz);
  if (sameDay) return `${clock(e.starts_at, tz)} – ${clock(e.ends_at, tz)}`;
  // Overnight (a launch, a hackathon night): just the weekday it ends on.
  if (Date.parse(e.ends_at) - Date.parse(e.starts_at) < DAY_MS) return `${clock(e.starts_at, tz)} – ${fmt(e.ends_at, tz, { weekday: "short" })} ${clock(e.ends_at, tz)}`;
  return `${clock(e.starts_at, tz)} – ${fullDate(e.ends_at, tz)}, ${clock(e.ends_at, tz)}`;
}

export const whereLabel = (e: Pick<ForgeEvent, "format" | "location">) =>
  e.format === "Online" ? "Online"
  : e.format === "Hybrid" ? `${e.location || "Location to be announced"} + online`
  : e.location || "Location to be announced";

// The browser's date picker works in local time; the database stores an exact moment.
export function toLocalInput(ts: string, tz?: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ts)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// ---------- "Add to calendar" ----------
// A standard calendar file that opens in Google, Apple or Outlook calendars. Same output as the vanilla app.

export function calendarFile(e: Pick<ForgeEvent, "id" | "title" | "description" | "link" | "starts_at" | "ends_at" | "format" | "location">, now: number) {
  const stamp = (ts: string | number) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (v: string) => String(v || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const details = [e.description, e.link].filter(Boolean).join("\n\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Forge//Events//EN", "BEGIN:VEVENT",
    `UID:${e.id}@forge`, `DTSTAMP:${stamp(now)}`, `DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(e.ends_at)}`,
    `SUMMARY:${text(e.title)}`, `DESCRIPTION:${text(details)}`, `LOCATION:${text(whereLabel(e))}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export const calendarFileName = (title: string) => `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50) || "event"}.ics`;
