"use client";
import { useInView, useReducedMotion } from "motion/react";
import { Eye, GraduationCap, HandCoins, Heart, MailOpen, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/forge";
import { Globe, type Place } from "./globe";

// Where verified work goes (Linear FIX-92): the globe, and beside it what each arc stands for. They
// move together: the list advances on its own while on screen, and picking a row lights its arc.
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

export function ReachGlobe() {
  const [at, setAt] = useState(0);
  const [auto, setAuto] = useState(true);
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  useEffect(() => {
    if (!auto || reduce || !inView) return;
    const t = setTimeout(() => setAt((v) => (v + 1) % MOMENTS.length), 3600);
    return () => clearTimeout(t);
  }, [at, auto, reduce, inView]);
  const m = MOMENTS[at];

  return (
    <div ref={ref} className="grid grid-cols-1 items-center gap-6 md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="order-2 lg:order-1">
        <ol className="m-hide flex flex-col gap-1">
          {MOMENTS.map((x, i) => (
            <li key={x.verb}>
              <button type="button" aria-pressed={i === at} onClick={() => { setAuto(false); setAt(i); }}
                className={cn("flex w-full items-start gap-3.5 rounded-xl border px-4 py-3 text-left transition", i === at ? "border-line-strong bg-surface shadow-[var(--shadow)]" : "border-transparent hover:bg-surface/70")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg transition", i === at ? "bg-text text-bg" : "bg-surface-2 text-muted")}><x.icon className="size-4" /></span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-semibold", i !== at && "text-text-2")}>{x.verb}</span>
                  <span className="block text-sm leading-relaxed text-muted">{x.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {/* Phones: one moment at a time, under the globe. */}
        <p className="m-only text-[15px] leading-relaxed text-text-2" aria-live="polite"><b className="font-semibold text-text">{m.verb}.</b> {m.text}</p>
        <p className="mt-3 text-xs text-faint">Example · drag the globe to turn it</p>
      </div>
      <div className="relative order-1 mx-auto aspect-square w-full max-w-[min(100%,36rem)] max-md:max-h-[44dvh] max-md:max-w-[44dvh] lg:order-2">
        <Globe from={FROM} to={TO} active={at} className="absolute inset-0 size-full" />
      </div>
    </div>
  );
}
