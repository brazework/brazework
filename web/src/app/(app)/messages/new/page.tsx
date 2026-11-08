import { redirect } from "next/navigation";
import { Suspense } from "react";
import { friendlyError } from "@/lib/forge";
import { getViewer } from "@/lib/supabase/server";

// /messages/new?to=<profile id>: opens your conversation with them, or starts one (start_conversation()).
export default function NewMessage({ searchParams }: PageProps<"/messages/new">) {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Opening conversation…</p>}>
      <Start searchParams={searchParams} />
    </Suspense>
  );
}

async function Start({ searchParams }: { searchParams: PageProps<"/messages/new">["searchParams"] }) {
  const to = (await searchParams).to;
  const { supabase, user } = await getViewer();
  if (!user) redirect("/login");
  if (typeof to !== "string" || !/^[0-9a-f-]{36}$/i.test(to)) redirect("/messages");
  const { data, error } = await supabase.rpc("start_conversation", { p_other: to });
  if (error || !data) return <p role="alert" className="p-6 text-sm text-danger">{friendlyError(error)}</p>;
  redirect(`/messages/${encodeURIComponent(String(data))}`);
}
