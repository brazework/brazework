import type { Metadata } from "next";
import { Suspense } from "react";
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
  const sp = await searchParams;
  return <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} confirmed={sp.confirmed === "1"} resetExpired={sp.reset === "expired"} />;
}
