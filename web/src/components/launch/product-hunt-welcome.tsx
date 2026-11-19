"use client";
import { X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/forge";
import { PH_REF, refFrom } from "@/lib/launch";

// The Product Hunt welcome (docs/launch/product-hunt.md): a visitor who came from the launch
// (?ref=producthunt) is greeted on the landing page and again on sign-up. Client-only, so the
// landing page stays static; remembered for this tab's session, nowhere else.
const KEY = "brazework-ref";

const noStore = () => () => {};
function fromLaunch(place: string): boolean {
  try {
    if (refFrom(window.location.search) === PH_REF) sessionStorage.setItem(KEY, PH_REF);
    return sessionStorage.getItem(KEY) === PH_REF && sessionStorage.getItem(`${KEY}-closed-${place}`) !== "1";
  } catch { return false; }
}

export function ProductHuntWelcome({ place }: { place: "landing" | "signup" }) {
  const came = useSyncExternalStore(noStore, () => fromLaunch(place), () => false);
  const [closed, setClosed] = useState(false);
  if (!came || closed) return null;
  const close = () => { setClosed(true); try { sessionStorage.setItem(`${KEY}-closed-${place}`, "1"); } catch {} };
  return (
    <div role="status" aria-label="Welcome from Product Hunt"
      className={cn("flex items-center gap-3 border border-[#ff6154]/30 bg-[#ff6154]/8 text-sm text-text",
        place === "landing" ? "fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(calc(100%-2rem),46rem)] rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow)] backdrop-blur" : "relative mb-5 rounded-xl px-3.5 py-2.5")}>
      <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-[#ff6154] text-[13px] font-bold text-white">P</span>
      <p className="min-w-0 flex-1 pr-6">
        <b className="font-semibold">Welcome, Product Hunt.</b>{" "}
        {place === "landing" ? "Type what you built and sign up: it's on your record, waiting for a signature, in about 90 seconds. Free, always." : "Two fields here, then three quick screens and your first build is on your record."}
      </p>
      <button type="button" onClick={close} aria-label="Close" className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-muted hover:bg-hover hover:text-text"><X className="size-4" /></button>
    </div>
  );
}
