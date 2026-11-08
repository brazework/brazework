import { Bento } from "@/components/landing/bento";
import { FinalCta, Footer } from "@/components/landing/closing";
import { Disciplines } from "@/components/landing/disciplines";
import { Hero } from "@/components/landing/hero";
import { Nav } from "@/components/landing/nav";
import { Organizations } from "@/components/landing/organizations";
import { Why } from "@/components/landing/why";

export default function Landing() {
  return (
    <>
      <Nav />
      <main className="scroll-smooth">
        <Hero />
        <Bento />
        <Disciplines />
        <Why />
        <Organizations />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
