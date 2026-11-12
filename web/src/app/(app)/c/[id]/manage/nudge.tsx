"use client";
import { Loader2, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { messageMember } from "@/lib/network";

// Opens a conversation with a quiet member, so the lead nudges them personally (the app never does).
export function NudgeButton({ uid, first }: { uid: string; first: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <button type="button" disabled={pending} title={error || `Message ${first}`} aria-label={`Message ${first}`}
      onClick={() => start(async () => { const r = await messageMember(uid); if (r && !r.ok) setError(r.message); })}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-medium transition hover:bg-hover disabled:opacity-50">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />} {error ? "Can't message" : "Nudge"}
    </button>
  );
}
