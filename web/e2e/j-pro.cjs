// Pro verification, end to end (Linear FIX-72): an engineer at a verified company sets up as a pro,
// finds a club-verified milestone in their review queue, can't sign it with a one-liner, signs it with
// what they checked, and the member's profile shows the gold "Pro-verified" seal with their name, title
// and employer.
const { step, browser, as, go, hydrated, closeTour, summary } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const cara = await as(b, "cara@forge.test");
  await step("Cara (email at Acme Aerospace) sets up as a pro: employer from her email, role and areas", async () => {
    await go(cara, "/pro");
    await closeTour(cara);
    await cara.getByText("Acme Aerospace").first().waitFor({ timeout: 15000 });
    await hydrated(cara.locator("#pro-title"));
    await cara.fill("#pro-title", "Propulsion Engineer");
    await cara.getByRole("button", { name: "Aerospace", exact: true }).click();
    await cara.getByRole("button", { name: "Start reviewing" }).click();
    await cara.getByRole("region", { name: "Review queue" }).waitFor({ timeout: 20000 });
  }, cara);
  await step("the queue has Ben's club-verified milestone; a one-liner can't be signed; a real note can", async () => {
    const card = cara.getByRole("article", { name: "Review: Static fire at 1.2 kN" });
    await card.waitFor({ timeout: 15000 });
    const note = card.locator("textarea");
    await hydrated(note);
    await note.fill("Looks good.");
    if (await card.getByRole("button", { name: /Pro-verify/ }).isEnabled()) throw new Error("a one-line note could be signed");
    await note.fill("Watched the static fire video and checked the load cell log against the stated 1.2 kN peak.");
    await card.getByRole("button", { name: /Pro-verify/ }).click();
    await card.getByText(/Signed\. It shows on Ben/).waitFor({ timeout: 15000 });
  }, cara);
  await step("Ben's profile shows the Pro seal: who, their title and employer, and what they checked", async () => {
    await go(cara, `/u/${process.env.BEN_ID}`);
    const proof = cara.getByRole("region", { name: "Club-verified work" });
    await proof.getByText("Pro-verified by Cara Diaz").waitFor({ timeout: 15000 });
    await proof.getByText("Propulsion Engineer at Acme Aerospace").waitFor();
    await proof.getByText(/checked the load cell log/).waitFor();
  }, cara);
  summary();
  await b.close();
})();
