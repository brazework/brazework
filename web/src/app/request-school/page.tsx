import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { RequestSchoolForm } from "./form";

export const metadata: Metadata = { title: "Request your school", description: "Ask Forge to recognize your school's email." };

// For students whose school email isn't recognized yet (no .edu or .ac.uk domain).
export default function RequestSchoolPage({ searchParams }: PageProps<"/request-school">) {
  return (
    <main className="min-h-dvh bg-bg text-text">
      <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
        <Link href="/" aria-label="Forge home"><Logo /></Link>
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">Request your school</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Students sign up with their school email, so clubs and companies know they&apos;re real. If your school&apos;s email isn&apos;t recognized yet, tell us and we&apos;ll add it.</p>
        <div className="mt-8">
          {/* No empty form while the email's domain is read from the link: it would flash, then refill. */}
          <Suspense fallback={<div className="h-72 shimmer rounded-3xl" aria-busy="true" />}>
            <WithDomain searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function WithDomain({ searchParams }: { searchParams: PageProps<"/request-school">["searchParams"] }) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email : "";
  return <RequestSchoolForm domain={email.includes("@") ? email.split("@")[1].toLowerCase().slice(0, 120) : ""} />;
}
