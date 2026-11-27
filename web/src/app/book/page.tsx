import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Footer } from "@/components/landing/closing";
import { ThemeChrome } from "@/components/theme-chrome";
import { Logo } from "@/components/ui";
import { SALES, SALES_KINDS, type SalesKind } from "@/lib/pricing";
import { getViewer } from "@/lib/supabase/server";
import { BookForm } from "./book-form";

export const metadata: Metadata = { title: "Book a pilot", description: "School pilots, search seats, chapter sponsorships and challenges, set up with the founders." };

// /book?kind=talent|chapter|challenge|school|plus[&club=<id>]: a request for the founders, from the
// pricing cards, a club's "Sponsor this chapter" and Find builders. Signed in, so it carries the
// account's email; signed out, it asks to log in and comes back here.
export default function BookPage({ searchParams }: PageProps<"/book">) {
  return (
    <div className="landing min-h-dvh">
      <ThemeChrome landing />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" aria-label="Brazework home"><Logo /></Link>
        <Link href="/pricing" className="text-sm text-muted hover:text-text">Pricing</Link>
      </header>
      <main className="mx-auto max-w-xl px-5 pt-8 pb-24 sm:px-6">
        <Suspense fallback={<div className="h-96 shimmer rounded-3xl" aria-busy="true" />}>
          <Book searchParams={searchParams} />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

async function Book({ searchParams }: { searchParams: PageProps<"/book">["searchParams"] }) {
  const sp = await searchParams;
  const kind: SalesKind = (SALES_KINDS as readonly string[]).includes(String(sp.kind)) ? (sp.kind as SalesKind) : "talent";
  const club = typeof sp.club === "string" && /^[A-Za-z0-9-]{1,64}$/.test(sp.club) ? sp.club : "";
  const { supabase, user } = await getViewer();
  const here = `/book?kind=${kind}${club ? `&club=${club}` : ""}`;
  const { data: c } = club && user ? await supabase.from("communities").select("name").eq("id", club).maybeSingle() : { data: null };
  return (
    <>
      <h1 className="text-[clamp(2rem,5vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{kind === "school" ? "Start a pilot" : kind === "plus" ? "Plus waitlist" : kind === "chapter" ? "Sponsor a chapter" : "Book a pilot"}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">Tell us what you&apos;d like. The founders reply within a day and set it up with you.</p>
      <div className="mt-8">
        {user ? (
          <BookForm kind={kind} club={club} clubName={(c?.name as string | undefined) ?? ""} email={user.email ?? ""} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <p className="font-medium">{SALES[kind].label}</p>
            <p className="mt-1 text-sm text-muted">{SALES[kind].ask} Log in or create a free account first, so we know where to reply. No forms to fill twice.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:opacity-90">Log in to continue</Link>
              <Link href="/signup" className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm hover:bg-hover">Create an account</Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
