import type { Metadata } from "next";
import { Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, Logo } from "@/components/ui";
import { membersLabel } from "@/lib/communities";
import { createClient, getViewer } from "@/lib/supabase/server";
import { CommunityBadge } from "../../(app)/communities/_components/badge";
import { JoinButton } from "./join-button";

export const metadata: Metadata = { title: "You're invited", description: "You've been invited to a club on Forge, home base for university STEM clubs." };

type Preview = { community_id: string; name: string; about: string; field: string; privacy: string; member_count: number };

// /join/<code>: a club invite. Works signed out, so the link can go to people without an account yet.
export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="relative isolate grid min-h-dvh place-items-center px-6 py-16">
      <div className="app-backdrop absolute inset-0 -z-10" />
      <ThemeToggle className="absolute top-5 right-5" />
      <div className="w-full max-w-md">
        <Link href="/" aria-label="Forge home" className="mb-10 inline-block"><Logo /></Link>
        <Suspense fallback={<div className="h-80 shimmer rounded-3xl" />}>
          <Invite params={params} />
        </Suspense>
      </div>
    </main>
  );
}

async function Invite({ params }: { params: PageProps<"/join/[code]">["params"] }) {
  const { code } = await params;
  const valid = /^[0-9a-f]{16}$/.test(code);
  const supabase = await createClient();
  const { data } = valid ? await supabase.rpc("invite_preview", { p_code: code }) : { data: null };
  const c = data as Preview | null;
  if (!c)
    return (
      <div className="rounded-3xl border border-line bg-surface/80 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">This invite isn&apos;t working</h1>
        <p className="mt-2 text-muted">It may have expired, reached its limit, or been turned off. Ask whoever sent it for a new link.</p>
        <Button href="/" variant="outline" className="mt-6">Visit Forge</Button>
      </div>
    );
  const { user } = await getViewer();
  return (
    <div className="rounded-3xl border border-line bg-surface/80 p-8 shadow-[var(--shadow)] backdrop-blur">
      <div className="font-mono text-[11px] tracking-[0.18em] text-faint uppercase">You&apos;re invited</div>
      <div className="mt-5 flex items-center gap-4">
        <CommunityBadge id={c.community_id} name={c.name} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{c.name}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><Users className="size-4" /> {membersLabel(c.member_count)} · {c.field}</p>
        </div>
      </div>
      {c.about && <p className="mt-5 text-[15px] leading-relaxed text-text-2">{c.about}</p>}
      <div className="mt-8 flex flex-col gap-3">
        {user ? (
          <JoinButton code={code} name={c.name} />
        ) : (
          <>
            <Button href={`/signup?invite=${code}`} size="lg">Create your account to join</Button>
            <Button href={`/login?next=${encodeURIComponent(`/join/${code}`)}`} variant="outline" size="lg">I already have an account</Button>
          </>
        )}
      </div>
      <p className="mt-6 text-xs text-faint">Forge is home base for university STEM clubs: talk and plan with your club, show what you build, and let your club verify it so it gets you noticed.{c.privacy === "approval" ? " This invite skips the club's usual approval." : ""}</p>
    </div>
  );
}
