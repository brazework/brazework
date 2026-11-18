import type { Metadata } from "next";
import { Suspense } from "react";
import { enabledProviders } from "@/lib/auth-providers";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<LoginForm />}>
      <WithParams searchParams={searchParams} />
    </Suspense>
  );
}

async function WithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [sp, providers] = await Promise.all([searchParams, enabledProviders()]);
  return <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} confirmed={sp.confirmed === "1"} resetExpired={sp.reset === "expired"} providers={providers} oauth={typeof sp.oauth === "string" ? sp.oauth : undefined} />;
}
