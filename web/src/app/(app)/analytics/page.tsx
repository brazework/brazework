import { redirect } from "next/navigation";
import { Suspense } from "react";

// Analytics grew into the Dashboard; old links (and ?range=) still land in the right place.
export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return <Suspense fallback={null}><Go searchParams={searchParams} /></Suspense>;
}

async function Go({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }): Promise<null> {
  const range = (await searchParams).range;
  redirect(typeof range === "string" ? `/dashboard?range=${encodeURIComponent(range)}` : "/dashboard");
}
