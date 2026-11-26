import { Footer } from "@/components/landing/closing";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Audiences, ForSchools } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11; schools first since 2026-11-26, docs/strategy.md). Short on
// purpose, a few screens on a laptop. Students are the front door: the hero is the product to play
// with (a class or club build in CAD, your milestone on it, signed by your professor or club when you
// press Sign); then how it works in three steps; one band for the school that pays (the rest is on
// /schools); who it's for; the pilot form. Pricing and the AI guide have their own pages.
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
        <ForSchools />
        <Audiences />
        <Organizations />
      </main>
      <Footer />
    </div>
  );
}
