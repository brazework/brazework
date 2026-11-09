"use client";
import { AnimatePresence, motion } from "motion/react";
import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/forge";

// Copies a page's address (path on this site) and confirms with a check.
export function CopyLink({ path, label = "Copy link", className }: { path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`${location.origin}${path}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setFailed(true);
        }
      }}
      className={cn("inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-4 text-sm transition hover:bg-hover active:scale-95", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={copied ? "y" : "n"} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ duration: 0.15 }} className="inline-flex items-center gap-1.5">
          {copied ? <><Check className="size-4 text-ok" /> Copied</> : <><Link2 className="size-4" /> {failed ? "Copy failed" : label}</>}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
