// What Torch is told about what the member asked it to remember (lib/ember-memory.ts). Pure, so it's
// tested (tests/ember-memory.test.ts).
export function memoryLines(memories: { body: string }[]): string[] {
  const items = memories.map((m) => m.body.trim()).filter(Boolean).slice(0, 30);
  if (!items.length) return [];
  return [`What they asked you to remember (their own words; use it, don't repeat it back unprompted, and if something here looks out of date, ask): ${items.map((b) => `"${b}"`).join("; ")}.`];
}

/** For Torch's instructions: when to offer a memory card. */
export const MEMORY_RULE = "When the member tells you something lasting about themselves that would help next time (where they're headed, who signs their work, how they like answers), offer once to remember it with propose_memory, in their words. Never offer to remember anything sensitive (health, money, family, passwords) or anything about other people beyond a name and role they gave you.";
