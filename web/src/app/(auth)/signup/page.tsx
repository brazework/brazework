import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { enabledProviders } from "@/lib/auth-providers";
import { isGoalKind } from "@/lib/goals";
import type { ProviderId } from "@/lib/oauth";
import { SignupForm } from "../forms";
import { RememberBuild } from "./remember-build";
import { RememberGoal } from "./remember-goal";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<SignupForm />}>
      <WithInvite searchParams={searchParams} />
    </Suspense>
  );
}

// /signup?invite=<code> (from a club invite link): show which club, and remember it through sign-up.
// /signup?goal=<kind> (from the landing page's goal picker): remembered for the goal card.
// /signup?build=<line> (from the landing page's "What are you building?" box): remembered for Today.
async function WithInvite({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const [sp, providers] = await Promise.all([searchParams, enabledProviders()]);
  const oauth = typeof sp.oauth === "string" ? sp.oauth : undefined;
  const goal = isGoalKind(sp.goal) ? <RememberGoal goal={sp.goal} /> : null;
  const build = typeof sp.build === "string" && sp.build.trim() ? <RememberBuild build={sp.build} /> : null;
  return <>{goal}{build}<InviteForm invite={sp.invite} providers={providers} oauth={oauth} /></>;
}

async function InviteForm({ invite, providers, oauth }: { invite: string | string[] | undefined; providers: ProviderId[]; oauth?: string }) {
  if (typeof invite !== "string" || !/^[0-9a-f]{16}$/.test(invite)) return <SignupForm providers={providers} oauth={oauth} />;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_code: invite });
  const name = (data as { name?: string } | null)?.name;
  return name ? <SignupForm invite={invite} clubName={name} providers={providers} oauth={oauth} /> : <SignupForm providers={providers} oauth={oauth} />;
}
