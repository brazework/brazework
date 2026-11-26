"use client";
import { ChevronDown, Download, Ban, CircleUser, HelpCircle, KeyRound, Mail, MessageSquare, Palette, Plug, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { NavTile } from "@/components/app/nav-tile";
import { useAppearOffline } from "@/components/presence/presence";
import { cn } from "@/lib/forge";

const GROUPS = [
  { label: "Personal", sections: [
    { id: "profile", label: "Profile", icon: CircleUser },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "email", label: "Email", icon: Mail },
  ] },
  { label: "Privacy", sections: [
    { id: "messaging", label: "Messaging and privacy", icon: MessageSquare },
    { id: "blocked", label: "Blocked people", icon: Ban },
  ] },
  { label: "Tools", sections: [
    { id: "ember", label: "Torch and your data", icon: Sparkles },
    { id: "ai-tools", label: "Your tools", icon: Plug },
  ] },
  { label: "Account and support", sections: [
    { id: "account", label: "Account", icon: KeyRound },
    { id: "data", label: "Your data", icon: Download },
    { id: "help", label: "Help", icon: HelpCircle },
  ] },
] as const;

export function SettingsNav({ email, tools }: { email: boolean; tools: boolean }) {
  const groups = GROUPS.map(({ label, sections }) => ({
    label,
    sections: [...sections].filter(({ id }) => (id !== "email" || email) && (id !== "ai-tools" || tools)),
  }));
  const [active, setActive] = useState("profile");

  useEffect(() => {
    const sections = GROUPS.flatMap(({ sections }) => [...sections]);
    const elements = sections.flatMap(({ id }) => {
      const element = document.getElementById(id);
      return element ? [element] : [];
    });
    const selectHash = () => {
      const target = document.getElementById(window.location.hash.slice(1));
      const section = elements.find((element) => target && element.contains(target));
      setActive(section?.id ?? "profile");
    };
    selectHash();
    // Settings streams in after the shell, so the target may not exist at initial navigation.
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    window.addEventListener("hashchange", selectHash);
    const observer = new IntersectionObserver((entries) => {
      const nearest = entries.filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (nearest) setActive(nearest.target.id);
    }, { rootMargin: "-22% 0px -63% 0px" });
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", selectHash);
    };
  }, [email, tools]);

  return (
    <nav aria-label="Settings sections" className="sticky top-[var(--m-top)] z-20 self-start md:top-0 lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto">
      <div className="rounded-2xl border border-line bg-surface p-3 lg:hidden">
        <label htmlFor="settings-jump" className="mb-1.5 block text-xs font-medium text-muted">Jump to a setting</label>
        <div className="relative">
          <select id="settings-jump" value={active} onChange={(event) => {
            const section = event.target.value;
            setActive(section);
            window.location.hash = section;
          }} className="h-11 w-full appearance-none rounded-xl border border-line bg-surface-2 pl-3 pr-9 text-sm text-text">
            {groups.map(({ label, sections }) => (
              <optgroup key={label} label={label}>{sections.map(({ id, label: title }) => <option key={id} value={id}>{title}</option>)}</optgroup>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted" />
        </div>
      </div>
      <div className="hidden space-y-4 rounded-2xl border border-line bg-surface p-3 lg:block">
        {groups.map(({ label, sections }) => (
          <div key={label}>
            <p className="mb-1 px-2 text-xs font-medium text-muted">{label}</p>
            <ul className="space-y-0.5">
              {sections.map(({ id, label: title, icon }) => (
                <li key={id}>
                  <a href={`#${id}`} aria-current={active === id ? "location" : undefined} className={cn("group flex min-h-10 items-center gap-2 rounded-xl px-2 py-1.5 text-sm transition", active === id ? "nav-pill font-medium text-text" : "text-text-2 hover:bg-hover/60 hover:text-text")}>
                    <NavTile icon={icon} active={active === id} /> {title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
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
