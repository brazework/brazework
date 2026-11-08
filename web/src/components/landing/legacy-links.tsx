"use client";
import { useEffect } from "react";

// The original app used hash routes (/#/feed, /#/u/<id>, /#/network/invitations…). Bookmarks and
// shared links from before the switch-over land on "/" with the hash; send them to the new page.
const MAP: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^#\/network\/(\w+)/, (m) => `/network?tab=${m[1] === "suggested" ? "suggested" : m[1]}`],
  [/^#\/communities\/discover/, () => "/communities?tab=discover"],
  [/^#\/c\/([^/]+)\/manage/, (m) => `/c/${m[1]}/manage`],
  [/^#\/u\/([^/]+)/, (m) => `/u/${m[1]}`],
  [/^#\/(c|post|messages|events)\/([^/]+)/, (m) => `/${m[1]}/${m[2]}`],
  [/^#\/(feed|profile|communities|network|messages|events|org|saved|analytics|notifications|settings|login|signup)\b/, (m) => `/${m[1]}`],
];

export function LegacyLinks() {
  useEffect(() => {
    const h = window.location.hash;
    if (!h.startsWith("#/")) return;
    for (const [re, to] of MAP) {
      const m = h.match(re);
      if (m) { window.location.replace(to(m)); return; }
    }
  }, []);
  return null;
}
