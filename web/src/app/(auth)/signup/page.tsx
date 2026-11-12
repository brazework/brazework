import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { isGoalKind } from "@/lib/goals";
import { SignupForm } from "../forms";
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
async function WithInvite({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const sp = await searchParams;
  const goal = isGoalKind(sp.goal) ? <RememberGoal goal={sp.goal} /> : null;
  return <>{goal}<InviteForm invite={sp.invite} /></>;
}

async function InviteForm({ invite }: { invite: string | string[] | undefined }) {
  if (typeof invite !== "string" || !/^[0-9a-f]{16}$/.test(invite)) return <SignupForm />;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_code: invite });
  const name = (data as { name?: string } | null)?.name;
  return name ? <SignupForm invite={invite} clubName={name} /> : <SignupForm />;
}
