// Desired state vs. live state (Linear FIX-82). Pure, so the rules are unit-tested
// (web/tests/infra-diff.test.ts): nothing here talks to a network.

// Every place `live` differs from `desired`, as { path, want, got }. Only keys in `desired` are
// compared: the repo owns those settings and nothing else (a setting we don't model isn't drift).
export function diff(desired, live, path = "") {
  if (Array.isArray(desired)) return diffSet(desired, Array.isArray(live) ? live : [], path);
  if (desired && typeof desired === "object") {
    return Object.entries(desired).flatMap(([k, v]) => diff(v, live && typeof live === "object" ? live[k] : undefined, path ? `${path}.${k}` : k));
  }
  return same(desired, live) ? [] : [{ path, want: desired, got: live }];
}

// Lists are sets: order doesn't matter, missing and extra items both count.
function diffSet(desired, live, path) {
  const key = (x) => JSON.stringify(x, Object.keys(x && typeof x === "object" ? x : {}).sort());
  const want = new Map(desired.map((x) => [key(x), x]));
  const got = new Map(live.map((x) => [key(x), x]));
  return [
    ...[...want].filter(([k]) => !got.has(k)).map(([, x]) => ({ path, want: x, got: "(missing)" })),
    ...[...got].filter(([k]) => !want.has(k)).map(([, x]) => ({ path, want: "(not in the repo)", got: x })),
  ];
}

// "465" and 465 are the same setting (Supabase returns some numbers as strings).
const same = (a, b) => a === b || (a != null && b != null && String(a) === String(b));

// Supabase keeps the redirect list as one comma-separated string; the repo keeps a list.
export const splitList = (s) => (s ? String(s).split(",").map((x) => x.trim()).filter(Boolean) : []);
