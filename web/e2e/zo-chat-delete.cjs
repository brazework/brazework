// Chat polish: hovering a message shows its emoji and reply bar beside the bubble, and Delete chat clears
// a conversation from your Chats (supabase/chat-delete.sql) while the other person keeps their copy.
const { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const id = (email) => psql(`select id from auth.users where email = '${email}'`);
const BODY = `Delete-chat e2e ${Date.now() % 100000}`;

(async () => {
  const josh = id("josh@forge.test"), maya = id("maya@forge.test");
  const pair = `least('${josh}'::uuid, '${maya}'::uuid), greatest('${josh}'::uuid, '${maya}'::uuid)`;
  psql(`insert into public.conversations (user_a, user_b, started_by, status) values (${pair}, '${maya}', 'active') on conflict (user_a, user_b) do nothing`);
  const conv = psql(`select id from public.conversations where user_a = least('${josh}'::uuid, '${maya}'::uuid) and user_b = greatest('${josh}'::uuid, '${maya}'::uuid)`);
  const readWas = psql(`select coalesce(read_at::text, '') || '|' || coalesce(cleared_at::text, '') from public.conversation_reads where conversation_id = '${conv}' and user_id = '${josh}'`);
  psql(`insert into public.messages (conversation_id, sender_id, body) values ('${conv}', '${maya}', '${BODY}')`);
  const b = await browser();
  const page = await as(b, "josh@forge.test");
  try {
    await step("hovering a message shows its emoji and reply bar beside the bubble", async () => {
      await go(page, `/messages/${conv}`);
      const bubble = page.getByText(BODY).first();
      await bubble.waitFor({ timeout: 15000 });
      await bubble.hover();
      const bar = page.getByRole("toolbar", { name: "Message actions" }).last();
      await bar.waitFor({ state: "visible", timeout: 5000 });
      const [bb, tb] = [await bubble.boundingBox(), await bar.boundingBox()];
      // Their message: the bar sits to its right, level with it, not on top of the messages above.
      if (!(tb.x >= bb.x + bb.width - 2 && tb.y < bb.y + bb.height && tb.y + tb.height > bb.y)) throw new Error(`the bar isn't beside the bubble (${JSON.stringify({ bb, tb })})`);
      await bar.getByRole("button", { name: "Reply" }).waitFor();
    }, page);

    await step("Delete chat clears it from your Chats; the other person keeps it", async () => {
      page.once("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Delete chat" }).click();
      await page.waitForURL(/\/messages$/, { timeout: 15000 });
      await page.getByRole("heading", { name: "Messages" }).waitFor();
      if (await page.locator(`a[href="/messages/${conv}"]`).count()) throw new Error("the deleted chat is still listed");
      await go(page, `/messages/${conv}`);
      await page.getByPlaceholder("Write a message").waitFor({ timeout: 15000 });
      if (await page.getByText(BODY).count()) throw new Error("the cleared messages still show for you");
      if (psql(`select count(*) from public.messages where conversation_id = '${conv}' and body = '${BODY}'`) !== "1") throw new Error("the other person lost their copy");
    }, page);
  } finally {
    psql(`delete from public.messages where conversation_id = '${conv}' and body = '${BODY}'`);
    const [r, c] = readWas.split("|");
    psql(readWas ? `update public.conversation_reads set read_at = ${r ? `'${r}'` : "now()"}, cleared_at = ${c ? `'${c}'` : "null"} where conversation_id = '${conv}' and user_id = '${josh}'` : `delete from public.conversation_reads where conversation_id = '${conv}' and user_id = '${josh}'`);
  }

  await b.close();
  summary();
})();
