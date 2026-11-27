import { Skeleton } from "@/components/app/page-ui";

// While a section's data loads (redesign 2026-11): the page's own shape, title and rows, at the
// sizes they'll have, so nothing jumps when it arrives. Sections with their own placeholders (Home,
// a project, a profile) show those instead.
export default function SectionLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="mx-auto max-w-3xl xl:max-w-4xl">
      <Skeleton className="mt-2 h-9 w-56 rounded-lg" />
      <Skeleton className="mt-3 h-5 w-80 max-w-full rounded-md" />
      <div className="mt-8 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    </div>
  );
}
