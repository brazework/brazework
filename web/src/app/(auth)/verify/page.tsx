import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyPanel } from "../forms";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyPage({ searchParams }: PageProps<"/verify">) {
  return (
    <Suspense fallback={<VerifyPanel email="" />}>
      <WithParams searchParams={searchParams} />
    </Suspense>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/verify">["searchParams"] }) {
  const sp = await searchParams;
  return <VerifyPanel email={typeof sp.email === "string" ? sp.email : ""} />;
}
