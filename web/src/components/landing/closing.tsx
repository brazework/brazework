import Link from "next/link";
import { Button, Logo } from "@/components/ui";
import { BuildStart } from "./build-start";

export function FinalCta() {
  return (
    <section id="join" className="scroll-mt-20 border-t border-line bg-surface-2/60 py-24 sm:py-36">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 text-center sm:px-6">
        <h2 className="text-[clamp(2.5rem,6vw,4.75rem)] leading-[0.96] font-semibold tracking-[-0.045em]">
          Built something?
          <br />
          Put it on the record.
        </h2>
        <p className="mt-6 max-w-xl text-lg text-muted">Log the first thing you&apos;ve built and ask whoever saw it to sign it: your club, a professor, a manager. It takes a few minutes, and it&apos;s free for you and your club.</p>
        <BuildStart />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
          <span>Free for everyone who builds</span>
          <Button href="#founding" variant="outline">Bring your club</Button>
        </div>
      </div>
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-sm text-faint">© <Year /> Brazework. Built for the people who build.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/login" className="hover:text-text">Log in</Link>
          <Link href="/signup" className="hover:text-text">Sign up</Link>
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
          <Link href="/ai" className="hover:text-text">Connect your AI</Link>
          <Link href="/#founding" className="hover:text-text">Founding clubs</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <a href="#top" className="hover:text-text">Back to top</a>
        </nav>
      </div>
    </footer>
  );
}
