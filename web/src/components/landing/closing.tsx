import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button, Logo } from "@/components/ui";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="bp-grid relative isolate overflow-hidden border-b border-line py-28 sm:py-36">
      <Reveal className="mx-auto flex max-w-3xl flex-col items-center px-6 text-center">
        <h2 className="text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.98] font-semibold tracking-[-0.04em]">
          Stop describing it.
          <br />
          <span className="text-accent">Build it on Forge.</span>
        </h2>
        <p className="mt-6 max-w-xl text-lg text-muted">Sign up with your university or work email, pick the fields you care about, and post the first thing you&apos;re building.</p>
        <div className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
          <Button href="/signup" size="lg" className="rounded-md">
            Create your free account <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Button>
          <Button href="#founding" variant="outline" size="lg" className="rounded-md">Bring your club</Button>
        </div>
      </Reveal>
    </section>
  );
}

// Cached so the landing page can still prerender (Cache Components forbids a bare new Date()).
async function Year() {
  "use cache";
  return new Date().getFullYear();
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-10">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-sm text-faint">© <Year /> Forge. Built for the people who build.</span>
        </div>
        <nav className="flex gap-6 text-sm text-muted">
          <Link href="/login" className="hover:text-text">Log in</Link>
          <Link href="/signup" className="hover:text-text">Sign up</Link>
          <a href="#founding" className="hover:text-text">Founding clubs</a>
          <a href="#top" className="hover:text-text">Back to top ↑</a>
        </nav>
      </div>
    </footer>
  );
}
