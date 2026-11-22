"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { ASSISTANTS, PUBLIC_EXPLAIN_PROMPT } from "@/lib/tool-setup";

/** Public marketing explanation only; account connection lives on /ai. */
export function PublicAiCard() {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PUBLIC_EXPLAIN_PROMPT);
      setStatus("Prompt copied. If your assistant opens with an empty box, paste it there.");
    } catch {
      setStatus("Copy is unavailable. Open Read the prompt below, then select and copy the text.");
    }
  };

  return (
    <div className="min-w-0 rounded-[1.25rem] border border-line bg-surface p-5 sm:p-6">
      <h3 className="text-lg font-semibold tracking-tight">Choose your assistant</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">Your assistant may ask you to sign in.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {ASSISTANTS.map((assistant) => (
          <a key={assistant.id} href={assistant.open(PUBLIC_EXPLAIN_PROMPT)} target="_blank" rel="noopener noreferrer" onClick={() => void copy()}
            className="inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-medium transition hover:bg-hover">
            Ask {assistant.name}
          </a>
        ))}
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-hover hover:text-text">
          <Copy aria-hidden="true" className="size-4" /> Copy prompt
        </button>
      </div>
      <p role="status" className="mt-3 text-sm text-muted">{status || "If the question doesn’t appear in your assistant, use Copy prompt and paste it."}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium underline-offset-4 hover:underline">Read the prompt</summary>
        <p className="mt-3 rounded-lg bg-surface-2 p-3 text-sm leading-relaxed whitespace-pre-wrap text-text-2">{PUBLIC_EXPLAIN_PROMPT}</p>
      </details>
    </div>
  );
}
