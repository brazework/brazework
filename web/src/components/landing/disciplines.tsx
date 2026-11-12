import { DisciplineSheet } from "./discipline-sheet";
import { Head } from "./marketing";

// Every kind of engineering (Linear FIX-92): what proof looks like for software, mechanical,
// electrical, aerospace, structures and biomedical work, as one spec sheet (discipline-sheet.tsx).
// Wide screens: six screens tall with the content pinned, so scrolling walks through the fields.
export function Disciplines() {
  return (
    <section id="disciplines" data-story="Every kind of engineering" className="story-sec scroll-mt-24 py-24 sm:py-32 md:h-[420vh] md:py-0">
      <div className="mx-auto max-w-7xl px-6 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-center md:pt-16">
        <Head eyebrow="Every kind of engineering" title="Whatever you build," accent="it becomes proof." body="Code, CAD, circuits, rockets, bridges, devices: each kind of work has its own kind of evidence. Brazework records it as you go, and your club signs off on it." />
        <DisciplineSheet />
      </div>
    </section>
  );
}
