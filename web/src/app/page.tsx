import { Footer } from "@/components/landing/closing";
import { Compare } from "@/components/landing/compare";
import { Hero } from "@/components/landing/hero";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Audiences, Faq, ForSchools, How } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11; schools first and the landing journey since 2026-11-26,
// docs/strategy.md). Short on purpose, a few screens on a laptop. The hero is the product window:
// one project followed from the student who logs it, to the professor who verifies it, the school
// that counts it, the recruiter who finds it and everywhere it goes, clicked or played by scrolling.
// Then one story (2026-11-26): how it works in three steps, the same for everyone; who it's for,
// students and professionals alike; one band for the school that pays and what the others can't show
// (the rest is on /schools); plain answers; the pilot form. Pricing and the AI guide have their own pages.
export default function Landing() {
  return (
    <div className="landing min-h-dvh">
      <LegacyLinks />
      <Nav />
      <ThemeChrome landing />
      <main>
        <ProductHuntWelcome place="landing" />
        <Hero />
        <How />
        <Audiences />
        <ForSchools />
        <Compare />
        <Faq />
        <Organizations />
      </main>
      <Footer />
    </div>
  );
}
