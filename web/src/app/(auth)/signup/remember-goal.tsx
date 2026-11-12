"use client";
import { useEffect } from "react";

// /signup?goal=internship (from the landing page's goal picker): keep it in this browser so the goal
// card suggests it once they're in (components/app/goal-card.tsx). Nothing is sent anywhere.
export function RememberGoal({ goal }: { goal: string }) {
  useEffect(() => { try { localStorage.setItem("brazework-goal", goal); } catch {} }, [goal]);
  return null;
}
