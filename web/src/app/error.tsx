"use client";
import { ThemeToggle } from "@/components/theme-toggle";
import { RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { Button, Logo } from "@/components/ui";
import { Ember } from "@/components/ember/ember";

// Any unexpected error below the root layout lands here instead of a blank page.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
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
          <Button href="/" variant="outline">Back to Forge</Button>
        </div>
      </div>
    </main>
  );
}
