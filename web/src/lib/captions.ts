// Video captions (supabase/video-captions.sql): members add a WebVTT or SubRip (.srt) file; it's
// stored as WebVTT text on the video and shown as a captions track. Pure, so it's unit-tested.

export const CAPTIONS_MAX = 20000;
export const TRANSCRIPT_MAX = 5000;

const CUE = /^(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}[ \t]+-->[ \t]+(?:\d{1,2}:)?\d{2}:\d{2}\.\d{3}/m;

// WebVTT as-is, or SubRip converted (its commas in timestamps become dots). Null if it isn't a
// captions file with at least one timed cue, or it's too long.
export function toVtt(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let s = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim();
  if (!s) return null;
  if (!s.startsWith("WEBVTT")) {
    // SubRip: "00:00:01,000 --> 00:00:03,000". Numbered cue lines are valid WebVTT identifiers.
    s = "WEBVTT\n\n" + s.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  }
  if (!CUE.test(s) || s.length > CAPTIONS_MAX) return null;
  return s;
}

// The cues as plain lines (for a quick preview in the editor).
export function cueTexts(vtt: string): string[] {
  return vtt.split(/\n\n+/).flatMap((block) => {
    const lines = block.split("\n");
    const at = lines.findIndex((l) => l.includes("-->"));
    return at === -1 ? [] : [lines.slice(at + 1).join(" ").replace(/<[^>]+>/g, "").trim()].filter(Boolean);
  });
}
