import Link from "next/link";
import { ProfileCard } from "@/components/landing/profile-card";
import { PROFESSIONS } from "@/components/landing/professions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-surface-2/60 lg:block">
        <div className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[460px] w-[460px] -translate-x-1/2 rounded-full opacity-25 blur-3xl" style={{ background: PROFESSIONS[0].grad }} aria-hidden="true" />
        <div className="flex h-full flex-col justify-between gap-10 p-12">
          <Link href="/" aria-label="Brazework home"><Logo /></Link>
          <div className="relative mx-auto w-full max-w-[340px]" aria-hidden="true">
            <ProfileCard p={PROFESSIONS[4]} className="absolute top-6 left-10 -rotate-6 opacity-60" />
            <ProfileCard p={PROFESSIONS[0]} className="relative rotate-2" />
          </div>
          <blockquote className="max-w-md">
            <p className="text-4xl leading-tight font-semibold tracking-tight">
              Built by clubs. <span className="text-grad">Proven by work.</span>
            </p>
            <footer className="mt-4 text-sm text-faint">The network for STEM builders: engineering, science, math and computing</footer>
          </blockquote>
        </div>
      </aside>
      <ThemeToggle className="absolute top-5 right-5" />
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="Brazework home" className="mb-10 inline-block lg:hidden"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
