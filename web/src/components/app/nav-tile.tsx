import { Ember } from "@/components/ember/ember";
import { cn } from "@/lib/forge";

// A sidebar icon on its own small glass tile (globals.css .nav-tile). The current page's tile fills
// with the accent gradient and glows; Copilot shows the Ember orb instead of an icon.
export function NavTile({ icon: Icon, active = false, ember = false }: { icon?: React.ComponentType<{ className?: string }>; active?: boolean; ember?: boolean }) {
  if (ember) return <span className="relative grid size-8 shrink-0 place-items-center transition duration-200 group-hover:-translate-y-px"><Ember size={26} mood={active ? "happy" : "idle"} /></span>;
  return (
    <span className={cn("relative grid size-8 shrink-0 place-items-center rounded-[10px] transition duration-200 group-hover:-translate-y-px", active ? "nav-tile-on" : "nav-tile text-text-2 group-hover:text-text")}>
      {Icon && <Icon className="size-[17px]" />}
    </span>
  );
}
