import { BadgeCheck, Lock } from "lucide-react";
import { redactedText, type Redacted } from "@/lib/redacted";
import { getViewer } from "@/lib/supabase/server";

// Confidential work (supabase/redacted-proof.sql): private signed milestones shown only as the line their
// owner wrote, with who stood behind it in general terms and the month. redacted_proof() returns nothing
// else, so the title, project, signer, domain and club can't reach this page. Nothing when there's none.
export async function ConfidentialWork({ member, mine }: { member: string; mine: boolean }) {
  const { supabase } = await getViewer();
  const { data, error } = await supabase.rpc("redacted_proof", { p_member: member });
  const rows = (error ? [] : (data ?? [])) as Redacted[];
  if (!rows.length) return null;
  return (
    <section aria-labelledby="conf-h" className="glass-card rounded-3xl p-5">
      <h2 id="conf-h" className="inline-flex items-center gap-1.5 text-sm font-semibold"><Lock className="size-4 text-muted" />Confidential work</h2>
      <p className="mt-1 text-xs text-muted">{mine ? "What other members see for your private signed work: your line, and who signed it in general terms." : "Signed work whose details are private. The signature is real; the specifics stay with the people involved."}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-2 text-sm"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-ok" /><span>{redactedText(r)}</span></li>
        ))}
      </ul>
    </section>
  );
}
