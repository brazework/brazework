// View-only files (supabase/project-files-view-only.sql): Ben posts a PDF write-up and a 3D model on his
// project. Cara, who isn't on its team, sees the model in the viewer straight away and reads the PDF in
// the page, but gets no download button, and opening the file's address in a tab is refused. Nobody,
// not even Ben, gets a download button.
const fs = require("fs"), os = require("os"), path = require("path"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");

const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const stamp = Date.now() % 100000;
const NOTE = `View-only e2e ${stamp}`;
const PDF_NAME = `write-up-${stamp}.pdf`;

// A one-page PDF that says "Stand write-up", with a correct cross-reference table.
function tinyPdf() {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const text = "BT /F1 18 Tf 40 100 Td (Stand write-up) Tj ET";
  objs[3] = `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;
  let out = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "viewonly-"));
const pdf = path.join(dir, PDF_NAME);
fs.writeFileSync(pdf, tinyPdf(), "latin1");
const settled = (v) => v.evaluate((el) => new Promise((ok) => { const t = setInterval(() => { if (["ready", "nogl", "error"].includes(el.dataset.state)) { clearInterval(t); ok(el.dataset.state); } }, 200); setTimeout(() => { clearInterval(t); ok(el.dataset.state); }, 30000); }));

(async () => {
  const b = await browser();
  const ben = await as(b, "ben@forge.test");
  const cara = await as(b, "cara@forge.test");
  let post = "";
  try {
    await step("Ben posts a PDF and a 3D model on his project", async () => {
      await go(ben, "/projects/p1");
      await ben.getByLabel("Post an update").fill(NOTE);
      await ben.locator('input[type="file"][multiple]').first().setInputFiles([pdf, path.join(__dirname, "fixtures", "cube.stl")]);
      await ben.getByRole("list", { name: "Attached" }).getByText(PDF_NAME).waitFor();
      await ben.getByRole("button", { name: /^Post/ }).last().click();
      for (let i = 0; i < 60 && psql(`select count(*) from public.project_files f join public.posts p on p.id = f.post_id where p.body = '${NOTE}'`) !== "2"; i++) await ben.waitForTimeout(500);
      post = psql(`select id from public.posts where body = '${NOTE}'`);
      if (!post) throw new Error("the update wasn't posted");
    }, ben);

    const pdfId = () => psql(`select id from public.project_files where post_id = '${post}' and name = '${PDF_NAME}'`);

    await step("someone outside the team sees the model in the viewer, with no download", async () => {
      await go(cara, "/projects/p1");
      const box = cara.locator('div[aria-label="Attachments"]', { has: cara.getByText(PDF_NAME) }).first();
      await box.waitFor({ timeout: 20000 });
      const v = box.locator("[data-model-viewer]");
      await v.scrollIntoViewIfNeeded();
      if ((await settled(v)) === "error") throw new Error("the model couldn't be shown to a visitor");
      if (await box.getByRole("button", { name: /^Download/ }).count()) throw new Error("a visitor is offered a download");
    }, cara);

    await step("they read the PDF in the page, with no download, and it closes back", async () => {
      const box = cara.locator('div[aria-label="Attachments"]', { has: cara.getByText(PDF_NAME) }).first();
      await box.getByRole("button", { name: `Read ${PDF_NAME}` }).click();
      const viewer = cara.getByRole("dialog", { name: "Document viewer" });
      await viewer.locator('canvas[data-page="1"]').waitFor({ timeout: 20000 });
      if (await viewer.getByRole("button", { name: /Download/ }).count()) throw new Error("the reader offers a download");
      await cara.keyboard.press("Escape");
      await viewer.waitFor({ state: "detached", timeout: 5000 });
    }, cara);

    await step("opening the file's address in a tab is refused for a visitor", async () => {
      const res = await cara.goto(`${BASE}/api/project-files/${pdfId()}`);
      if (res.status() !== 403) throw new Error(`a visitor opening it directly got ${res.status()}`);
      await go(cara, "/projects/p1");
    }, cara);

    await step("nobody gets a download button, not even the owner", async () => {
      await go(ben, "/projects/p1");
      const box = ben.locator('div[aria-label="Attachments"]', { has: ben.getByText(PDF_NAME) }).first();
      await box.getByRole("button", { name: `Read ${PDF_NAME}` }).waitFor({ timeout: 20000 });
      if (await ben.getByRole("button", { name: /^Download/ }).count()) throw new Error("the owner is offered a download");
    }, ben);
  } finally {
    if (post) psql(`delete from public.project_files where post_id = '${post}'; delete from public.posts where id = '${post}'`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  await b.close();
  summary();
})();
