"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
const snapshot = () => window.matchMedia(query).matches;
const serverSnapshot = () => false;
function subscribe(notify: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

// Keep the first browser render identical to the server, then apply the preference.
// Reading it immediately during hydration changes the hero's text and signature styles.
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
