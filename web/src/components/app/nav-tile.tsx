import Image from "next/image";
import { Ember } from "@/components/ember/ember";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/forge";

// The one icon tile the sidebar uses everywhere (main places, your clubs, More, the top buttons):
// 32px, the same radius. Only the current page's tile is filled (the accent, with a glow); the rest
// are plain glyphs that lift on hover, so the eye lands on where you are. Copilot shows the Ember
// orb; a club shows its logo (or cover) cropped square, else its first letter in a hairline square.
export const TILE = "relative grid size-7 shrink-0 place-items-center rounded-md transition duration-200";

export function NavTile({ icon: Icon, active = false, ember = false, letter, image }: { icon?: React.ComponentType<{ className?: string }>; active?: boolean; ember?: boolean; letter?: string; image?: string | null }) {
  if (ember) return <span className={cn(TILE)}><Ember size={26} mood={active ? "happy" : "idle"} /></span>;
  // A club with a logo (or, failing that, a cover photo) shows it, cropped square; else its letter.
  if (image) return <span className={cn(TILE, "overflow-hidden border border-line", active && "ring-2 ring-text ring-offset-2 ring-offset-surface")}><Image src={mediaUrl(image)} alt="" fill sizes="28px" className="object-cover" /></span>;
  return (
    <span className={cn(TILE, active ? "nav-tile-on" : cn("text-text-2 group-hover:text-text", letter && "border border-line"))}>
      {letter ? <span className="text-[11px] font-semibold">{letter.slice(0, 1).toUpperCase()}</span> : Icon && <Icon className="size-4" />}
    </span>
  );
}
