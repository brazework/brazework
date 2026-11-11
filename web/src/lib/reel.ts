import type { MediaItem } from "@/lib/media";

// The project reel (Linear FIX-68): the build told as a timeline. Every update in date order, each
// club-verified milestone at the date it was achieved, played full screen with a timeline you can
// see fill in (and tap to jump). It's assembled only from the project's real material (its updates,
// photos and video, specs, tools, team and verified milestones), so nothing in it is invented.
// Pure, so the order, dates and limits are tested (tests/reel.test.ts).

const DAY = 864e5;

export type ReelInput = {
  title: string;
  summary: string;
  writeup: string;
  status: "in_progress" | "completed";
  year: number | null;
  owner: string;
  club: string | null;
  team: string[];
  tools: string[];
  specs: { label: string; value: string }[];
  // When the project started (its row's created_at), if known.
  started: string | null;
  // Its updates (posts on the project), any order: when, what it said, and its first photo or video.
  updates: { at: string; text: string; media: MediaItem | null }[];
  // Its club-verified milestones: on = the day it was achieved (YYYY-MM-DD); note = what the officer checked.
  proof: { title: string; detail: string; note: string; by: string; club: string; on: string }[];
};

type Dated = { at: number; week: number };
export type Scene =
  | { kind: "title"; title: string; by: string; club: string | null; status: string; cover: MediaItem | null; updates: number; verified: number; weeks: number }
  | { kind: "goal"; text: string }
  | ({ kind: "step"; text: string; item: MediaItem | null; n: number; of: number } & Dated)
  | ({ kind: "proof"; title: string; detail: string; note: string; by: string; club: string } & Dated)
  | { kind: "specs"; specs: { label: string; value: string }[] }
  | { kind: "tools"; tools: string[] }
  | { kind: "end"; title: string; team: string[]; verified: number; updates: number; from: number; to: number; weeks: number };

export type Reel = { scenes: Scene[]; start: number; end: number; live: boolean };

export const MAX_STEPS = 8;

const firstSentences = (s: string, max = 220) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 20 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
};

// Up to n items, evenly spread, always keeping the first and the last.
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

const dayOf = (on: string) => Date.parse(`${on}T12:00:00Z`);

export function buildReel(p: ReelInput, now: number): Reel {
  const updates = p.updates.map((u) => ({ ...u, t: Date.parse(u.at) })).filter((u) => !Number.isNaN(u.t)).sort((a, b) => a.t - b.t);
  const proofs = p.proof.map((m) => ({ ...m, t: dayOf(m.on) })).filter((m) => !Number.isNaN(m.t)).sort((a, b) => a.t - b.t);
  const firstEvent = Math.min(updates[0]?.t ?? Infinity, proofs[0]?.t ?? Infinity);
  const started = p.started ? Date.parse(p.started) : NaN;
  const start = Math.min(Number.isNaN(started) ? Infinity : started, firstEvent, now);
  const lastEvent = Math.max(updates.at(-1)?.t ?? -Infinity, proofs.at(-1)?.t ?? -Infinity);
  const live = p.status === "in_progress";
  // An open build runs to today ("Now"); a finished one ends at its last moment.
  const end = Math.max(live ? now : Number.isFinite(lastEvent) ? lastEvent : now, start + DAY);
  const week = (t: number) => Math.floor((t - start) / (7 * DAY)) + 1;
  const weeks = Math.max(1, week(end));

  const scenes: Scene[] = [];
  const cover = updates.find((u) => u.media?.type === "image")?.media ?? null;
  scenes.push({ kind: "title", title: p.title, by: p.owner, club: p.club, status: p.status === "completed" ? `Completed${p.year ? ` ${p.year}` : ""}` : "In progress", cover, updates: updates.length, verified: proofs.length, weeks });
  const goal = p.summary.trim() || p.writeup.trim();
  if (goal) scenes.push({ kind: "goal", text: firstSentences(goal) });

  // The journey: the updates (evenly thinned when there are many) and every verified milestone, in time.
  const steps = spread(updates, MAX_STEPS);
  type Ev = { t: number; scene: Scene };
  const events: Ev[] = [
    ...steps.map((u, i) => ({ t: u.t, scene: { kind: "step" as const, at: u.t, week: week(u.t), text: firstSentences(u.text, 160), item: u.media, n: i + 1, of: steps.length } })),
    ...proofs.map((m) => ({ t: m.t, scene: { kind: "proof" as const, at: m.t, week: week(m.t), title: m.title, detail: firstSentences(m.detail, 140), note: firstSentences(m.note, 140), by: m.by, club: m.club } })),
  ];
  // Same moment: the update first, then the proof it earned.
  events.sort((a, b) => a.t - b.t || (a.scene.kind === "proof" ? 1 : 0) - (b.scene.kind === "proof" ? 1 : 0));
  for (const e of events) scenes.push(e.scene);

  if (p.specs.length) scenes.push({ kind: "specs", specs: p.specs.slice(0, 4) });
  if (p.tools.length) scenes.push({ kind: "tools", tools: p.tools.slice(0, 8) });
  scenes.push({ kind: "end", title: p.title, team: [p.owner, ...p.team.filter((t) => t && t !== p.owner)].slice(0, 6), verified: proofs.length, updates: updates.length, from: start, to: end, weeks });
  return { scenes, start, end, live };
}

// Where each scene sits on the timeline, 0 (start) to 1 (end). Undated scenes sit before the first
// dated one (the intro) or after the last (the wrap-up).
export function positions(r: Reel): number[] {
  const span = Math.max(1, r.end - r.start);
  const firstDated = r.scenes.findIndex((s) => s.kind === "step" || s.kind === "proof");
  return r.scenes.map((s, i) => (s.kind === "step" || s.kind === "proof" ? Math.min(1, Math.max(0, (s.at - r.start) / span)) : firstDated === -1 || i < firstDated ? 0 : 1));
}

// How long each scene stays up before moving on (video steps run to the end, up to this).
export const sceneMs = (s: Scene) =>
  s.kind === "step" ? (s.item?.type === "video" ? 15000 : s.item ? 4800 : 4200) : s.kind === "proof" ? 6500 : s.kind === "title" ? 5000 : s.kind === "end" ? 4500 : 4500;
