// Browser error monitoring (Linear FIX-55): see lib/sentry.ts. With no DSN this does nothing and the
// SDK is never downloaded; with one, it loads in its own chunk after the page.
import { SENTRY_DSN, sentryOptions } from "@/lib/sentry";

const dsn = SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => Sentry.init(sentryOptions(dsn))).catch(() => {});
}
