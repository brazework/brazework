// Error monitoring (Linear FIX-55): Sentry, off until NEXT_PUBLIC_SENTRY_DSN is set in Vercel. With no
// DSN nothing loads: Next inlines the variable at build time, so `if (DSN)` is `if (undefined)` and the
// SDK's chunk, though still built, is never downloaded (measured: 0 of 38 scripts across 5 pages).
// With one, the SDK loads after the page does, so it never slows first paint. Only errors: no
// performance tracing, no session replay. Every event and breadcrumb goes through lib/sentry-scrub.ts.
import type { ErrorEvent, EventHint, Breadcrumb } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "./sentry-scrub";

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = (dsn: string) => ({
  dsn,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // The same commit /api/health reports, so an error points at the exact deploy.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeSend: (event: ErrorEvent, _hint: EventHint) => scrubEvent(event as unknown as Parameters<typeof scrubEvent>[0]) as unknown as ErrorEvent,
  beforeBreadcrumb: (crumb: Breadcrumb) => scrubBreadcrumb(crumb as Parameters<typeof scrubBreadcrumb>[0]) as Breadcrumb | null,
});

/** Report an error React caught in a boundary (those never reach Sentry's global handlers). */
export function reportError(error: unknown) {
  if (!SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
}
