import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { copilotEnabled } from "@/lib/copilot";
import { getViewer } from "@/lib/supabase/server";
import { CopilotChat, CopilotSoon } from "./copilot-client";

export const metadata: Metadata = { title: "Copilot" };

export default function CopilotPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-[70vh]" />}>
        <Copilot />
      </Suspense>
    </div>
  );
}

async function Copilot() {
  const { user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  return (await copilotEnabled()) ? <CopilotChat first={profile.first_name} field={profile.field} /> : <CopilotSoon />;
}
