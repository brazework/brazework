import { DisciplineSheet } from "./discipline-sheet";
import { Head } from "./marketing";

// Every field in STEM (Linear FIX-92): what proof looks like in software, mechanical and electrical
// work, biology, chemistry, physics, data and AI, and maths, as one spec sheet (discipline-sheet.tsx).
// Wide screens: several screens tall with the content pinned, so scrolling walks through the fields.
export function Disciplines() {
  return (
    <section id="disciplines" data-story="Every field" className="story-sec scroll-mt-24 py-24 sm:py-32 md:h-[520vh] md:py-0">
      <div className="mx-auto max-w-7xl px-6 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-center md:pt-16">
        <Head eyebrow="Every field in STEM" title="Whatever you build," accent="it becomes proof." body="A merged pull request, a load test, a clean gel, a titration curve, a model that holds up on data it hasn't seen, a proof that checks. Every field leaves its own evidence. Brazework keeps it as you go, and your club signs off on it." />
        <DisciplineSheet />
      </div>
    </section>
  );
}
