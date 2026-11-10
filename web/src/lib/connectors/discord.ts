// Discord connector: posts to a club's channel through an incoming webhook. Best effort: a failed
// announcement never fails the action that triggered it. Mentions are always disabled, so a post
// can never ping @everyone, roles or people, whatever the text says.

export const DISCORD_WEBHOOK = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/[0-9]{5,25}\/[A-Za-z0-9_-]{20,100}$/;
const COLOR = 0xf97316;

type Embed = { title: string; url?: string; description?: string; fields?: { name: string; value: string; inline?: boolean }[]; footer?: { text: string }; color?: number };
export type DiscordPayload = { username: string; content?: string; embeds?: Embed[]; allowed_mentions: { parse: never[] } };

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const base = (club: string) => ({ username: cut(`Brazework · ${club}`, 80), allowed_mentions: { parse: [] as never[] } });

export function eventMessage(club: string, e: { id: string; title: string; description: string; starts_at: string; format: string; location: string }, site: string): DiscordPayload {
  const t = Math.floor(Date.parse(e.starts_at) / 1000);
  return { ...base(club), embeds: [{
    title: cut(`New event: ${e.title}`, 256), url: `${site}/events/${e.id}`, color: COLOR,
    description: cut(e.description || "RSVP on Brazework.", 1000),
    // Discord shows <t:…> in each reader's own timezone.
    fields: [{ name: "When", value: `<t:${t}:F> (<t:${t}:R>)`, inline: true }, { name: "Where", value: cut(e.format === "Online" ? "Online" : e.location || e.format, 200), inline: true }],
    footer: { text: "RSVP on Brazework" },
  }] };
}

export function milestoneMessage(club: string, m: { member: string; memberId: string; title: string; project: string }, site: string): DiscordPayload {
  return { ...base(club), embeds: [{ title: cut(`Verified: ${m.title}`, 256), url: `${site}/u/${m.memberId}`, color: 0x16a34a, description: cut(`${m.member}${m.project ? ` · ${m.project}` : ""}. Verified by ${club} on Brazework.`, 1000) }] };
}

export function updateMessage(club: string, clubId: string, text: string, site: string): DiscordPayload {
  return { ...base(club), content: cut(text, 1900), embeds: [{ title: cut(`${club} on Brazework`, 256), url: `${site}/c/${clubId}`, color: COLOR }] };
}

export async function sendDiscord(url: string, payload: DiscordPayload, fetchImpl: typeof fetch = fetch): Promise<{ ok: boolean; message: string }> {
  if (!DISCORD_WEBHOOK.test(url)) return { ok: false, message: "That isn't a Discord webhook link." };
  try {
    const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(5000) });
    if (res.ok) return { ok: true, message: "Sent to Discord." };
    if (res.status === 401 || res.status === 404) return { ok: false, message: "Discord says that webhook no longer exists. Paste a new one." };
    if (res.status === 429) return { ok: false, message: "Discord is rate-limiting this webhook. Try again in a minute." };
    return { ok: false, message: `Discord answered ${res.status}.` };
  } catch {
    return { ok: false, message: "Couldn't reach Discord." };
  }
}
