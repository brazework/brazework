// The slate finish (components/projects/model-slate.ts): every example model in stone greys, with the
// contrast between its parts kept, glows kept faint and in slate, and nothing of the paint colours
// left. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { SLATE, applySlate, luminance, slateFor } from "@/components/projects/model-slate";
import { SAMPLES, buildSample } from "@/components/projects/sample-models";

const grey = (hex: number) => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return Math.max(r, g, b) - Math.min(r, g, b) <= 24; };

test("the ramp runs dark to light, and every step is a cool grey", () => {
  for (let i = 1; i < SLATE.length; i++) assert.ok(luminance(SLATE[i]) > luminance(SLATE[i - 1]), `step ${i} is lighter than ${i - 1}`);
  for (const s of SLATE) assert.ok(grey(s) && (s & 255) >= ((s >> 16) & 255), `${s.toString(16)} is a cool grey`);
});

test("lightness survives: black is the darkest step, white the lightest, and order holds", () => {
  assert.equal(slateFor(0x000000), SLATE[0]);
  assert.equal(slateFor(0xffffff), SLATE[SLATE.length - 1]);
  const ramp = [0x101010, 0x404040, 0x808080, 0xc0c0c0, 0xf0f0f0].map(slateFor);
  for (let i = 1; i < ramp.length; i++) assert.ok(luminance(ramp[i]) >= luminance(ramp[i - 1]));
  assert.notEqual(slateFor(0xd93025), slateFor(0xfde047), "a red and a yellow part still read apart");
});

test("every example comes out all slate, glows faint and locked to slate", () => {
  for (const s of SAMPLES) {
    const o = buildSample(THREE, s.id);
    applySlate(THREE, o);
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const std = mat as THREE.MeshStandardMaterial;
        assert.ok((SLATE as readonly number[]).includes(std.color.getHex(THREE.SRGBColorSpace)), `${s.id}: ${std.color.getHexString()} is a slate step`);
        assert.ok(grey(std.emissive.getHex()), `${s.id}: glow is grey`);
        assert.ok(std.emissive.getHex() === 0 || std.emissiveIntensity <= 0.6, `${s.id}: glow stays faint`);
        std.emissive.setHex(0x22c55e);
        assert.ok(grey(std.emissive.getHex()), `${s.id}: an animation can't re-colour it`);
      }
    });
  }
});
