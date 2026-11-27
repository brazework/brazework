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
