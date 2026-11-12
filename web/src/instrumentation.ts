// Server-side error monitoring (Linear FIX-55): Sentry on the Node and Edge runtimes, off until
// NEXT_PUBLIC_SENTRY_DSN is set. onRequestError is Next's hook for errors in server components, route
// handlers, server actions and the proxy (node_modules/next/dist/docs/.../instrumentation.md).
import type { Instrumentation } from "next";
import { SENTRY_DSN, sentryOptions } from "@/lib/sentry";

export async function register() {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init(sentryOptions(SENTRY_DSN));
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!SENTRY_DSN) return;
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
};
