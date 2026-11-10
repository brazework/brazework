"use client";
import { ThemeToggle } from "@/components/theme-toggle";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, Logo } from "@/components/ui";
import { Ember } from "@/components/ember/ember";

// Any unexpected error below the root layout lands here instead of a blank page.
// A new version deployed while this tab was open: its old script files are gone, so the first
// click after the deploy fails to load one. Reload once to pick up the new version (a flag in
// sessionStorage stops it from looping if something else is wrong).
const isStaleDeploy = (e: Error) => e.name === "ChunkLoadError" || /Failed to load chunk|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/i.test(e.message);

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleDeploy(error)) {
      try {
        if (sessionStorage.getItem("forge:reloaded") !== location.pathname) { sessionStorage.setItem("forge:reloaded", location.pathname); location.reload(); return; }
      } catch {}
    }
    console.error(error);
  }, [error]);
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-6 text-center">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="flex flex-col items-center">
        <Logo />
        <Ember size={112} mood="sleepy" className="mt-10" label="Ember, tired" />
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Something overheated.</h1>
        <p className="mt-4 max-w-md text-muted">That didn&apos;t work, and it&apos;s on us. Try again, and if it keeps happening, tell us what you were doing.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-faint">Ref {error.digest}</p>}
        <div className="mt-8 flex gap-3">
          <Button onClick={reset}><RotateCcw className="size-4" /> Try again</Button>
          <Button href="/" variant="outline">Back to Brazework</Button>
        </div>
      </div>
    </main>
  );
}
