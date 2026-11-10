import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";

// The one icon tile the sidebar uses everywhere (main places, your clubs, More, the top buttons):
// 32px, the same radius, on small glass (globals.css .nav-tile). The current page's tile fills with
// the accent and glows. Copilot shows the Ember orb; a club shows its first letter.
export const TILE = "relative grid size-8 shrink-0 place-items-center rounded-[10px] transition duration-200";

export function NavTile({ icon: Icon, active = false, ember = false, letter }: { icon?: React.ComponentType<{ className?: string }>; active?: boolean; ember?: boolean; letter?: string }) {
  if (ember) return <span className={cn(TILE, "group-hover:-translate-y-px")}><Ember size={26} mood={active ? "happy" : "idle"} /></span>;
  return (
    <span className={cn(TILE, "group-hover:-translate-y-px", active ? "nav-tile-on" : "nav-tile text-text-2 group-hover:text-text")}>
      {letter ? <span className="text-[13px] font-semibold">{letter.slice(0, 1).toUpperCase()}</span> : Icon && <Icon className="size-[17px]" />}
    </span>
  );
}
