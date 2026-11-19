"use client";
import { useEffect, useRef } from "react";

// A signature landing: the first time this browser shows a milestone signed in the last week, its
// seal comes down like a stamp (.seal-stamp, globals.css). Once per milestone, never on a reload,
// and not at all with reduced motion. The seal is there from the server's first paint; this only
// adds the movement, so nothing shifts and nothing waits on JavaScript.
const WEEK = 7 * 864e5;

export function FreshSeal({ id, at, children }: { id: string; at?: string | null; children: React.ReactNode }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const signed = at ? Date.parse(at) : NaN;
    if (!Number.isFinite(signed) || Date.now() - signed > WEEK) return;
    const key = `brazework-seal:${id}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
    el.current?.classList.add("seal-stamp");
  }, [id, at]);
  return <span ref={el} data-seal className="mr-1 inline-block align-[-2px]">{children}</span>;
}
