// A club's accent colour (supabase/club-profile.sql): the badge fill and a tint over its banner.
// "" keeps Forge's default look. Classes are spelled out so Tailwind keeps them.
export const ACCENTS = [
  { id: "", label: "Default", swatch: "var(--accent)", badge: "" },
  { id: "ink", label: "Ink", swatch: "#18181b", badge: "bg-zinc-900 text-white border-transparent" },
  { id: "blue", label: "Blue", swatch: "#2563eb", badge: "bg-blue-600 text-white border-transparent" },
  { id: "violet", label: "Violet", swatch: "#7c3aed", badge: "bg-violet-600 text-white border-transparent" },
  { id: "emerald", label: "Emerald", swatch: "#059669", badge: "bg-emerald-600 text-white border-transparent" },
  { id: "amber", label: "Amber", swatch: "#d97706", badge: "bg-amber-600 text-white border-transparent" },
  { id: "rose", label: "Rose", swatch: "#e11d48", badge: "bg-rose-600 text-white border-transparent" },
  { id: "cyan", label: "Cyan", swatch: "#0891b2", badge: "bg-cyan-600 text-white border-transparent" },
] as const;

export const accentOf = (id?: string | null) => ACCENTS.find((a) => a.id === (id ?? "")) ?? ACCENTS[0];
// The banner tint when a club has no cover photo.
export const accentTint = (id?: string | null) => (id ? `linear-gradient(135deg, color-mix(in oklab, ${accentOf(id).swatch} 55%, transparent), transparent 75%)` : undefined);
