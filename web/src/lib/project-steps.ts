// Adding a project in steps (2026-11-26), instead of one long form. Only the first step is required:
// a title and a summary are enough to save, and every later step can be skipped with "Add project".
// Editing a project keeps the full form, since there you're changing one thing, not starting.

export const PROJECT_STEPS = [
  { id: "what", title: "What is it?", hint: "A name and one or two sentences. That's all you need to save it." },
  { id: "where", title: "Where does it stand?", hint: "Where it's at, what it's about and what you built it with." },
  { id: "show", title: "Show the work", hint: "The write-up, a link and the numbers that matter. All optional." },
] as const;

export const LAST_STEP = PROJECT_STEPS.length - 1;

/** Ways to start: type it in, tell Torch in a sentence, or start from where the work lives. */
export type ProjectStart = "type" | "torch" | "link";

/** The next step, never past the last one. */
export const nextStep = (step: number): number => Math.min(LAST_STEP, Math.max(0, step) + 1);
/** The step before, never before the first one. */
export const prevStep = (step: number): number => Math.max(0, Math.min(LAST_STEP, step) - 1);

/**
 * What the member's sentence becomes when they hand the project to Torch, which drafts the project card
 * (propose_project) for them to check and add. Null until there's enough to go on.
 */
export function torchProjectAsk(words: string): string | null {
  const w = words.replace(/\s+/g, " ").trim().slice(0, 600);
  if (w.length < 12) return null;
  return `Add this project to my profile: ${w}`;
}

/** Topics to offer as one-tap chips: the member's interests first, then the rest, minus what's picked. */
export function topicChips(interests: string[], all: string[], picked: string[], max = 8): string[] {
  return [...new Set([...interests, ...all])].filter((t) => !picked.includes(t)).slice(0, max);
}
