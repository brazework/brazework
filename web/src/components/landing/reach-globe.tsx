"use client";
import { useInView, useReducedMotion } from "motion/react";
import { Eye, GraduationCap, HandCoins, Heart, MailOpen, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { Globe, type Place } from "./globe";
import { usePinned } from "./use-pinned";

// Where verified work goes (Linear FIX-92): the globe, and beside it what each arc stands for. They
// move together. Wide screens: the section is pinned and the scroll walks through the moments while
// the globe turns to each one (use-pinned.ts). Phones: the moments advance on their own.
// Example data. Module-level so the globe's canvas set-up runs once.

const FROM: Place = { lat: 30.27, lon: -97.74, label: "Your club · Austin" };
const MOMENTS = [
  { icon: Eye, verb: "Seen", text: "An aerospace team in Seattle opened your rover's test log.", place: { lat: 47.61, lon: -122.33, label: "Seattle" } },
  { icon: MailOpen, verb: "Invited", text: "A robotics lab in Pittsburgh asked you to apply for the summer.", place: { lat: 40.44, lon: -79.99, label: "Pittsburgh" } },
  { icon: Heart, verb: "Followed", text: "A biotech group in Boston started following your assay write-ups.", place: { lat: 42.36, lon: -71.06, label: "Boston" } },
  { icon: HandCoins, verb: "Funded", text: "A battery startup in Berlin sponsored your club's next challenge.", place: { lat: 52.52, lon: 13.4, label: "Berlin" } },
  { icon: GraduationCap, verb: "Asked", text: "A grad program in Zürich asked for your verified project page.", place: { lat: 47.37, lon: 8.54, label: "Zürich" } },
  { icon: Users, verb: "Mentored", text: "An alum in Tokyo now reviews your team's designs every month.", place: { lat: 35.68, lon: 139.69, label: "Tokyo" } },
];
const TO: Place[] = MOMENTS.map((m) => m.place);

export function ReachGlobe({ head }: { head: React.ReactNode }) {
  const [own, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const pin = usePinned(ref, MOMENTS.length);
  const at = pin.wide ? pin.at : own;
  useEffect(() => {
    if (pin.wide || !auto || reduce || !inView) return;
    const t = setTimeout(() => setAt((v) => (v + 1) % MOMENTS.length), 3600);
    return () => clearTimeout(t);
  }, [own, auto, reduce, inView, pin.wide]);
  const m = MOMENTS[at];

  return (
    <div ref={ref} className="grid grid-cols-1 items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-x-12">
      <div className="md:col-start-1">
        {head}
        <ol className="m-hide mt-8 flex flex-col gap-0.5">
          {MOMENTS.map((x, i) => (
            <li key={x.verb}>
              <button type="button" aria-pressed={i === at} onClick={() => { if (pin.wide) pin.goTo(i); else { setAuto(false); setAt(i); } }}
                className={cn("flex w-full items-start gap-3.5 rounded-xl border px-4 py-2.5 text-left transition", i === at ? "border-line-strong bg-surface shadow-[var(--shadow)]" : "border-transparent hover:bg-surface/70")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg transition", i === at ? "bg-text text-bg" : "bg-surface-2 text-muted")}><x.icon className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", i !== at && "text-text-2")}>{x.verb}</span>
                  <span className="block text-sm leading-relaxed text-muted">{x.text}</span>
                  {pin.wide && i === at && <span aria-hidden="true" className="mt-2 block h-px bg-line"><span className="block h-full origin-left bg-text" style={{ transform: `scaleX(${Math.max(0.04, pin.fill)})` }} /></span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,40rem)] max-md:max-h-[40dvh] max-md:max-w-[40dvh] md:col-start-2 md:row-span-2 md:row-start-1">
        <Globe from={FROM} to={TO} active={at} className="absolute inset-0 size-full" />
      </div>
      <div className="md:col-start-1 md:row-start-2">
        {/* Phones: one moment at a time, under the globe. */}
        <p className="m-only mt-4 text-[15px] leading-relaxed text-text-2" aria-live="polite"><b className="font-semibold text-text">{m.verb}.</b> {m.text}</p>
        <p className="mt-3 text-xs text-faint">Example · drag the globe to turn it</p>
      </div>
    </div>
  );
}
