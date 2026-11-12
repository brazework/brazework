"use client";
import { Download, Ban, CircleUser, HelpCircle, KeyRound, Mail, MessageSquare, Palette, Plug, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { NavTile } from "@/components/app/nav-tile";
import { useAppearOffline } from "@/components/presence/presence";
import { cn } from "@/lib/forge";

export const SECTIONS = [
  { id: "profile", label: "Profile", icon: CircleUser },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "email", label: "Email", icon: Mail },
  { id: "messaging", label: "Messaging and privacy", icon: MessageSquare },
  { id: "blocked", label: "Blocked people", icon: Ban },
  { id: "ember", label: "Ember and your data", icon: Sparkles },
  { id: "ai-tools", label: "Your tools", icon: Plug },
  { id: "data", label: "Your data", icon: Download },
  { id: "help", label: "Help", icon: HelpCircle },
  { id: "account", label: "Account", icon: KeyRound },
] as const;

// The settings menu on wide screens: jumps to a section and highlights the one you're reading.
export function SettingsNav() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (seen) setActive(seen.target.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <nav aria-label="Settings sections" className="sticky top-6 hidden flex-col gap-0.5 lg:flex">
      {SECTIONS.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined} className={cn("group flex items-center gap-3 rounded-2xl px-2 py-1.5 text-sm transition", active === s.id ? "nav-pill font-medium text-text" : "text-text-2 hover:bg-hover/60 hover:text-text")}>
          <NavTile icon={s.icon} active={active === s.id} /> {s.label}
        </a>
      ))}
    </nav>
  );
}

// Online status: whether others see the green dot when you're on Brazework (kept per browser).
export function OnlineStatusSetting() {
  const [off, setOff] = useAppearOffline();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">Show when I&apos;m online</div>
        <p className="mt-0.5 text-xs text-muted">Others see a green dot on your photo while Brazework is open. Off means you appear offline on this browser; you still see who&apos;s online.</p>
      </div>
      <button type="button" role="switch" aria-checked={!off} aria-label="Show when I'm online" onClick={() => setOff(!off)} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", off ? "bg-raised" : "bg-emerald-500")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", off ? "left-0.5" : "left-[22px]")} />
      </button>
    </div>
  );
}
