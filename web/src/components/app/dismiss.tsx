"use client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/forge";
import { DISMISS_PREFIX } from "@/lib/dismiss";

// Hides a guidance card (the feed's first-five-minutes checklist, profile strength) for good, in this
// browser. A cookie, not localStorage, so the server leaves the card out and it never flashes on load.
export function DismissButton({ id, label, className }: { id: string; label: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={pending}
      onClick={() => {
        document.cookie = `${DISMISS_PREFIX}${id}=1; path=/; max-age=31536000; samesite=lax`;
        start(() => router.refresh());
      }}
      className={cn("tap grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text active:scale-90 disabled:opacity-50", className)}
    >
      <X className="size-4" />
    </button>
  );
}
