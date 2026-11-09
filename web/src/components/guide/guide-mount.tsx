import { copilotEnabled } from "@/lib/copilot";
import { loadGuide } from "@/lib/guide";
import { GuideLauncher } from "./guide-launcher";

// Loads the guide on the server (behind its own Suspense, so it never slows the page) and hands
// it to the floating launcher.
export async function GuideMount() {
  const [guide, copilot] = await Promise.all([loadGuide(), copilotEnabled()]);
  return guide ? <GuideLauncher guide={guide} copilot={copilot} /> : null;
}
