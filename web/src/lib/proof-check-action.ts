"use server";
import { getViewer } from "@/lib/supabase/server";
import { checkPlan, readAnswer, type ProofCheck } from "@/lib/proof-check";

// The proof picker's check (lib/proof-check.ts says what's asked and why it's safe). Signed-in members
// only; four seconds at most; never more than the first 200 KB of a page.
export async function checkProofLink(url: string): Promise<ProofCheck> {
  const { user } = await getViewer();
  if (!user || typeof url !== "string" || url.length > 300) return {};
  const plan = checkPlan(url);
  if (!plan) return {};
  try {
    const res = await fetch(plan.url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(4000), headers: { "user-agent": "Brazework link check (+https://brazework.com)", accept: plan.kind === "oembed" ? "application/json" : "text/html" } });
    let body = "";
    if (res.status === 200 && res.body) {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (body.length < 200_000) {
        const { done, value } = await reader.read();
        if (done) break;
        body += dec.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
    }
    return readAnswer(plan.kind, res.status, res.headers.get("location"), body);
  } catch {
    return {};
  }
}
