// What Brazework sends to Sentry when something breaks (Linear FIX-55): what failed and where in the
// code, the page's path, the browser and the member's id. Never an email, cookies, headers, request
// bodies, form input or a URL's query string (sign-in and invite links carry tokens there). Every
// event and breadcrumb passes through here before it leaves the server or the browser; the privacy
// page promises exactly this, so tests/sentry-scrub.test.ts holds it to that.

type Crumb = { category?: string; message?: string; data?: Record<string, unknown> } & Record<string, unknown>;
type Evt = {
  request?: { url?: string; query_string?: unknown; cookies?: unknown; headers?: unknown; data?: unknown; env?: unknown } & Record<string, unknown>;
  user?: { id?: string | number } & Record<string, unknown>;
  breadcrumbs?: Crumb[];
  extra?: Record<string, unknown>;
  message?: string;
  exception?: { values?: { value?: string }[] };
} & Record<string, unknown>;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** A URL without its query string or fragment; anything that doesn't parse loses everything after ? or #. */
export function stripQuery(url: string): string {
  return url.replace(/[?#].*$/, "");
}

/** Emails in free text (an error message can quote one) become [email]. */
export function maskEmails(text: string): string {
  return text.replace(EMAIL, "[email]");
}

export function scrubBreadcrumb<T extends Crumb>(crumb: T): T | null {
  // Console output and typing can carry message text; clicks and navigation are enough to retrace a bug.
  if (crumb.category === "console" || crumb.category === "ui.input") return null;
  const data = crumb.data ? { ...crumb.data } : undefined;
  if (data) for (const k of ["url", "from", "to"]) if (typeof data[k] === "string") data[k] = stripQuery(data[k] as string);
  return { ...crumb, ...(crumb.message ? { message: maskEmails(stripQuery(crumb.message)) } : {}), ...(data ? { data } : {}) };
}

export function scrubEvent<T extends Evt>(event: T): T {
  const e: Evt = { ...event };
  if (e.request) {
    const { url } = e.request;
    e.request = { ...(url ? { url: stripQuery(url) } : {}) };
  }
  if (e.user) e.user = e.user.id != null ? { id: e.user.id } : undefined;
  delete e.extra;
  if (e.message) e.message = maskEmails(e.message);
  if (e.exception?.values) e.exception = { ...e.exception, values: e.exception.values.map((v) => (v.value ? { ...v, value: maskEmails(v.value) } : v)) };
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map(scrubBreadcrumb).filter((c): c is Crumb => c !== null);
  return e as T;
}
