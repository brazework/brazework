import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-6 text-center">
      <div className="bg-blueprint absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="flex flex-col items-center">
        <Logo />
        <p className="mt-12 font-mono text-sm tracking-[0.2em] text-accent">404</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">
          Nothing forged <span className="text-shine">here yet.</span>
        </h1>
        <p className="mt-4 max-w-md text-muted">That page doesn&apos;t exist, or it moved. The work is this way.</p>
        <div className="mt-8 flex gap-3">
          <Button href="/">Back to Forge</Button>
          <Button href="/feed" variant="outline">Open your feed</Button>
        </div>
      </div>
    </main>
  );
}
