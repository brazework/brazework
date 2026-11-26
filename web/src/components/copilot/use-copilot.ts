"use client";
import { useRef, useState } from "react";
import type { CopilotRequest } from "@/lib/copilot";
import { parseStream, type Choice, type Proposal, type Segment } from "@/lib/copilot-agent";

// `choice`: answers Torch offered as buttons, when the request said the page can show them.
export type OnText = (full: string, tools: string[], proposals: Proposal[], segments: Segment[], choice: Choice | null) => void;

// Calls /api/copilot and hands back the text as it streams in, plus which lookups Copilot ran
// (tool frames are split out of the stream by parseStream) and the answer in arrival order.
// The network delivers text in bursts, several chunks a frame; handing each one to React re-rendered
// the chat for every chunk. Updates are batched to one per animation frame (redesign 2026-11), and the
// last one is always delivered when the stream ends.
export function useCopilot() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  // `onRefused`: a free follow turn wasn't given (none left today); the page offers it for a credit
  // instead, so it isn't shown as an error.
  const run = async (req: CopilotRequest, onText: OnText, { onRefused }: { onRefused?: () => void } = {}) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError("");
    let raw = "";
    let full = "";
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (ctrl.signal.aborted) return;
      const parsed = parseStream(raw);
      full = parsed.text;
      onText(full, parsed.tools, parsed.proposals, parsed.segments, parsed.choice);
    };
    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429 && (j as { follow?: string }).follow === "refused" && onRefused) { onRefused(); return null; }
        setError((j as { message?: string }).message ?? "Torch couldn't answer. Try again.");
        return null;
      }
      const left = res.headers.get("X-Copilot-Remaining");
      if (left !== null) setRemaining(Number(left));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) cancelAnimationFrame(frame);
      flush();
      return full;
    } catch (e) {
      if (frame) cancelAnimationFrame(frame);
      if ((e as Error).name !== "AbortError") setError("Torch couldn't answer. Check your connection.");
      return null;
    } finally {
      if (abort.current === ctrl) setBusy(false);
    }
  };
  const stop = () => abort.current?.abort();
  return { run, stop, busy, error, remaining };
}
