// Calendar import: read the events out of an .ics file (Google Calendar, Outlook, Apple Calendar all
// export one), so a club can bring its semester to Forge in one step. Pure functions, no network:
// the file comes from the officer's own computer. Tested in tests/ics.test.ts.

export type IcsEvent = { uid: string; title: string; description: string; location: string; link: string; starts_at: string; ends_at: string; allDay: boolean };

// Long lines are folded onto continuation lines that start with a space or tab (RFC 5545 §3.1).
const unfold = (text: string) => text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

// The UTC moment for a wall-clock time in an IANA time zone, using the platform's time zone data.
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetAt = (t: number) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
  };
  // Two passes settle the offset even right next to a daylight-saving change.
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

// DTSTART;TZID=America/New_York:20261112T180000 | DTSTART:20261112T230000Z | DTSTART;VALUE=DATE:20261112
function parseWhen(params: string, value: string, fallbackTz: string): { at: Date; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { at: zonedToUtc(+y, +mo, +d, 0, 0, 0, fallbackTz), allDay: true };
  if (z) return { at: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false };
  const tz = params.match(/TZID=("?)([^";:]+)\1/i)?.[2] ?? fallbackTz;
  try { return { at: zonedToUtc(+y, +mo, +d, +h, +mi, +(s ?? 0), tz), allDay: false }; }
  catch { return { at: zonedToUtc(+y, +mo, +d, +h, +mi, +(s ?? 0), fallbackTz), allDay: false }; }
}

const DEFAULT_LENGTH_MS = 3600000;

// Every event in the file. Times with no zone are read in `tz` (the officer's own time zone).
export function parseIcs(text: string, tz = "UTC"): IcsEvent[] {
  const out: IcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  for (const line of unfold(text).split("\n")) {
    if (/^BEGIN:VEVENT/i.test(line)) { cur = {}; continue; }
    if (/^END:VEVENT/i.test(line)) {
      if (cur) {
        const start = cur.DTSTART && parseWhen(cur.DTSTART.params, cur.DTSTART.value, tz);
        if (start && cur.SUMMARY?.value && !/^CANCELLED$/i.test(cur.STATUS?.value ?? "")) {
          const end = cur.DTEND && parseWhen(cur.DTEND.params, cur.DTEND.value, tz);
          const endAt = end && end.at > start.at ? end.at : new Date(start.at.getTime() + (start.allDay ? 86400000 : DEFAULT_LENGTH_MS));
          const url = unescape(cur.URL?.value ?? "");
          out.push({
            uid: cur.UID?.value ?? `${start.at.toISOString()}-${out.length}`,
            title: unescape(cur.SUMMARY.value).slice(0, 120),
            description: unescape(cur.DESCRIPTION?.value ?? "").slice(0, 2000),
            location: unescape(cur.LOCATION?.value ?? "").slice(0, 160),
            link: /^https?:\/\//.test(url) && url.length <= 300 ? url : "",
            starts_at: start.at.toISOString(),
            ends_at: endAt.toISOString(),
            allDay: start.allDay,
          });
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const m = line.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/);
    if (m) cur[m[1].toUpperCase()] = { params: m[2], value: m[3] };
  }
  return out;
}

// What's worth importing: events that haven't ended, soonest first, one per UID, at most `max`.
export function upcoming(events: IcsEvent[], now: number, max = 50): IcsEvent[] {
  const seen = new Set<string>();
  return events
    .filter((e) => Date.parse(e.ends_at) > now && e.title.length >= 3)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    .filter((e) => (seen.has(e.uid) ? false : (seen.add(e.uid), true)))
    .slice(0, max);
}
