import { createClient } from "@/lib/supabase/server";
import type { PublicProof } from "@/lib/proof-card";

// A shared result for /p/<id> and its preview image (Linear FIX-128). public_proof() returns it only
// while its owner shares it, it's public, and it's signed or backed (supabase/proof-cards.sql).
export async function loadProof(id: string): Promise<PublicProof | null> {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_proof", { p_id: id });
  return (data as PublicProof | null) ?? null;
}
