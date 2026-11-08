import Link from "next/link";
import { SparkField } from "@/components/landing/spark-field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line lg:block">
        <div className="bg-blueprint absolute inset-0 -z-10" />
        <div className="absolute -bottom-40 -left-20 -z-10 size-[600px] rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
        <SparkField className="absolute inset-0 -z-10 size-full" />
        <div className="flex h-full flex-col justify-between p-12">
          <Link href="/" aria-label="Forge home"><Logo /></Link>
          <blockquote className="max-w-md">
            <p className="text-4xl leading-tight font-semibold tracking-tight">
              Proof of work <span className="text-shine">beats a résumé.</span>
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
