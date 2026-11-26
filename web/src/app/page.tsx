import { FinalCta, Footer } from "@/components/landing/closing";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Audiences } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11; before it FIX-117 and FIX-218). Short on purpose, a few
// screens on a laptop: the hero is the product to play with (a real build in CAD, your milestone on
// it, signed when you press Sign); then how it works in three steps; who it's for and where each
// starts; the founding clubs form; one last call. Pricing, the AI guide and questions have their own
// pages, linked from the header and footer.
export default function Landing() {
  return (
    <div className="landing min-h-dvh">
      <LegacyLinks />
      <Nav />
      <ThemeChrome landing />
      <main>
        <ProductHuntWelcome place="landing" />
        <Hero />
        <HowItWorks />
        <Audiences />
        <Organizations />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
