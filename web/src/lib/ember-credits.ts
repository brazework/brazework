export const EMBER_CREDIT_COST = {
  ask: 1,
  post: 2,
  group_ask: 2,
  chat_summary: 2,
  organize: 2,
  writeup: 3,
  // Torch carrying on after a yes (supabase/ember-follow.sql): free, up to 3 after each ask.
  follow: 0,
} as const;

export type EmberAction = keyof typeof EMBER_CREDIT_COST;

export function emberCreditCost(action: EmberAction): string {
  const cost = EMBER_CREDIT_COST[action];
  return cost === 0 ? "free" : cost === 1 ? "1 credit" : `${cost} credits`;
}

export const EMBER_UNAVAILABLE = "Torch isn't available right now. Try again in a minute.";
export const EMBER_INSUFFICIENT = "Not enough Torch credits for this action. Credits reset at midnight UTC.";
