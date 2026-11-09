import { FinalCta, Footer } from "@/components/landing/closing";
import { CopilotSection } from "@/components/landing/copilot-section";
import { Hero } from "@/components/landing/hero";
import { SpotlightTracker } from "@/components/landing/interactive";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Audiences, Builders, ClubStrip, FaqSection, Features, How, Mission, Problem } from "@/components/landing/marketing";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { StoryRail } from "@/components/landing/story-rail";
import { ThemeChrome } from "@/components/theme-chrome";

// The marketing page: pick your field and see your profile, every kind of builder, why now,
// how it works, who it's for, the product, the mission, the founding clubs program, and questions.
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
        <ClubStrip />
        <Builders />
        <Problem />
        <How />
        <CopilotSection />
        <Audiences />
        <Features />
        <Mission />
        <Organizations />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
