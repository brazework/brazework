import { createClient } from "@/lib/supabase/server";

// Live traction from the database (supabase/public-stats.sql): counts only. Any number that's zero
// is left out, and the strip disappears if they all are (or the function isn't there yet).
export async function Traction() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_stats");
  if (error || !data) return null;
  const s = data as Record<string, number>;
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const items = ([
    [s.clubs, plural(s.clubs, "club", "clubs")],
    [s.verified_members, plural(s.verified_members, "member with verified work", "members with verified work")],
    [s.verified_milestones, plural(s.verified_milestones, "milestone verified", "milestones verified")],
    [s.companies, plural(s.companies, "company", "companies")],
  ] as [number, string][]).filter(([n]) => Number(n) > 0);
  if (!items.length) return null;
  return (
    <section aria-label="Brazework today" className="border-y border-line">
      <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-6 py-6">
        {items.map(([n, label]) => (
          <li key={label} className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">{n.toLocaleString("en-US")}</span>
            <span className="text-sm text-muted">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
