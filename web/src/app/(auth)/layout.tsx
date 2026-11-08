import Link from "next/link";
import { RocketDrawing } from "@/components/landing/blueprint";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bp relative isolate grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="bp-grid absolute inset-0 -z-10" />
        <RocketDrawing className="absolute top-1/2 left-1/2 -z-10 w-[85%] max-w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-90" />
        <div className="flex h-full flex-col justify-between p-12">
          <Link href="/" aria-label="Forge home"><Logo /></Link>
          <blockquote className="max-w-md">
            <p className="text-4xl leading-tight font-semibold tracking-tight">
              Built by clubs. <span className="text-accent">Proven by work.</span>
            </p>
            <footer className="mt-4 font-mono text-xs text-faint">The professional network for STEM</footer>
          </blockquote>
        </div>
      </aside>
      <ThemeToggle className="absolute top-5 right-5" />
      <main className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <Link href="/" aria-label="Forge home" className="mb-10 inline-block lg:hidden"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
