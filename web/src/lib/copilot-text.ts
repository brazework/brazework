// Ember ends an answer with a line of follow-ups the member can tap: <<next: a | b | c>>.
// splitNext() takes it off the text (also mid-stream, so the marker never flashes on screen).

export function splitNext(raw: string): { text: string; next: string[] } {
  const at = raw.lastIndexOf("<<");
  if (at === -1) {
    // A lone "<" at the very end may be the start of the marker; hold it back until we know.
    return { text: raw.endsWith("<") ? raw.slice(0, -1).trimEnd() : raw, next: [] };
  }
  const close = raw.indexOf(">>", at);
  const inner = raw.slice(at + 2, close === -1 ? undefined : close);
  const m = /^\s*next\s*:\s*([\s\S]*)$/i.exec(inner);
  if (!m && close !== -1) return { text: raw, next: [] }; // some other "<<", not ours
  const next = close === -1 || !m ? [] : m[1].split("|").map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 1 && s.length <= 120).slice(0, 3);
  const text = (raw.slice(0, at) + (close === -1 ? "" : raw.slice(close + 2))).trimEnd();
  return { text, next };
}

// Links to things on Forge in an answer, in order, without repeats (for the cards under it).
export function forgeLinks(text: string, max = 4): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\/(c|u|events|projects|post)\/([A-Za-z0-9-]{1,64})/g)) {
    const p = `/${m[1]}/${m[2]}`;
    if (!out.includes(p)) out.push(p);
    if (out.length === max) break;
  }
  return out;
}
