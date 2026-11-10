// Email: one interface, one real provider (Resend's HTTP API) and an "off" provider. Nothing is sent
// unless RESEND_API_KEY and FORGE_EMAIL_FROM are set. Sign-in emails are separate (Supabase Auth).
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

export function mailer(env: Env = process.env): EmailProvider {
  const r = resendProvider(env);
  return r.enabled ? r : emailOff;
}
