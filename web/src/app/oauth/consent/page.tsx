import type { Metadata } from "next";
import { Check, FileText, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { CONSENT_MODES } from "./modes";
import { decide } from "./actions";

export const metadata: Metadata = { title: "Connect an AI assistant" };

// /oauth/consent?authorization_id=…: Supabase Auth's OAuth 2.1 server sends the member here when an AI
// assistant (Claude, Cursor, VS Code…) asks to connect to their Brazework (one-click connect,
// lib/mcp-oauth.ts). They see which app, what it will be able to do, and say yes or no.
export default function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  return (
    <div className="relative isolate min-h-dvh">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="mx-auto max-w-md px-6 py-14">
        <Logo />
        <div className="mt-12">
          <Suspense fallback={<div className="h-80 shimmer rounded-3xl" aria-busy="true" />}>
            <Consent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}


async function Consent({ searchParams }: { searchParams: PageProps<"/oauth/consent">["searchParams"] }) {
  const id = (await searchParams).authorization_id;
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(id)) return <Problem text="This link to connect an assistant isn't valid. Start again from your assistant." />;
  const { supabase, user, profile } = await getViewer();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);
  if (!profile?.onboarded) return <Problem text="Finish setting up your Brazework account first, then connect your assistant again." href="/onboarding" cta="Finish setting up" />;
  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <Problem text="This request to connect has expired or was already answered. Start again from your assistant." />;
  // Already approved before: straight back to the assistant.
  if (!("client" in data)) redirect(data.redirect_url);
  const app = data.client.name || "An AI assistant";
  // Approve in chat (supabase/mcp-oauth-post.sql): until that step runs, every sign-in drafts.
  const choose = (await dbFeatures()).mcpOauthPost;
  let host = "";
  try { host = new URL(data.redirect_uri).host; } catch {}
  return (
    <section className="rounded-3xl border border-line bg-surface p-7 shadow-[var(--shadow)]">
      <span className="grid size-11 place-items-center rounded-2xl bg-text text-surface"><ShieldCheck className="size-5" /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Connect {app} to your Brazework?</h1>
      <p className="mt-2 text-sm text-muted">Signed in as <span className="text-text">{data.user.email}</span>{host ? <> · it returns to <span className="text-text">{host}</span></> : null}.</p>
      <p className="mt-6 flex gap-3 text-[15px] text-text-2"><FileText className="mt-0.5 size-4 shrink-0 text-accent" />It can read your Brazework: your profile, projects, clubs, events and notifications.</p>
      <form action={decide} className="mt-6">
        <input type="hidden" name="authorization_id" value={id} />
        {choose ? (
          <fieldset>
            <legend className="text-sm font-medium text-text">When it wants to add something to your record</legend>
            <div className="mt-3 flex flex-col gap-2">
              {CONSENT_MODES.map((m, i) => (
                <label key={m.value} className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 transition hover:bg-hover has-[:checked]:border-accent has-[:checked]:bg-surface-2">
                  <input type="radio" name="mode" value={m.value} defaultChecked={i === 0} className="mt-1 size-4 shrink-0 accent-accent" />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-text">{m.label}{i === 0 && <span className="ml-2 text-xs font-normal text-muted">Recommended</span>}</span>
                    <span className="mt-0.5 block text-sm text-muted">{m.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="text-[15px] text-text-2">It can leave drafts of posts and milestones that wait for you to approve in Brazework.</p>
        )}
        <p className="mt-4 text-sm text-muted">It can&apos;t sign or verify anything as you. Change this, or disconnect it, any time in Settings → Your tools.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button name="decision" value="approve" className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent-grad px-5 text-[15px] font-medium text-on-accent hover:opacity-90"><Check className="size-4" /> Connect</button>
          <button name="decision" value="deny" className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-[15px] hover:bg-hover"><X className="size-4" /> Not now</button>
        </div>
      </form>
    </section>
  );
}

function Problem({ text, href = "/settings/tools", cta = "Your tools" }: { text: string; href?: string; cta?: string }) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-7 shadow-[var(--shadow)]">
      <h1 className="text-xl font-semibold tracking-tight">Can&apos;t connect right now</h1>
      <p className="mt-2 text-sm text-muted">{text}</p>
      <Link href={href} className="mt-6 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm hover:bg-hover">{cta}</Link>
    </section>
  );
}
