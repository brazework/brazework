import { requestTime } from "@/lib/forge";
import { continueStep } from "@/lib/ember-continuity";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { presetFromQuery } from "@/lib/copilot-presets";
import { Suspense } from "react";
import { Skeleton } from "@/components/app/page-ui";
import { copilotEnabled } from "@/lib/copilot";
import { listChats, loadChat } from "@/lib/copilot-chats";
import { dbFeatures } from "@/lib/db-features";
import { nextSteps } from "@/lib/ember-record";
import { loadEmberRecord } from "@/lib/ember-record-load";
import { getViewer } from "@/lib/supabase/server";
import { draftToProposal, isCardKind, type ToolDraftRow } from "@/lib/tool-actions";
import { CopilotChat, CopilotSoon, type FromTools } from "./copilot-client";

export const metadata: Metadata = { title: "Jig" };

export default function CopilotPage({ searchParams }: PageProps<"/copilot">) {
  return (
    <div className="mx-auto max-w-[92rem]">
      <Suspense fallback={<Skeleton className="h-[70vh]" />}>
        <Copilot searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Copilot({ searchParams }: { searchParams: PageProps<"/copilot">["searchParams"] }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 500) : "";
  const preset = q ? presetFromQuery(sp) : null;
  const { supabase, user, profile } = await getViewer();
  if (!user || !profile) redirect("/login");
  if (!(await copilotEnabled())) return <div className="mx-auto max-w-3xl xl:max-w-4xl"><CopilotSoon /></div>;
  // Saved chats (supabase/copilot-chats.sql): the list for the rail, and the one in ?chat= if any.
  const saving = (await dbFeatures()).copilotChats;
  const id = typeof sp.chat === "string" ? sp.chat : "";
  const [chats, chat] = saving ? await Promise.all([listChats(), id ? loadChat(id) : Promise.resolve(null)]) : [[], null];
  // A new chat opens with up to three next steps from the member's own record (lib/ember-record.ts).
  // First, the chat they were last in, if it was in the last few days (lib/ember-continuity.ts).
  const pickUp = chat || q ? null : continueStep(chats, requestTime());
  const steps = chat || q ? [] : [...(pickUp ? [pickUp] : []), ...nextSteps(await loadEmberRecord(supabase, user.id, profile.account_type, { withGitHub: true }))].slice(0, 3);
  return <CopilotChat first={profile.first_name} field={profile.field} student={profile.account_type !== "professional"} initial={chat ? "" : q} initialPreset={chat ? null : preset} chats={chats} chat={chat} saving={saving} steps={steps} fromTools={await fromTools(supabase)} />;
}

// What your AI tools drafted for you (supabase/tool-actions.sql), as Jig cards.
async function fromTools(supabase: Awaited<ReturnType<typeof getViewer>>["supabase"]): Promise<FromTools | null> {
  if (!(await dbFeatures()).toolActions) return null;
  const { data } = await supabase.from("tool_drafts").select("id, kind, via, source, created_at, payload").eq("status", "waiting").order("created_at", { ascending: false }).limit(30);
  const rows = (data ?? []) as ToolDraftRow[];
  const cards = rows.filter((d) => isCardKind(d.kind)).slice(0, 5).flatMap((d) => { const p = draftToProposal(d); return p ? [{ draftId: d.id, via: d.via, source: d.source, p }] : []; });
  return { cards, others: rows.length - cards.length };
}
