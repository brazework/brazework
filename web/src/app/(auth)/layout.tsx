import Link from "next/link";
import { AppMoment } from "@/components/auth/app-moment";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

// The logo links home without prefetching it: someone signing in rarely goes back to the landing page,
// and its prefetch kept the network busy for seconds after a sign-in returned (y-oauth.cjs).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate grid grid-cols-1 min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface-2/60 lg:block">
        <div className="flex h-full flex-col justify-between gap-10 p-12">
          <Link href="/" prefetch={false} aria-label="Brazework home"><Logo /></Link>
          {/* The app's one moment, drawn with its own cards (components/auth/app-moment.tsx). */}
          <div aria-hidden="true"><AppMoment /></div>
          <div className="max-w-md">
            <p className="text-[2.5rem] leading-[1.08] font-semibold tracking-tight text-balance">Your work, signed by the people who saw it.</p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">Log what you finished, with the proof. A coworker, a client, a professor or your club signs it, and it goes with you wherever you go next. Your AI can write it up for you, and nothing is saved until you say yes.</p>
          </div>
        </div>
      </aside>
      <ThemeToggle className="absolute top-5 right-5" />
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link href="/" prefetch={false} aria-label="Brazework home" className="mb-10 inline-block lg:hidden"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
