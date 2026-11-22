import { GraduationCap } from "lucide-react";
import { getViewer } from "@/lib/supabase/server";

type Backer = { uid: string; first_name: string; last_name: string; role: string; email: string };
const ROLE: Record<string, string> = { owner: "owner", admin: "admin", moderator: "moderator" };

// For whoever reviews a club's request to be listed under a school (the school's official admins, or
// Brazework admins until it's set up): which confirmed school address it was sent from, and which of
// the club's officers have one (supabase/school-link-email.sql, FIX-237). Renders nothing before that
// step has run, or for anyone the database doesn't let see it.
export async function SchoolLinkBackers({ cid, domain }: { cid: string; domain: string }) {
  const { supabase } = await getViewer();
  const [from, backers] = await Promise.all([
    supabase.from("club_school_links").select("requester_email").eq("community_id", cid).maybeSingle(),
    supabase.rpc("school_link_backers", { p_cid: cid }),
  ]);
  if (from.error || backers.error) return null;
  const sentFrom = (from.data as { requester_email: string | null } | null)?.requester_email;
  const list = (backers.data ?? []) as Backer[];
  return (
    <div className="mt-2 rounded-xl bg-surface-2/70 px-3 py-2 text-xs text-text-2">
      <p className="inline-flex items-center gap-1.5 font-medium"><GraduationCap className="size-3.5" />
        {list.length === 1 ? `1 officer with a confirmed @${domain} address` : `${list.length} officers with a confirmed @${domain} address`}
      </p>
      {list.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {list.map((b) => (
            <li key={b.uid}>{`${b.first_name} ${b.last_name}`.trim() || "An officer"} ({ROLE[b.role] ?? b.role}) · {b.email}{b.email === sentFrom ? " · sent the request" : ""}</li>
          ))}
        </ul>
      )}
      {sentFrom && !list.some((b) => b.email === sentFrom) && <p className="mt-1 text-faint">Sent from {sentFrom}.</p>}
    </div>
  );
}
