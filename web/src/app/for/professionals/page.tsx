import type { Metadata } from "next";
import { AudiencePage } from "@/components/landing/audience-page";
import { PROFESSIONALS } from "@/components/landing/audiences";

// /for/professionals: Brazework for professionals (components/landing/audience-page.tsx). Static.
export const metadata: Metadata = { title: "For professionals", description: "Log what you ship at work, signed by a coworker, tech lead or client. Private until you choose. Free to start." };

export default function Page() {
  return <AudiencePage a={PROFESSIONALS} />;
}
