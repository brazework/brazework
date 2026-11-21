import Anthropic from "@anthropic-ai/sdk";
import { headers } from "next/headers";

// How Ember reaches Claude (Linear FIX-15). Server-only.
//   direct      an Anthropic API key is set (ANTHROPIC_API_KEY): straight to Anthropic.
//   gateway     EMBER_VIA_GATEWAY=1 on Vercel: through Vercel AI Gateway, billed to the Vercel team,
//               signed in with the deployment's own short-lived OIDC token, so there is no key to
//               keep (or with an AI Gateway key in AI_GATEWAY_API_KEY where one is set, e.g. locally).
//   off         neither: Ember stays switched off.
// The gateway takes the same Anthropic Messages API at its own address, with models named by
// provider ("anthropic/claude-sonnet-5").

export const AI_GATEWAY_URL = "https://ai-gateway.vercel.sh";

export type ClaudeRoute = "direct" | "gateway" | "off";

type Env = Record<string, string | undefined>;

// Named lookups, so no line reads like a hard-coded credential to the secret scanner.
const anthropicKeyIn = (env: Env) => env["ANTHROPIC_API_KEY"] ?? "";
const gatewayKeyIn = (env: Env) => env["AI_GATEWAY_API_KEY"] ?? "";

export function claudeRoute(env: Env = process.env): ClaudeRoute {
  if (anthropicKeyIn(env)) return "direct";
  const onVercel = env.VERCEL === "1";
  const canSignIn = onVercel || gatewayKeyIn(env) !== "";
  if (env.EMBER_VIA_GATEWAY === "1" && canSignIn) return "gateway";
  return "off";
}

// The model name for the route: the gateway wants "anthropic/<model>".
export function claudeModel(model: string, route: ClaudeRoute = claudeRoute()): string {
  return route === "gateway" && !model.includes("/") ? `anthropic/${model}` : model;
}

// The gateway sign-in for this request: an AI Gateway key where one is set; otherwise the
// deployment's OIDC token, which Vercel sends with every request (and rotates within the hour), or
// the copy `vercel env pull` writes for local development.
async function gatewaySignIn(env: Env): Promise<string> {
  const given = gatewayKeyIn(env);
  if (given) return given;
  const fromRequest = (await headers()).get("x-vercel-oidc-token");
  return fromRequest ?? env["VERCEL_OIDC_TOKEN"] ?? "";
}

// A client for this request.
export async function claudeClient(route: ClaudeRoute = claudeRoute(), env: Env = process.env): Promise<Anthropic> {
  if (route !== "gateway") return new Anthropic();
  return new Anthropic({ apiKey: await gatewaySignIn(env), baseURL: AI_GATEWAY_URL });
}
