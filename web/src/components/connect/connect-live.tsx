import { Suspense } from "react";
import { env } from "@/lib/env";
import { mcpResource, oauthEnabled } from "@/lib/mcp-oauth";
import { ConnectCard } from "./connect-card";

// The connect card with its live state: whether one-click sign-in is switched on (checked at most every
// five minutes, lib/mcp-oauth.ts). The page around it stays static; only this part waits.
export function ConnectSlot({ className }: { className?: string }) {
  const endpoint = mcpResource(env.siteUrl);
  return (
    <Suspense fallback={<ConnectCard endpoint={endpoint} on={null} className={className} />}>
      <ConnectLive endpoint={endpoint} className={className} />
    </Suspense>
  );
}

async function ConnectLive({ endpoint, className }: { endpoint: string; className?: string }) {
  return <ConnectCard endpoint={endpoint} on={await oauthEnabled()} className={className} />;
}
