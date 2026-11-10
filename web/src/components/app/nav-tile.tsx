import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";

// The one icon tile the sidebar uses everywhere (main places, your clubs, More, the top buttons):
// 32px, the same radius. Only the current page's tile is filled (the accent, with a glow); the rest
// are plain glyphs that lift on hover, so the eye lands on where you are. Copilot shows the Ember
// orb; a club shows its first letter in a hairline square.
export const TILE = "relative grid size-8 shrink-0 place-items-center rounded-[10px] transition duration-200";

export function NavTile({ icon: Icon, active = false, ember = false, letter }: { icon?: React.ComponentType<{ className?: string }>; active?: boolean; ember?: boolean; letter?: string }) {
  if (ember) return <span className={cn(TILE, "group-hover:-translate-y-px")}><Ember size={26} mood={active ? "happy" : "idle"} /></span>;
  return (
    <span className={cn(TILE, "group-hover:-translate-y-px", active ? "nav-tile-on" : cn("text-text-2 group-hover:text-text", letter && "border border-line"))}>
      {letter ? <span className="text-[12px] font-semibold">{letter.slice(0, 1).toUpperCase()}</span> : Icon && <Icon className="size-[18px]" />}
    </span>
  );
}
