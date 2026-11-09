import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { copilotEnabled } from "@/lib/copilot";
import { getViewer } from "@/lib/supabase/server";
import { CopilotChat, CopilotSoon } from "./copilot-client";

export const metadata: Metadata = { title: "Copilot" };

export default function CopilotPage({ searchParams }: PageProps<"/copilot">) {
  return (
    <div className="mx-auto max-w-3xl xl:max-w-4xl">
      <Suspense fallback={<Skeleton className="h-[70vh]" />}>
        <Copilot searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Copilot({ searchParams }: { searchParams: PageProps<"/copilot">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 500) : "";
  const { user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  return (await copilotEnabled()) ? <CopilotChat first={profile.first_name} field={profile.field} initial={q} /> : <CopilotSoon />;
}
