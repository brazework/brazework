import type * as THREE_NS from "three";

// The slate finish: the example models drawn like a studio product render, in matte stone greys
// instead of their paint colours, with crisp edges (model-stage.ts draws those). Each surface keeps
// how light or dark it was, mapped onto a five-step slate ramp, so an assembly's parts still read
// apart: a black tyre stays the darkest grey, a white panel the lightest. Glass stays see-through and
// lights still glow, both in slate. The model stands on a seamless studio sweep (model-stage.ts leaves
// out its setting: the test mat, the grass). Members' own files keep their colours: this is for the examples.
// Pure apart from three.js, which is passed in.

type Three = typeof THREE_NS;
type Mesh = THREE_NS.Mesh;
type Std = THREE_NS.MeshStandardMaterial;

/** Darkest to lightest. Cool, slightly blue greys, like honed slate. */
export const SLATE = [0x272c33, 0x343b44, 0x46505b, 0x5b6571, 0x737e8b] as const;
/** Edge lines on the solid model: a little lighter than the surfaces. */
export const SLATE_EDGE = 0xb7c0ca;

/** Relative luminance of an sRGB colour (0..1), as WCAG defines it. */
export function luminance(hex: number): number {
  const ch = (v: number) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((hex >> 16) & 255) + 0.7152 * ch((hex >> 8) & 255) + 0.0722 * ch(hex & 255);
}

/** The slate step for a colour: by perceived lightness, so contrast between parts survives. */
export function slateFor(hex: number): number {
  // Lightness (CIE L*, 0..1) spreads the steps the way eyes see them, not the way luminance does.
  const y = luminance(hex), l = (y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y) / 100;
  const i = Math.min(SLATE.length - 1, Math.max(0, Math.floor(l * SLATE.length)));
  return SLATE[i];
}

const slateMaterial = (THREE: Three, m: THREE_NS.Material): THREE_NS.Material => {
  const src = m as Partial<Std> & THREE_NS.Material;
  const hex = src.color ? src.color.getHex(THREE.SRGBColorSpace) : 0x808080;
  const glows = !!src.emissive && src.emissive.getHex() !== 0 && (src.emissiveIntensity ?? 1) > 0;
  const out = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHex(slateFor(hex), THREE.SRGBColorSpace),
    roughness: 0.68, metalness: 0.06,
    transparent: src.transparent ?? false, opacity: src.opacity ?? 1, side: src.side ?? THREE.FrontSide,
    // A light or a screen keeps a faint slate glow; the live examples still pulse it (its intensity).
    ...(glows && { emissive: new THREE.Color().setHex(SLATE_EDGE, THREE.SRGBColorSpace), emissiveIntensity: Math.min(0.6, (src.emissiveIntensity ?? 1) * 0.25) }),
  });
  // The examples' animations re-colour some glows (a green "arriving" label); in slate the colour stays.
  out.emissive.setHex = function () { return this; };
  if (src.transparent) out.depthWrite = src.depthWrite ?? false;
  return out;
};

/** Give `object` the slate finish, in place. */
export function applySlate(THREE: Three, object: THREE_NS.Object3D): void {
  const done = new Map<THREE_NS.Material, THREE_NS.Material>();
  const swap = (m: THREE_NS.Material) => { let s = done.get(m); if (!s) { s = slateMaterial(THREE, m); done.set(m, s); } return s; };
  object.traverse((c) => {
    const mesh = c as Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material;
    mesh.material = Array.isArray(old) ? old.map(swap) : swap(old);
  });
  for (const m of done.keys()) m.dispose();
}
