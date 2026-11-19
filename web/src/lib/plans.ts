// Which features are free and which belong to Plus. Moving a feature is one word here, nothing else.
// Plus isn't sold yet (no billing; see /pricing), so:
//   "free"          everyone, unlabelled. Free features stay free ("Nothing in Free moves to Plus").
//   "plus-preview"  everyone for now, labelled "Plus preview", so moving it to "plus" later breaks no promise.
//   "plus"          only members with Plus (nobody until billing exists); everyone else sees what it is.
// Tested in tests/review-packet.test.ts.
export type Access = "free" | "plus-preview" | "plus";
export type Feature = "reviewPacket";

export const FEATURE_ACCESS: Record<Feature, Access> = {
  // The review packet (a printable record of your signed work over a date range, for performance reviews).
  reviewPacket: "plus-preview",
};

/** Whether this member has Plus. There's no billing yet, so nobody does. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const hasPlus = (_viewer: { id: string }): boolean => false;

export function canUse(feature: Feature, viewer: { id: string }, access: Record<Feature, Access> = FEATURE_ACCESS): boolean {
  const a = access[feature];
  return a !== "plus" || hasPlus(viewer);
}

export const accessLabel = (feature: Feature, access: Record<Feature, Access> = FEATURE_ACCESS): string | null =>
  access[feature] === "plus-preview" ? "Plus preview: free while Plus is coming" : access[feature] === "plus" ? "Plus" : null;
