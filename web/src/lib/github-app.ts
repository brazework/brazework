import { createHmac, createSign, randomBytes, timingSafeEqual } from "node:crypto";

// Brazework's GitHub App (infra/github-app.json; Linear FIX-92, phase 3), server side: who the App is
// (its JWT), short-lived tokens to read a member's repos, and the signed state that carries a
// "Connect GitHub" round trip. Read-only by design: the App has no write permission on any repo.
// Off (null) until the App's variables are set in Vercel (infra/github-app.mjs push-to-vercel).

export type GitHubConfig = { appId: string; slug: string; clientId: string; clientSecret: string; privateKey: string; api: string; web: string };

export function githubConfig(e: Record<string, string | undefined> = process.env): GitHubConfig | null {
  const { GITHUB_APP_ID: appId, GITHUB_APP_SLUG: slug, GITHUB_APP_CLIENT_ID: clientId, GITHUB_APP_CLIENT_SECRET: clientSecret, GITHUB_APP_PRIVATE_KEY: key } = e;
  if (!appId || !slug || !clientId || !clientSecret || !key) return null;
  // The key is stored base64 (one line); a raw PEM works too.
  const privateKey = key.includes("BEGIN") ? key : Buffer.from(key, "base64").toString("utf8");
  // GITHUB_API_URL / GITHUB_WEB_URL point the e2e tests at a stand-in GitHub; production uses GitHub's.
  return { appId, slug, clientId, clientSecret, privateKey, api: e.GITHUB_API_URL || "https://api.github.com", web: e.GITHUB_WEB_URL || "https://github.com" };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

/** The App's own identity: a JWT signed with its private key (RS256), valid 9 minutes (GitHub allows
 *  10), issued a minute in the past to absorb clock drift. Used only to mint installation tokens. */
export function appJwt(appId: string, privateKey: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000) - 60;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat, exp: iat + 600, iss: appId }));
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64url(sig)}`;
}

/** The state that rides through GitHub's install page and back: which project, which member, when.
 *  Signed with the App's client secret, so it can't be forged or swapped; it expires in 20 minutes. */
export function signState(secret: string, s: { project: string; member: string }, now = Date.now()): string {
  const body = b64url(JSON.stringify({ ...s, exp: now + 20 * 60e3, n: randomBytes(8).toString("hex") }));
  return `${body}.${b64url(createHmac("sha256", secret).update(body).digest())}`;
}

export function verifyState(secret: string, state: string | null | undefined, now = Date.now()): { project: string; member: string } | null {
  if (!state || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(state)) return null;
  const [body, sig] = state.split(".");
  const want = createHmac("sha256", secret).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { project?: unknown; member?: unknown; exp?: unknown };
    if (typeof s.project !== "string" || typeof s.member !== "string" || typeof s.exp !== "number" || s.exp < now) return null;
    return { project: s.project, member: s.member };
  } catch {
    return null;
  }
}

async function gh<T>(c: GitHubConfig, path: string, token: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`${c.api}${path}`, { ...init, headers: { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", authorization: `Bearer ${token}`, "user-agent": "Brazework", ...(init.headers ?? {}) }, cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: ${r.status}`);
  return (await r.json()) as T;
}

// Installation tokens last an hour; keep each until a few minutes before it expires.
const tokens = new Map<number, { token: string; until: number }>();
export async function installationToken(c: GitHubConfig, installationId: number): Promise<string> {
  const hit = tokens.get(installationId);
  if (hit && hit.until > Date.now()) return hit.token;
  const r = await gh<{ token: string; expires_at: string }>(c, `/app/installations/${installationId}/access_tokens`, appJwt(c.appId, c.privateKey), { method: "POST" });
  tokens.set(installationId, { token: r.token, until: Date.parse(r.expires_at) - 5 * 60e3 });
  return r.token;
}

/** Swap the code from GitHub's sign-in for the member's (short-lived) GitHub token. */
export async function userToken(c: GitHubConfig, code: string): Promise<string> {
  const r = await fetch(`${c.web}/login/oauth/access_token`, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, code }), cache: "no-store" });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string };
  if (!r.ok || !j.access_token) throw new Error("GitHub sign-in didn't complete");
  return j.access_token;
}

export type Installation = { id: number; account: { login: string; type: "User" | "Organization" } };
/** Installations of the App this GitHub user can reach: the proof that they have access. */
export async function userInstallations(c: GitHubConfig, token: string): Promise<{ user: { id: number; login: string }; installations: Installation[] }> {
  const [user, list] = await Promise.all([
    gh<{ id: number; login: string }>(c, "/user", token),
    gh<{ installations: Installation[] }>(c, "/user/installations?per_page=100", token),
  ]);
  return { user, installations: list.installations };
}

export type Repo = { id: number; full_name: string; html_url: string; default_branch: string; private: boolean; pushed_at: string | null };
/** Repos the member granted the App on one installation. */
export async function installationRepos(c: GitHubConfig, installationId: number): Promise<Repo[]> {
  const t = await installationToken(c, installationId);
  const r = await gh<{ repositories: Repo[] }>(c, "/installation/repositories?per_page=100", t);
  return r.repositories;
}

/** The last 90 days of a repo's merged pull requests and published releases, as webhook-shaped
 *  payloads, so the backfill goes through exactly the same rules as live deliveries. */
export async function recentHistory(c: GitHubConfig, installationId: number, repo: Repo, now = Date.now()): Promise<{ event: string; payload: Record<string, unknown> }[]> {
  const t = await installationToken(c, installationId);
  const since = now - 90 * 864e5;
  const [pulls, releases] = await Promise.all([
    gh<{ number: number; title: string; html_url: string; merged_at: string | null; user?: { login: string } }[]>(c, `/repos/${repo.full_name}/pulls?state=closed&sort=updated&direction=desc&per_page=50`, t),
    gh<{ id: number; tag_name: string; name: string | null; html_url: string; draft: boolean; prerelease: boolean; published_at: string | null; author?: { login: string } }[]>(c, `/repos/${repo.full_name}/releases?per_page=30`, t),
  ]);
  const repository = { id: repo.id, full_name: repo.full_name, html_url: repo.html_url, default_branch: repo.default_branch };
  return [
    ...pulls.filter((p) => p.merged_at && Date.parse(p.merged_at) > since).map((p) => ({ event: "pull_request", payload: { action: "closed", repository, pull_request: { ...p, merged: true } } })),
    ...releases.filter((r) => !r.draft && r.published_at && Date.parse(r.published_at) > since).map((r) => ({ event: "release", payload: { action: "published", repository, release: r } })),
  ];
}
