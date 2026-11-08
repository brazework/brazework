"use client";
import { X } from "lucide-react";
import { useEffect, useTransition } from "react";
import { clearNotification, markAllNotificationsRead } from "@/lib/activity";

// Marks everything read once the page is open (without re-rendering it, so "new" stays visible).
export function MarkRead() {
  useEffect(() => { void markAllNotificationsRead(); }, []);
  return null;
}

export function ClearButton({ ids }: { ids: number[] }) {
  const [pending, start] = useTransition();
  return (
    <button
      aria-label="Clear notification"
      disabled={pending}
      onClick={() => start(async () => { for (const id of ids) await clearNotification(id); })}
      className="relative z-10 grid size-8 shrink-0 place-items-center self-center rounded-full text-faint transition sm:opacity-0 sm:group-hover:opacity-100 hover:bg-raised hover:text-text focus-visible:opacity-100 disabled:opacity-50"
    >
      <X className="size-4" />
    </button>
  );
}
