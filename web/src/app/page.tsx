import { FinalCta, Footer } from "@/components/landing/closing";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Audiences, FaqSection, Features, HowItWorks, MarketingHero, Mission, Problem } from "@/components/landing/marketing";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";

// The marketing page: the promise, the problem, how it works, who it's for, the product,
// why we're building it, the founding clubs program, and questions.
export default function Landing() {
  return (
    <div className="bp min-h-dvh">
      <LegacyLinks />
      <Nav />
      <main className="scroll-smooth">
        <MarketingHero />
        <Problem />
        <HowItWorks />
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
