import { ALL_TOPICS } from "@/lib/forge";

// #tags written in a post. Anyone can make a new one; the first three distinct tags become the
// post's tags (the database allows 3), so what the composer colours is exactly what gets tagged.
// A tag is letters, digits, - or _ (30 at most), starting with a letter or digit and holding at
// least one letter (so "Static fire #4" stays a number), at the start of the text or after a space
// or "(". A known topic is matched however it's written (#machinelearning,
// #MachineLearning) and stored under its real name ("Machine Learning"), so interests and the
// feed's tag filter keep working; a new tag is stored in lower case so #MyRover and #myrover are one.
export const MAX_TAGS = 3;
export const TAG_FORMAT = /^(?=[\p{N}_-]*\p{L})[\p{L}\p{N}][\p{L}\p{N}_-]{0,29}$/u;
const TAG = /(^|[\s(])#(?=[\p{N}_-]*\p{L})([\p{L}\p{N}][\p{L}\p{N}_-]{0,29})(?![\p{L}\p{N}_-])/gu;

const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const TOPIC_BY_SLUG = new Map(ALL_TOPICS.map((t) => [squash(t), t]));

// What a written tag is stored as.
export function canonicalTag(written: string): string {
  return TOPIC_BY_SLUG.get(squash(written)) ?? written.toLowerCase();
}

// How a topic is written as a hashtag: "Batteries & Electrochemistry" → "#BatteriesElectrochemistry".
export function hashtagFor(topic: string): string {
  return "#" + topic.replace(/&/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

// A stored tag is valid if it's a known topic or a well-formed new tag.
export function validTag(t: string): boolean {
  return ALL_TOPICS.includes(t) || (TAG_FORMAT.test(t) && t === t.toLowerCase());
}

// The post's tags: the first three distinct #tags in the text, in the order they appear.
export function hashtagsIn(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(TAG)) {
    const t = canonicalTag(m[2]);
    if (!out.includes(t)) out.push(t);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

// The text split into plain pieces and #tags (written as typed, with the tag it counts as).
export type TagPart = { written: string; tag: string };
export function hashtagParts(text: string): (string | TagPart)[] {
  const out: (string | TagPart)[] = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const at = m.index + m[1].length;
    if (at > last) out.push(text.slice(last, at));
    out.push({ written: `#${m[2]}`, tag: canonicalTag(m[2]) });
    last = at + m[2].length + 1;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
