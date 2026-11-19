import { FinalCta, Footer } from "@/components/landing/closing";
import { Founders } from "@/components/landing/founders";
import { Hero } from "@/components/landing/hero";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Clubs, Companies, EmberSection, FaqSection, Pricing, ShowBuild, Stages, Tour, Why } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11, Linear FIX-117): the product, to try, instead of a
// description of it. In the order a cold visitor needs it: what it is, with your own build getting
// signed (the hero); who signs for a student, an employee and someone on their own; the app's five places, working; a build in the 3D viewer; why proof matters now; Ember; what clubs get,
// and the founding clubs form; what companies get and what it costs; questions; one last call to start.
// It scrolls like any page, on phones too.
export default function Landing() {
  return (
    <div className="landing min-h-dvh">
      <LegacyLinks />
      <Nav />
      <ThemeChrome landing />
      <main>
        <ProductHuntWelcome place="landing" />
        <Hero />
        <Stages />
        <Tour />
        <ShowBuild />
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
