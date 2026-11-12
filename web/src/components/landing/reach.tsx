import { Head } from "./marketing";
import { ReachGlobe } from "./reach-globe";

// Where it goes (Linear FIX-92): the pay-off of the story. Work your club has signed doesn't stay in
// the group chat; it reaches the labs, teams, startups and programs looking for exactly that.
export function Reach() {
  return (
    <section id="reach" data-story="Where it goes" data-chapters="6" className="story-sec scroll-mt-24 overflow-x-clip py-24 sm:py-32 md:h-[420vh] md:py-0">
      {/* Wide screens: pinned while the scroll walks through the moments and the globe turns to each. */}
      <div className="mx-auto max-w-7xl px-6 md:sticky md:top-0 md:flex md:h-screen md:flex-col md:justify-center md:pt-16">
        <ReachGlobe head={<Head eyebrow="Where it goes" title="It doesn't stay" accent="in the group chat."
          body="Once a milestone is signed, by your club or a professor who saw it, it's on your profile and in search, in front of the labs, teams, startups and grad programs looking for exactly that work, wherever they are." />} />
      </div>
    </section>
  );
}
