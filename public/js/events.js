// Events and the organizations that host them.
// The database decides who sees what: members see published events until 24 hours after they end,
// and a hosting organization's admins always see their own, which is its past-events log.
import { sb, run, row, many, changed } from "./supabase.js";
import { ms, toast } from "./util.js";

export const TYPES = ["Career fair", "Networking", "Workshop", "Talk", "Hackathon", "Conference"];
export const FORMATS = ["Online", "In person", "Hybrid"];
export const SIZES = ["1–10", "11–50", "51–200", "201–1,000", "1,001–5,000", "5,000+"];
export const INDUSTRIES = ["Aerospace & Defense", "Automotive & Mobility", "Biotech & Pharma", "Chemicals & Materials", "Clean Energy", "Construction & Infrastructure", "Consumer Electronics", "Manufacturing", "Medical Devices", "Robotics & Automation", "Semiconductors", "Software & AI", "Telecommunications", "Research & Consulting"];
export const DROP_AFTER_MS = 24 * 3600000;

const withHost = r => { const { organizations: o, ...rest } = r; return { ...row(rest), host: o ? o.name : "", hostType: o ? o.type : "" }; };
const EVENT_COLS = "*, organizations(name, type)";

export const isOver = e => ms(e.endsAt) <= Date.now();

// Everything showing in the Events tab, soonest first.
export async function tabEvents() {
  const cutoff = new Date(Date.now() - DROP_AFTER_MS).toISOString();
  const list = await run(sb.from("events").select(EVENT_COLS).eq("status", "published").gt("ends_at", cutoff)
    .order("starts_at", { ascending: true }).limit(300));
  return list.map(withHost);
}

// Which events you're going to or saved, and which of your connections are going.
export async function myMarks(uid, eventIds) {
  const saved = new Set(), going = new Set(), friends = new Map();
  const saves = await run(sb.from("event_saves").select("event_id").eq("user_id", uid).limit(500));
  saves.forEach(s => saved.add(s.event_id));
  if (eventIds.length) {
    const rsvps = await run(sb.from("event_rsvps").select("event_id, user_id").in("event_id", eventIds));
    rsvps.forEach(r => {
      if (r.user_id === uid) going.add(r.event_id);
      else friends.set(r.event_id, (friends.get(r.event_id) || 0) + 1);
    });
  }
  return { saved, going, friends };
}

export const setRsvp = (eventId, uid, on) => on
  ? run(sb.from("event_rsvps").insert({ event_id: eventId }))
  : run(sb.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", uid));
export const setSaved = (eventId, uid, on) => on
  ? run(sb.from("event_saves").insert({ event_id: eventId }))
  : run(sb.from("event_saves").delete().eq("event_id", eventId).eq("user_id", uid));

// ---------- Organizations ----------

export async function myOrganizations(uid) {
  const rs = await run(sb.from("organization_admins").select("organizations(*)").eq("uid", uid));
  return rs.filter(r => r.organizations).map(r => row(r.organizations));
}
export const registerOrganization = ({ type, name, website, location, size, industries }) => run(sb.rpc("create_organization", {
  p_type: type, p_name: name, p_website: website, p_location: location, p_size: size, p_industries: industries
}));

// All of an organization's events, including past and cancelled ones.
export const organizationEvents = orgId => many(sb.from("events").select("*").eq("org_id", orgId)
  .order("starts_at", { ascending: false }).limit(500));
// Past or cancelled events go in the log; the rest are still coming up.
export const inLog = e => isOver(e) || e.status === "cancelled";

const fields = f => ({ title: f.title, description: f.description, type: f.type, format: f.format, location: f.location, link: f.link, topic: f.topic, starts_at: f.startsAt, ends_at: f.endsAt });
export const createEvent = (orgId, f) => run(sb.from("events").insert({ org_id: orgId, ...fields(f) }));
export const updateEvent = (id, f) => changed(sb.from("events").update(fields(f)).eq("id", id));
export const cancelEvent = id => changed(sb.from("events").update({ status: "cancelled" }).eq("id", id));

// ---------- Dates ----------

export const dateParts = ts => {
  const d = new Date(ts);
  return { dow: d.toLocaleDateString("en-US", { weekday: "short" }), day: String(d.getDate()), mon: d.toLocaleDateString("en-US", { month: "short" }) };
};
export const monthLabel = ts => new Date(ts).toLocaleDateString("en-US", { month: "long", year: "numeric" });
export const clock = ts => new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const fullDate = ts => new Date(ts).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
export function timeRange(e) {
  const sameDay = new Date(e.startsAt).toDateString() === new Date(e.endsAt).toDateString();
  return sameDay ? `${clock(e.startsAt)} – ${clock(e.endsAt)}` : `${clock(e.startsAt)} – ${fullDate(e.endsAt)}, ${clock(e.endsAt)}`;
}
export const whereLabel = e => e.format === "Online" ? "Online" : e.format === "Hybrid" ? `${e.location || "Location to be announced"} + online` : (e.location || "Location to be announced");

// "Add to calendar": a standard calendar file that opens in Google, Apple or Outlook calendars.
export function downloadCalendarFile(e) {
  const stamp = ts => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = v => String(v || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const details = [e.description, e.link].filter(Boolean).join("\n\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Forge//Events//EN", "BEGIN:VEVENT",
    `UID:${e.id}@forge`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(e.startsAt)}`, `DTEND:${stamp(e.endsAt)}`,
    `SUMMARY:${text(e.title)}`, `DESCRIPTION:${text(details)}`, `LOCATION:${text(whereLabel(e))}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 50) || "event"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Calendar file downloaded. Open it to add the event to your calendar.");
}
