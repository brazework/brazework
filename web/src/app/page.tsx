import { FinalCta, Footer } from "@/components/landing/closing";
import { Founders } from "@/components/landing/founders";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Clubs, Companies, ConnectSection, EmberSection, FaqSection, Pricing, ShowBuild, Stages, Tour, Why } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11, Linear FIX-117; reordered for launch, FIX-218): the product,
// to try, instead of a description of it. In the order a cold visitor needs it: what it is, with your
// own build getting signed (the hero); how it works, in three steps; who signs for a student, an
// employee and someone on their own; why proof matters now; the app's five places, working; a build in
// the 3D viewer; Ember, then the AI tools you already use; what clubs get, and the founding clubs form;
// what companies get and what it costs; questions; one last call to start. The first four answer
// "what is this and why would I care" before anything asks the visitor to learn a feature.
// It scrolls like any page. On a phone it's the short version (Josh, 22 Nov: "too much content on
// iPhone"): the why, the 3D build, the AI tools, the founders and the questions are on a wider screen
// only, and the phone menu doesn't link to them. What a phone keeps: what it is, how it works, who signs,
// the app, Ember, clubs (and the founding form their buttons open), companies, pricing, the last call.
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
        <Stages />
        <div className="hidden sm:block"><Why /></div>
        <Tour />
        <div className="hidden sm:block"><ShowBuild /></div>
        <EmberSection />
        <div className="hidden sm:block"><ConnectSection /></div>
        <Clubs />
        <Organizations />
        <Companies />
        <Pricing />
        <div className="hidden sm:block"><Founders /></div>
        <div className="hidden sm:block"><FaqSection /></div>
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
