// Launch links (docs/launch/product-hunt.md). Pure, and tested (tests/launch.test.ts).

/** The ref the Product Hunt listing links with: https://brazework.com/?ref=producthunt */
export const PH_REF = "producthunt";

/** Where a visitor came from, from a URL's query string: lower-case letters, digits and dashes only. */
export function refFrom(search: string): string {
  const r = new URLSearchParams(search).get("ref") ?? "";
  return /^[a-z0-9-]{1,40}$/i.test(r) ? r.toLowerCase() : "";
}

/** Where the ref is remembered for this browser tab (components/launch/product-hunt-welcome.tsx). */
export const REF_KEY = "brazework-ref";

/**
 * Which of the landing hero's stories a visitor sees first. Product Hunt's crowd ships software and
 * already works in Claude and Cursor, so they start on the engineer's story (GitHub, a tech lead
 * signs); everyone else starts on the first one. The other stories still play after it.
 */
export function firstStoryFor(ref: string, stories: readonly { who: string }[]): number {
  if (ref !== PH_REF) return 0;
  const i = stories.findIndex((s) => s.who === "Software");
  return i < 0 ? 0 : i;
}
