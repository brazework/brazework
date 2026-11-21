// Proof from any tool (lib/proof-source.ts, Linear FIX-235). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { proofSource } from "@/lib/proof-source";

const is = (url: string, tool: string, label: string) => {
  const s = proofSource(url);
  assert.ok(s, url);
  assert.equal(s.tool, tool, url);
  assert.equal(s.label, label, url);
};

test("code: GitHub and the others, named for what the link is", () => {
  is("https://github.com/acme/rig/pull/42", "GitHub", "Pull request #42");
  is("https://github.com/acme/rig/commit/abc1234def", "GitHub", "Commit abc1234");
  is("https://github.com/acme/rig/issues/7", "GitHub", "Issue #7");
  is("https://github.com/acme/rig", "GitHub", "Repository acme/rig");
  is("https://gitlab.com/acme/rig/-/merge_requests/9", "GitLab", "Merge request !9");
  is("https://huggingface.co/spaces/acme/demo", "Hugging Face", "Hugging Face demo");
});

test("every field has its tools: design, CAD, docs, research, tasks, video", () => {
  is("https://www.figma.com/design/AbC123/Onboarding", "Figma", "Figma design");
  is("https://www.figma.com/proto/AbC123/Onboarding", "Figma", "Figma prototype");
  is("https://cad.onshape.com/documents/123/w/456", "Onshape", "Onshape CAD model");
  is("https://a360.co/3xYz", "Fusion", "Fusion CAD model");
  is("https://docs.google.com/spreadsheets/d/1abc/edit", "Google Docs", "Google Sheet");
  is("https://drive.google.com/file/d/1abc/view", "Google Drive", "Google Drive file");
  is("https://acme.notion.site/Test-log-123", "Notion", "Notion page");
  is("https://arxiv.org/abs/2411.01234", "arXiv", "arXiv paper 2411.01234");
  is("https://linear.app/acme/issue/ENG-42/fix-latency", "Linear", "Linear issue ENG-42");
  is("https://acme.atlassian.net/browse/PAY-118", "Jira", "Jira ticket PAY-118");
  is("https://youtu.be/dQw4w9WgXcQ", "YouTube", "YouTube video");
  is("https://www.loom.com/share/abc", "Loom", "Loom recording");
  is("https://apps.apple.com/us/app/x/id123", "App Store", "App Store listing");
});

test("a file anywhere says what kind it is; an unknown site is named by its host", () => {
  is("https://files.example.org/run/expo.mp4", "files.example.org", "Video");
  is("https://files.example.org/bracket.step", "files.example.org", "3D model");
  is("https://lab.example.edu/report.pdf", "lab.example.edu", "PDF file");
  is("https://www.northclinic.org/report", "northclinic.org", "northclinic.org");
});

test("look-alike hosts aren't taken for the real tool", () => {
  assert.equal(proofSource("https://github.com.evil.example/acme/rig/pull/1")?.tool, "github.com.evil.example");
  assert.equal(proofSource("https://notfigma.com/design/x")?.tool, "notfigma.com");
});

test("not a web link: nothing", () => {
  assert.equal(proofSource("not a link"), null);
  assert.equal(proofSource("javascript:alert(1)"), null);
  assert.equal(proofSource(""), null);
});
