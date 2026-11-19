import { TOPICS } from "@/lib/forge";

// The front door (landing → sign-up → first run). A visitor types what they're building on the
// landing page; that line rides into sign-up in the link, is kept in this browser (like the goal,
// app/(auth)/signup/remember-goal.tsx), and is waiting in the first-build box on Today. Nothing is
// sent anywhere until they tap "Start my build". Pure, and tested (tests/front-door.test.ts).

/** Where the typed build waits in the browser between the landing page and Today. */
export const BUILD_KEY = "brazework-build";

/** A typed build, tidied: single spaces, trimmed, at most 300 characters (the project title limit),
 *  and "" when it's too short to be one (the first-build box needs 3). */
export function cleanBuild(text: string): string {
  const s = text.replace(/\s+/g, " ").trim().slice(0, 300);
  return s.length >= 3 ? s : "";
}

/** The sign-up link from the landing page: the goal when one is picked, the build when there is one. */
export function signupHref(goal: string, build: string): string {
  const q = new URLSearchParams();
  if (goal) q.set("goal", goal);
  const b = cleanBuild(build);
  if (b) q.set("build", b);
  const s = q.toString();
  return s ? `/signup?${s}` : "/signup";
}

/** Onboarding: a field starts with its first three interests picked (three are needed to continue),
 *  until the member changes one themselves. */
export function starterInterests(field: string): string[] {
  return [...(TOPICS.find((t) => t.name === field)?.topics ?? [])].slice(0, 3);
}

// Build-first onboarding: the field is guessed from the line they typed, so the first screen is one
// box and one tap. Whole-word keywords, most specific fields first (a "robot arm for rehab" is
// Health before Engineering); null when nothing matches, and the picker starts on the first field.
const FIELD_WORDS: [string, string[]][] = [
  ["Space Science", ["satellite", "cubesat", "rocket", "rocketry", "telescope", "orbit", "orbital", "astro", "astronomy", "spacecraft", "launch vehicle"]],
  ["Health & Medicine", ["patient", "clinic", "clinical", "medical", "hospital", "rehab", "prosthetic", "prosthesis", "health", "nursing", "vaccine", "diagnostic"]],
  ["Data & AI", ["machine learning", "ml", "ai", "llm", "neural", "model", "dataset", "classifier", "computer vision", "chatbot", "agent", "kaggle"]],
  ["Computer Science", ["app", "website", "web app", "api", "compiler", "backend", "frontend", "database", "software", "game", "ios", "android", "extension", "cli"]],
  ["Engineering", ["robot", "robotic", "drone", "cad", "pcb", "circuit", "bridge", "engine", "motor", "3d print", "3d printed", "prototype", "arduino", "fpga", "battery pack", "go-kart", "baja", "formula sae"]],
  ["Biology & Life Sciences", ["cell", "cells", "gene", "genome", "crispr", "protein", "bacteria", "enzyme", "neuron", "lab assay", "microscopy"]],
  ["Chemistry", ["synthesis", "polymer", "catalyst", "reaction", "electrolyte", "titration", "compound", "chemistry"]],
  ["Physics", ["laser", "quantum", "optics", "particle", "plasma", "spectrometer", "physics"]],
  ["Mathematics", ["proof", "theorem", "conjecture", "putnam", "lemma", "combinatorics"]],
  ["Earth & Environment", ["solar", "climate", "water quality", "compost", "recycling", "watershed", "wind turbine", "sustainability", "emissions"]],
  ["Business & Entrepreneurship", ["startup", "business", "revenue", "customers", "pitch", "marketing", "pricing", "store", "shop", "ecommerce", "investor", "case competition"]],
  ["Design & Arts", ["design", "logo", "brand", "poster", "film", "album", "song", "mural", "exhibit", "portfolio", "ux", "figma", "sculpture"]],
  ["Media & Communication", ["podcast", "newsletter", "article", "journalism", "video series", "youtube", "magazine", "documentary"]],
  ["Social Sciences & Policy", ["survey", "policy", "election", "economics", "psychology", "study of", "interviews", "moot court", "mock trial"]],
  ["Education", ["tutoring", "tutor", "curriculum", "lesson", "workshop", "bootcamp", "teaching", "students learn"]],
];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The field a typed build most likely belongs to, or null. */
export function guessField(text: string): string | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9+#\- ]+/g, " ").replace(/\s+/g, " ")} `;
  let best: string | null = null, score = 0;
  for (const [field, words] of FIELD_WORDS) {
    if (!TOPICS.some((x) => x.name === field)) continue;
    const s = words.reduce((n, w) => n + (new RegExp(`(^|[^a-z0-9])${escapeRe(w)}s?([^a-z0-9]|$)`).test(t) ? 1 : 0), 0);
    if (s > score) { best = field; score = s; }
  }
  return best;
}

/** The line under a new member's name, until they write their own: "Engineering student". */
export function firstHeadline(field: string, student: boolean): string {
  return student ? `${field} student` : field;
}
