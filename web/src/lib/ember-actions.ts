// The one-tap things in Ember's composer (components/copilot/composer.tsx). Each is something Ember
// really does with its tools (lib/copilot-agent.ts) and ends in a card the member confirms. An action
// with `finish` starts the sentence and waits for the member to add the rest; the others ask at once.
// Worded for who's asking: a student's work is verified by their club, someone who works asks a
// person who saw it. Pure, so the wording is unit-tested (tests/ember-actions.test.ts).

export type EmberAction = { id: "log" | "post" | "github" | "sign" | "event" | "people"; label: string; text: string; finish?: string };

export function emberActions({ field, student }: { field?: string | null; student: boolean }): EmberAction[] {
  const f = field?.trim();
  return [
    { id: "log", label: "Log what I did", text: "Today I ", finish: "Say what you finished, with a number if you have one. Ember turns it into a milestone for you to check." },
    { id: "post", label: "Write a post", text: "Turn these notes into a post: ", finish: "Paste your notes. Ember writes the post and shows it to you first." },
    { id: "github", label: "Add from GitHub", text: "Add my GitHub repo to my record: github.com/", finish: "Finish the address. Ember reads the README and drafts the project." },
    student
      ? { id: "sign", label: "Get it verified", text: "Help me get my latest milestone verified by my club." }
      : { id: "sign", label: "Get it signed", text: "Help me ask someone who saw my latest milestone to sign it." },
    { id: "event", label: "Find an event", text: "Find an event this week that fits me and RSVP me." },
    { id: "people", label: "Meet people", text: `Find someone in ${f || "my field"} worth meeting and draft an intro message.` },
  ];
}

/** The greeting on a new chat. */
export const emberGreeting = (first: string) => (first.trim() ? `Hi ${first.trim()}, what are we getting done?` : "What are we getting done?");
