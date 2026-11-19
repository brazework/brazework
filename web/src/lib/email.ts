// Email: one interface, one real provider (Resend's HTTP API) and an "off" provider. Nothing is sent
// unless RESEND_API_KEY and FORGE_EMAIL_FROM are set. Sign-in emails are separate (Supabase Auth).
// For demos on the private local database there's also a local outbox: with BRAZEWORK_LOCAL_OUTBOX=1
// (npm run dev -- --demo sets it) and a localhost Supabase, emails are kept in a file and shown at
// /dev/outbox instead of sent, so a signature link can be opened on camera. It never runs anywhere else.
// Tested in tests/email.test.ts.

export type Email = { to: string; subject: string; text: string; html: string };
export type SendResult = { ok: true; id: string } | { ok: false; reason: "off" | "error"; message: string };

export interface EmailProvider {
  readonly name: string;
  readonly enabled: boolean;
  send(e: Email): Promise<SendResult>;
}

type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: RequestInit) => Promise<Pick<Response, "ok" | "json">>;

export const emailOff: EmailProvider = {
  name: "off",
  enabled: false,
  async send() { return { ok: false, reason: "off", message: "Email isn't switched on (set RESEND_API_KEY and FORGE_EMAIL_FROM)." }; },
};

export function resendProvider(env: Env, fetcher: Fetch = fetch): EmailProvider {
  const key = env.RESEND_API_KEY ?? "";
  const from = env.FORGE_EMAIL_FROM ?? "";
  const enabled = key.startsWith("re_") && from.includes("@");
  return {
    name: "resend",
    enabled,
    async send(e) {
      if (!enabled) return emailOff.send(e);
      try {
        const res = await fetcher("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: [e.to], subject: e.subject, text: e.text, html: e.html }),
        });
        const json = (await res.json()) as { id?: string; message?: string };
        if (!res.ok || !json.id) return { ok: false, reason: "error", message: json.message ?? "The email couldn't be sent." };
        return { ok: true, id: json.id };
      } catch {
        return { ok: false, reason: "error", message: "The email couldn't be sent." };
      }
    },
  };
}

/** The local outbox is on only when asked for, against a localhost database, and never on Vercel. */
export function outboxOn(env: Env = process.env): boolean {
  return env.BRAZEWORK_LOCAL_OUTBOX === "1" && env.VERCEL !== "1"
    && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
}
export const outboxFile = (env: Env = process.env) => env.BRAZEWORK_OUTBOX_FILE || `${(env.TMPDIR || "/tmp").replace(/\/$/, "")}/brazework-outbox.jsonl`;

export function localOutbox(env: Env = process.env): EmailProvider {
  return {
    name: "local-outbox",
    enabled: true,
    async send(e) {
      const { appendFile } = await import("node:fs/promises");
      const id = `local-${Date.now().toString(36)}`;
      await appendFile(outboxFile(env), JSON.stringify({ id, at: new Date().toISOString(), ...e }) + "\n");
      return { ok: true, id };
    },
  };
}

export function mailer(env: Env = process.env): EmailProvider {
  const r = resendProvider(env);
  if (r.enabled) return r;
  return outboxOn(env) ? localOutbox(env) : emailOff;
}
