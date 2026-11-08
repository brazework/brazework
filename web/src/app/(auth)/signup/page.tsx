import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "../forms";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <Suspense fallback={<SignupForm />}>
      <WithInvite searchParams={searchParams} />
    </Suspense>
  );
}

// /signup?invite=<code> (from a club invite link): show which club, and remember it through sign-up.
async function WithInvite({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const invite = (await searchParams).invite;
  if (typeof invite !== "string" || !/^[0-9a-f]{16}$/.test(invite)) return <SignupForm />;
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_preview", { p_code: invite });
  const name = (data as { name?: string } | null)?.name;
  return name ? <SignupForm invite={invite} clubName={name} /> : <SignupForm />;
}
