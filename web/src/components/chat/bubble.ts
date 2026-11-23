import { cn } from "@/lib/forge";

// One look for every chat bubble (direct and group chats). Yours: the accent fill. Theirs: a flat soft
// surface fill. No borders or shadows, so a thread reads clean in light and dark. Round, with a tighter corner on
// the sender's side: at the foot of every bubble, and at the top too when it continues a run, so a run
// reads as one block along that edge.
export function bubbleCls({ mine, joinsPrev, pending }: { mine: boolean; joinsPrev?: boolean; joinsNext?: boolean; pending?: boolean }) {
  return cn(
    "px-3.5 py-2 text-[15px] leading-[1.45] whitespace-pre-wrap break-words transition-opacity",
    mine ? "bg-accent-grad text-on-accent" : "bg-surface-2 text-text",
    "rounded-[20px]",
    mine ? cn("rounded-br-[8px]", joinsPrev && "rounded-tr-[8px]") : cn("rounded-bl-[8px]", joinsPrev && "rounded-tl-[8px]"),
    pending && "opacity-60",
  );
}

// The day line between messages.
export const dayPillCls = "rounded-full bg-surface-2 px-3 py-0.5 text-[11px] font-medium text-faint";
