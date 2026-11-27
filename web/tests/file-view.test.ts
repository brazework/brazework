import assert from "node:assert/strict";
import { test } from "node:test";
import { viewableKind, viewUrl } from "../src/lib/file-view";

test("PDFs, text and code, and 3D models can be viewed on the page", () => {
  assert.equal(viewableKind("Write-up.PDF"), "pdf");
  assert.equal(viewableKind("notes.md"), "text");
  assert.equal(viewableKind("thrust.csv"), "text");
  assert.equal(viewableKind("controller.ino"), "text");
  assert.equal(viewableKind("bracket.stl"), "model");
  assert.equal(viewableKind("assembly.3mf"), "model");
});

test("Office files, CAD and archives have no in-page preview (only builders download them)", () => {
  for (const name of ["report.docx", "budget.xlsx", "deck.pptx", "part.step", "board.kicad_pcb", "everything.zip", "photo.jpg"]) assert.equal(viewableKind(name), null, name);
});

test("files are viewed through the app's own route, by id", () => {
  assert.equal(viewUrl(42), "/api/project-files/42");
});
