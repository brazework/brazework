import { Suspense } from "react";
import { FinalCta, Footer } from "@/components/landing/closing";
import { CopilotSection } from "@/components/landing/copilot-section";
import { Hero } from "@/components/landing/hero";
import { Founders } from "@/components/landing/founders";
import { Traction } from "@/components/landing/traction";
import { SpotlightTracker } from "@/components/landing/interactive";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { AiEra, Audiences, FaqSection, Features, How, Mission, Pricing, Problem } from "@/components/landing/marketing";
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
        <Suspense fallback={null}><Traction /></Suspense>
        <Problem />
        <How />
        <CopilotSection />
        <Audiences />
        <AiEra />
        <Features />
        <Pricing />
        <Mission />
        <Founders />
        <Organizations />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
