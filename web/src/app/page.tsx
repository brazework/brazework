import { FinalCta, Footer } from "@/components/landing/closing";
import { OtherSide } from "@/components/landing/angles";
import { Hero } from "@/components/landing/hero";
import { Founders } from "@/components/landing/founders";
import { SpotlightTracker } from "@/components/landing/interactive";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { FaqSection, How, Pricing, Problem } from "@/components/landing/marketing";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { ClubShowcase, ProjectShowcase } from "@/components/landing/showcase";
import { StoryRail } from "@/components/landing/story-rail";
import { ThemeChrome } from "@/components/theme-chrome";

// The marketing page, in the order a cold visitor needs it: what it is, with something to try (the
// hero); why now; how it works; what a proof page looks like; what clubs get; what companies get and
// what it costs; the founding clubs program; questions; and one last call to start.
// Left out on purpose (2026-11, docs/superpowers/specs/2026-11-13-front-door-design.md): Disciplines,
// NoClub, ConnectSection, Reach, Audiences and Features. Their components are still in
// components/landing, so any of them comes back with one line here.
export default function Landing() {
  return (
    <div className="story-root min-h-dvh">
      <LegacyLinks />
      <SpotlightTracker />
      <SmoothScroll />
      <Nav />
      <ThemeChrome landing />
      <StoryRail />
      <main className="story scroll-smooth">
        <Hero />
        <Problem />
        <How />
        <ProjectShowcase />
        <ClubShowcase />
        <OtherSide />
        <Pricing />
        <Founders />
        <Organizations />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
