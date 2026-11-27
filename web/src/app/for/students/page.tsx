import type { Metadata } from "next";
import { AudiencePage } from "@/components/landing/audience-page";
import { STUDENTS } from "@/components/landing/audiences";

// /for/students: Brazework for students (components/landing/audience-page.tsx). Static.
export const metadata: Metadata = { title: "For students", description: "Your classes, clubs and projects in one place, signed by your professor or club. Free with your school email." };

export default function Page() {
  return <AudiencePage a={STUDENTS} />;
}
