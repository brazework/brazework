import type { Metadata } from "next";
import { AudiencePage } from "@/components/landing/audience-page";
import { CLUBS } from "@/components/landing/audiences";

// /for/clubs: Brazework for clubs (components/landing/audience-page.tsx). Static.
export const metadata: Metadata = { title: "For clubs", description: "Run your club in one place, verify what members build, and get sponsors. Free for every club and member." };

export default function Page() {
  return <AudiencePage a={CLUBS} />;
}
