import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { copilotEnabled } from "@/lib/copilot";
import { listChats, loadChat } from "@/lib/copilot-chats";
import { dbFeatures } from "@/lib/db-features";
import { getViewer } from "@/lib/supabase/server";
import { CopilotChat, CopilotSoon } from "./copilot-client";

export const metadata: Metadata = { title: "Copilot" };

export default function CopilotPage({ searchParams }: PageProps<"/copilot">) {
  return (
    <div className="mx-auto max-w-6xl">
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
  if (!(await copilotEnabled())) return <div className="mx-auto max-w-3xl xl:max-w-4xl"><CopilotSoon /></div>;
  // Saved chats (supabase/copilot-chats.sql): the list for the rail, and the one in ?chat= if any.
  const saving = (await dbFeatures()).copilotChats;
  const id = typeof sp.chat === "string" ? sp.chat : "";
  const [chats, chat] = saving ? await Promise.all([listChats(), id ? loadChat(id) : Promise.resolve(null)]) : [[], null];
  return <CopilotChat first={profile.first_name} field={profile.field} initial={chat ? "" : q} chats={chats} chat={chat} saving={saving} />;
}
