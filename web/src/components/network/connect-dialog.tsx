import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, inputCls } from "@/components/ui";
import { cn } from "@/lib/forge";

// The optional note that goes with a connection request (askNote() in public/js/network.js).
// A native <dialog>: focus is trapped, Escape and the backdrop cancel.
export function ConnectDialog({ firstName, open, onClose, onSend }: { firstName: string; open: boolean; onClose: () => void; onSend: (note: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState("");
  const titleId = useId();
  const noteId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => {
    setNote("");
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-3xl border border-line bg-surface p-0 text-text shadow-[var(--shadow)] backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
    >
      {open && (
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            const value = note.trim();
            setNote("");
            onSend(value);
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">Connect with {firstName || "this member"}</h2>
            <button type="button" onClick={close} aria-label="Close" className="grid size-8 shrink-0 place-items-center rounded-full text-faint transition hover:bg-hover hover:text-text">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteId} className="text-sm font-medium text-text-2">
              Add a note <span className="font-normal text-faint">(optional)</span>
            </label>
            <textarea
              id={noteId}
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              rows={4}
              placeholder="Say how you know each other or what you'd like to talk about"
              aria-describedby={`${noteId}-count`}
              className={cn(inputCls, "h-auto resize-none py-3 leading-relaxed")}
            />
            <span id={`${noteId}-count`} className={cn("self-end font-mono text-[11px] tabular-nums", note.length >= 280 ? "text-danger" : "text-faint")}>{note.length} / 300</span>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit">Send request</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
