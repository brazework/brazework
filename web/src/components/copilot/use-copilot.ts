"use client";
import { useRef, useState } from "react";
import type { CopilotRequest } from "@/lib/copilot";
import { parseStream } from "@/lib/copilot-agent";

// Calls /api/copilot and hands back the text as it streams in, plus which lookups Copilot ran
// (tool frames are split out of the stream by parseStream).
export function useCopilot() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = async (req: CopilotRequest, onText: (full: string, tools: string[]) => void) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setError("");
    let raw = "";
    let full = "";
    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        setError((j as { message?: string }).message ?? "Copilot couldn't answer. Try again.");
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
        const parsed = parseStream(raw);
        full = parsed.text;
        onText(full, parsed.tools);
      }
      return full;
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError("Copilot couldn't answer. Check your connection.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const stop = () => abort.current?.abort();
  return { run, stop, busy, error, remaining };
}
