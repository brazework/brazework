"use client";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { PostUpdate } from "./[id]/post-update";

// "Post update" on a workbench card: opens the update box right in the card, so you stay on
// Projects. The update still goes to the feed as a project post.
export function QuickUpdate({ projectId, title, attach = false }: { projectId: string; title: string; attach?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`qu-${projectId}`}
        className="bg-accent-grad inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold text-on-accent"
      >
        {open ? <X className="size-3.5" /> : <Plus className="size-3.5" />} {open ? "Close" : "Post update"}
      </button>
      {open && (
        <div id={`qu-${projectId}`} className="order-last w-full">
          <PostUpdate projectId={projectId} title={title} attach={attach} autoFocus className="mt-1 rounded-2xl border border-line bg-surface/60 p-3" />
        </div>
      )}
    </>
  );
}
