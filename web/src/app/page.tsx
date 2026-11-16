import { FinalCta, Footer } from "@/components/landing/closing";
import { Founders } from "@/components/landing/founders";
import { Hero } from "@/components/landing/hero";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Clubs, Companies, EmberSection, FaqSection, Pricing, Tour, Why } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";

// The marketing page (redesign 2026-11, Linear FIX-117): the product, to try, instead of a
// description of it. In the order a cold visitor needs it: what it is, with your own build getting
// signed (the hero); the app's five places, working; why proof matters now; Ember; what clubs get,
// and the founding clubs form; what companies get and what it costs; questions; one last call to start.
// It scrolls like any page, on phones too.
export default function Landing() {
  return (
    <div className="landing min-h-dvh">
      <LegacyLinks />
      <Nav />
      <ThemeChrome landing />
      <main>
        <Hero />
        <Tour />
        <Why />
        <EmberSection />
        <Clubs />
        <Organizations />
        <Companies />
        <Pricing />
        <Founders />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
