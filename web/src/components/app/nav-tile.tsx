import Image from "next/image";
import { Ember } from "@/components/ember/ember";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/forge";

// (2026-11-26: no boxes. Icons are plain, in two tones; the current page is the row's glass highlight.)
// The one icon tile the sidebar uses everywhere (main places, your clubs, More, the top buttons):
// 32px, the same radius. Only the current page's tile is filled (the accent, with a glow); the rest
// are plain glyphs that lift on hover, so the eye lands on where you are. Copilot shows the Torch
// orb; a club shows its logo (or cover) cropped square, else its first letter in a hairline square.
export const TILE = "relative grid size-7 shrink-0 place-items-center rounded-md transition duration-200";

export function NavTile({ icon: Icon, active = false, ember = false, letter, image }: { icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>; active?: boolean; ember?: boolean; letter?: string; image?: string | null }) {
  if (ember) return <span className={cn(TILE)}><Ember size={26} mood={active ? "happy" : "idle"} /></span>;
  // A club with a logo (or, failing that, a cover photo) shows it, cropped square; else its letter.
  if (image) return <span className={cn(TILE, "overflow-hidden border border-line", active && "ring-2 ring-text ring-offset-2 ring-offset-surface")}><Image src={mediaUrl(image)} alt="" fill sizes="28px" className="object-cover" /></span>;
  return (
    <span className={cn(TILE, active ? "text-text" : "text-text-2 group-hover:text-text")}>
      {letter ? <span className={cn("grid size-5 place-items-center rounded-full text-[10px] font-semibold", active ? "bg-text text-bg" : "bg-[color-mix(in_oklab,var(--text)_8%,transparent)]")}>{letter.slice(0, 1).toUpperCase()}</span> : Icon && <Icon className="icon-duo size-[18px]" strokeWidth={active ? 2.1 : 1.8} />}
    </span>
  );
}
