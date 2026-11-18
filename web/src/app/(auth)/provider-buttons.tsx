import { PROVIDERS, type ProviderId } from "@/lib/oauth";

// "Continue with Google / GitHub / LinkedIn" on log-in and sign-up. Outline buttons in the site's
// monochrome tokens; GitHub and LinkedIn marks take the text colour (light and dark). Google's "G"
// keeps its four colours, which Google's sign-in branding rules require.
// Plain links to /auth/oauth (not <Link>), so nothing prefetches the start of a sign-in.
const btn = "inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-surface px-5 text-[15px] font-medium text-text transition-colors duration-150 hover:border-line-strong hover:bg-hover";

function Mark({ id }: { id: ProviderId }) {
  if (id === "google")
    return (
      <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" aria-hidden="true">
        <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.53 5.53 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
        <path fill="#FBBC05" d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.27a12 12 0 0 0 0 10.8l4.01-3.11Z" />
        <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.27 6.6l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
      </svg>
    );
  if (id === "github")
    return (
      <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57v-2.02c-3.34.73-4.04-1.6-4.04-1.6-.55-1.4-1.34-1.77-1.34-1.77-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
    </svg>
  );
}

export function oauthHref(id: ProviderId, from: "login" | "signup", next?: string, invite?: string) {
  const q = new URLSearchParams({ provider: id, from });
  if (next && next !== "/feed") q.set("next", next);
  if (invite) q.set("invite", invite);
  return `/auth/oauth?${q}`;
}

export function ProviderButtons({ providers, from, next, invite }: { providers: ProviderId[]; from: "login" | "signup"; next?: string; invite?: string }) {
  if (!providers.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        {PROVIDERS.filter((p) => providers.includes(p.id)).map((p) => (
          <a key={p.id} href={oauthHref(p.id, from, next, invite)} className={btn} data-provider={p.id}>
            <Mark id={p.id} /> Continue with {p.label}
          </a>
        ))}
      </div>
      {from === "signup" && <p className="text-xs text-muted">Students: choose your school account there, so it&apos;s your university email.</p>}
      <div className="flex items-center gap-3 text-xs text-faint">
        <span aria-hidden="true" className="h-px flex-1 bg-line" /> or with your email <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
