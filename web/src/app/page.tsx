import { FinalCta, Footer } from "@/components/landing/closing";
import { ConnectSection } from "@/components/landing/connect-section";
import { Disciplines } from "@/components/landing/disciplines";
import { Hero } from "@/components/landing/hero";
import { Founders } from "@/components/landing/founders";
import { SpotlightTracker } from "@/components/landing/interactive";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Audiences, FaqSection, Features, How, Pricing, Problem } from "@/components/landing/marketing";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { ClubShowcase, ProjectShowcase } from "@/components/landing/showcase";
import { StoryRail } from "@/components/landing/story-rail";
import { ThemeChrome } from "@/components/theme-chrome";

// The marketing page, in the order a cold visitor needs it: what it is and who it's for (the hero),
// why now, how verification works, Ember, the four ways in, what clubs get, pricing, the founding clubs program, questions, and one last call to join.
export default function Landing() {
  return (
    <div className="story-root min-h-dvh">
      <LegacyLinks />
      <SpotlightTracker />
      <Nav />
      <ThemeChrome landing />
      <StoryRail />
      <main className="story scroll-smooth">
        <Hero />
        <Problem />
        <How />
        <Disciplines />
        <ProjectShowcase />
        <ClubShowcase />
        <ConnectSection />
        <Audiences />
        <Features />
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
