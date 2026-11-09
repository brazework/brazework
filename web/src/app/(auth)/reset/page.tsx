import type { Metadata } from "next";
import { Suspense } from "react";
import { getViewer } from "@/lib/supabase/server";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the reset email via /auth/callback?next=/reset, which signs the person in first.
export default function ResetPage() {
  return (
    <Suspense fallback={<div className="h-72 shimmer rounded-3xl" aria-busy="true" />}>
      <Reset />
    </Suspense>
  );
}

async function Reset() {
  const { user } = await getViewer();
  return <ResetForm signedIn={Boolean(user)} />;
}
