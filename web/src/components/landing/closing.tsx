import Link from "next/link";
import { Logo } from "@/components/ui";

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
          <span className="text-sm text-faint">© <Year /> Brazework. Your work, signed by the people who saw it.</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
          <Link href="/login" className="hover:text-text">Log in</Link>
          <Link href="/signup" className="hover:text-text">Sign up</Link>
          <Link href="/#how" className="hover:text-text">How it works</Link>
          <Link href="/signup?goal=job" className="hover:text-text">For professionals</Link>
          <Link href="/for/students" className="hover:text-text">For students</Link>
          <Link href="/for/professionals" className="hover:text-text">For professionals</Link>
          <Link href="/for/clubs" className="hover:text-text">For clubs</Link>
          <Link href="/schools" className="hover:text-text">For schools</Link>
          <Link href="/pricing" className="hover:text-text">Pricing</Link>
          <Link href="/ai" className="hover:text-text">Connect your AI</Link>
          <Link href="/#pilot" className="hover:text-text">Start a pilot</Link>
          <Link href="/privacy" className="hover:text-text">Privacy</Link>
          <a href="#top" className="hover:text-text">Back to top</a>
        </nav>
      </div>
    </footer>
  );
}
