// Video captions: .vtt kept, .srt converted, anything else refused; only videos carry them.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { cueTexts, toVtt } from "@/lib/captions";
import { validMedia } from "@/lib/media";

const VTT = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nIgnition.\n\n00:00:03.500 --> 00:00:05.000\nLiftoff!";
const SRT = "1\r\n00:00:01,000 --> 00:00:03,000\r\nIgnition.\r\n\r\n2\r\n00:00:03,500 --> 00:00:05,000\r\nLiftoff!\r\n";

test("WebVTT is kept as it is", () => {
  assert.equal(toVtt(VTT), VTT);
  assert.equal(toVtt("﻿" + VTT + "\n\n"), VTT); // a byte-order mark and trailing lines are dropped
});

test("SubRip (.srt) becomes WebVTT", () => {
  const out = toVtt(SRT)!;
  assert.ok(out.startsWith("WEBVTT\n\n"));
  assert.match(out, /00:00:01\.000 --> 00:00:03\.000/);
  assert.ok(!out.includes("\r"));
  assert.deepEqual(cueTexts(out), ["Ignition.", "Liftoff!"]);
});

test("anything that isn't timed captions is refused", () => {
  for (const bad of ["", "hello", "WEBVTT\n\njust text", "00:00:01 --> 00:00:02\nno milliseconds", 42, null]) assert.equal(toVtt(bad), null);
  assert.equal(toVtt("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n" + "x".repeat(20000)), null);
});

test("only videos carry captions and transcripts, and they're checked", () => {
  const owner = "11111111-1111-1111-1111-111111111111";
  const video = { type: "video", path: `${owner}/clip.mp4` };
  assert.deepEqual(validMedia([{ ...video, cc: SRT, tx: "  Countdown, ignition, liftoff.  " }], owner), [
    { type: "video", path: `${owner}/clip.mp4`, w: undefined, h: undefined, cc: toVtt(SRT), tx: "Countdown, ignition, liftoff." },
  ]);
  assert.equal(validMedia([{ ...video, cc: "not captions" }], owner), null);
  assert.equal(validMedia([{ type: "image", path: `${owner}/a.jpg`, cc: VTT }], owner), null);
  assert.equal(validMedia([{ type: "image", path: `${owner}/a.jpg`, tx: "a transcript" }], owner), null);
  assert.equal(validMedia([{ ...video, tx: "x".repeat(5001) }], owner), null);
});
