import type { MediaItem } from "@/lib/media";

// The project reel (Linear FIX-68): a short, interactive story of a build, played full screen like
// stories. It's assembled only from the project's real material (its summary, photos and video
// from its updates, specs, tools, team and the milestones its club verified), so nothing in it is
// invented. Pure, so the order and the limits are tested (tests/reel.test.ts).

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
  media: { item: MediaItem; caption: string }[];
  proof: { title: string; detail: string; by: string; club: string; on: string }[];
};

export type Scene =
  | { kind: "title"; title: string; by: string; club: string | null; status: string; cover: MediaItem | null }
  | { kind: "goal"; text: string }
  | { kind: "media"; item: MediaItem; caption: string }
  | { kind: "specs"; specs: { label: string; value: string }[] }
  | { kind: "proof"; title: string; detail: string; by: string; club: string; on: string; n: number; of: number }
  | { kind: "tools"; tools: string[] }
  | { kind: "end"; title: string; team: string[]; verified: number };

const firstSentences = (s: string, max = 220) => {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > 20 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
};

export function buildReel(p: ReelInput): Scene[] {
  const scenes: Scene[] = [];
  const cover = p.media.find((m) => m.item.type === "image")?.item ?? null;
  scenes.push({ kind: "title", title: p.title, by: p.owner, club: p.club, status: p.status === "completed" ? `Completed${p.year ? ` ${p.year}` : ""}` : "In progress", cover });
  const goal = p.summary.trim() || p.writeup.trim();
  if (goal) scenes.push({ kind: "goal", text: firstSentences(goal) });
  // The build, in pictures: up to four, the cover photo not repeated straight after the title.
  for (const m of p.media.filter((m) => m.item !== cover || p.media.length === 1).slice(0, 4)) scenes.push({ kind: "media", item: m.item, caption: firstSentences(m.caption, 140) });
  if (p.specs.length) scenes.push({ kind: "specs", specs: p.specs.slice(0, 4) });
  // The proof: the moment that makes it Brazework. Up to three, newest first.
  const proof = p.proof.slice(0, 3);
  proof.forEach((m, i) => scenes.push({ kind: "proof", ...m, detail: firstSentences(m.detail, 140), n: i + 1, of: proof.length }));
  if (p.tools.length) scenes.push({ kind: "tools", tools: p.tools.slice(0, 8) });
  scenes.push({ kind: "end", title: p.title, team: [p.owner, ...p.team.filter((t) => t && t !== p.owner)].slice(0, 6), verified: p.proof.length });
  return scenes;
}

// How long each scene stays up before moving on (video scenes run to the end, up to this).
export const sceneMs = (s: Scene) => (s.kind === "media" && s.item.type === "video" ? 15000 : s.kind === "proof" ? 6000 : s.kind === "title" || s.kind === "end" ? 4500 : 5000);
