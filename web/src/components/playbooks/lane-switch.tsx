import { cn } from "@/lib/forge";
import { LANES, LANE_LABEL, type Lane } from "@/lib/lanes";

// Studying or Working: the two parts of a field's playbook (lib/lanes.ts). Two buttons, the chosen one
// pressed, drawn like the hero's chips: ink for the one picked. Used from client components only (the
// guide's LaneMoments, and Recipes in Settings → Your tools), which hold the choice.
export function LaneSwitch({ value, onChange, label = "Studying or working" }: { value: Lane; onChange: (lane: Lane) => void; label?: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex shrink-0 gap-1.5">
      {LANES.map((l) => (
        <button key={l} type="button" aria-pressed={l === value} onClick={() => onChange(l)}
          className={cn("inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium transition",
            l === value ? "border-text bg-text text-surface" : "border-line bg-surface text-text-2 hover:border-line-strong hover:text-text")}>
          {LANE_LABEL[l]}
        </button>
      ))}
    </div>
  );
}
