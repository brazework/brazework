"use client";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui";
import { Ember } from "@/components/ember/ember";
import { reportError } from "@/lib/sentry";

// A section that failed to load (redesign 2026-11): the error stays inside the page, under the
// sidebar and the Ask Jig bar, so the rest of the app is still one click away. A deploy that
// replaced this tab's scripts reloads once, as the root error page does.
const isStaleDeploy = (e: Error) => e.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(e.message);

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleDeploy(error)) {
      try {
        if (sessionStorage.getItem("forge:reloaded") !== location.pathname) { sessionStorage.setItem("forge:reloaded", location.pathname); location.reload(); return; }
      } catch {}
    }
    console.error(error);
    reportError(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto mt-6 flex max-w-xl flex-col items-start gap-4 rounded-xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
      <Ember size={52} mood="sleepy" />
      <div className="min-w-0 flex-1">
        <h1 className="font-semibold">This part didn&apos;t load.</h1>
        <p className="mt-1 text-sm text-muted">Nothing you saved is lost. Try again, or open another section from the sidebar.</p>
        {error.digest && <p className="mt-1.5 font-mono text-xs text-faint">Ref {error.digest}</p>}
      </div>
      <Button onClick={reset} variant="outline"><RotateCcw className="size-4" /> Try again</Button>
    </div>
  );
}
