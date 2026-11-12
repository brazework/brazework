import { Head } from "./marketing";
import { ReachGlobe } from "./reach-globe";

// Where it goes (Linear FIX-92): the pay-off of the story. Work your club has signed doesn't stay in
// the group chat; it reaches the labs, teams, startups and programs looking for exactly that.
export function Reach() {
  return (
    <section id="reach" data-story="Where it goes" className="story-sec scroll-mt-24 overflow-x-clip py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <ReachGlobe head={<Head eyebrow="Where it goes" title="It doesn't stay" accent="in the group chat."
          body="Once your club signs a milestone, it's on your profile and in search, in front of the labs, teams, startups and grad programs looking for exactly that work, wherever they are." />} />
      </div>
    </section>
  );
}
