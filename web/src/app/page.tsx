import { FinalCta, Footer } from "@/components/landing/closing";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LegacyLinks } from "@/components/landing/legacy-links";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Builds, Clubs, Companies, ConnectSection, EmberSection, FaqSection, Pricing, Stages, Tour } from "@/components/landing/sections";
import { ThemeChrome } from "@/components/theme-chrome";
import { ProductHuntWelcome } from "@/components/launch/product-hunt-welcome";

// The marketing page (redesign 2026-11; before it FIX-117 and FIX-218). Paper and ink, with one dark
// band: the CAD lab, where real builds turn, cut open and show their loads. In the order a cold
// visitor needs it: what it is, with your own build getting signed (the hero); how it works, in three
// steps; real builds and their signed results; who signs for a student, an employee and someone on
// their own; the app's places, working; Ember and the AI tools you already use; what clubs get and the
// founding clubs form; what companies get; what it costs; questions (wider screens); one last call.
// The text-only sections (why proof matters, the founders) were cut to keep it to things to try.
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
        <Builds />
        <Stages />
        <Tour />
        <EmberSection />
        <ConnectSection />
        <Clubs />
        <Organizations />
        <Companies />
        <Pricing />
        <div className="hidden sm:block"><FaqSection /></div>
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
