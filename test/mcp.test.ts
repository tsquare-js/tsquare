/**
 * The MCP tools as plain functions: what tsquare.dev/mcp returns to a model.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { callMcpTool, decodeWireframe, renderWireframeTool, shareWireframeTool, wireframeGuide } from "../src/index.js";
import { board } from "./helpers.js";

const valid = ['board "Sign in"', '  screen phone "Sign in"', '    button primary "Sign in"'].join("\n");
const textOf = (r: { content: { type: string; text?: string }[] }) => r.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");

test("the guide has the workflow and the whole language", () => {
  const t = textOf(wireframeGuide());
  assert.match(t, /Call render_wireframe/);
  assert.match(t, /## Rules/);
  assert.match(t, /### Button/);
  assert.doesNotMatch(t, /Reply with only the spec/); // that's the plain prompt, not a tool workflow
});

test("render returns a PNG for valid text", async () => {
  const r = await renderWireframeTool({ text: "```tsquare\n" + valid + "\n```" });
  assert.equal(r.isError, undefined);
  const image = r.content.find((c) => c.type === "image");
  assert.ok(image && image.type === "image");
  assert.equal(image.mimeType, "image/png");
  assert.deepEqual([...Buffer.from(image.data, "base64").subarray(1, 4)], [...Buffer.from("PNG")]);
  assert.match(textOf(r), /^Valid\./);
});

test("render scales a wide board down for the model", async () => {
  const wide = ["board", ...Array.from({ length: 3 }, (_, i) => `  screen desktop "S${i}"\n    text "x"`)].join("\n");
  const r = await renderWireframeTool({ text: wide });
  assert.match(textOf(r), /shown at 1600×/);
});

test("render reports problems by line, as an error result", async () => {
  const r = await renderWireframeTool({ text: board('button "Save" bogus') });
  assert.equal(r.isError, true);
  assert.equal(r.content.length, 1);
  assert.match(textOf(r), /1 problem\.[^]*line 3: /);
});

test("share links decode to the text without its code fence", () => {
  const r = shareWireframeTool({ text: "```tsquare\n" + valid + "\n```\n", flows: false });
  const t = textOf(r);
  const data = t.match(/\/playground#(\S+)/)![1];
  assert.equal(decodeWireframe(data), valid + "\n");
  assert.match(t, /^Image \(SVG\): https:\/\/tsquare\.dev\/svg\/y\S+\?flows=0$/m);
  assert.match(t, /^Markdown: !\[Sign in\]\(https:\/\/tsquare\.dev\/svg\//m);
  assert.match(textOf(shareWireframeTool({ text: valid }, { base: "http://localhost:3000/" })), /^Image \(PNG\): http:\/\/localhost:3000\/png\/y\S+$/m);
});

test("share refuses invalid text", () => {
  assert.equal(shareWireframeTool({ text: board("bogus") }).isError, true);
});

test("callMcpTool checks names and arguments", async () => {
  assert.equal((await callMcpTool("nope")).isError, true);
  assert.match(textOf(await callMcpTool("render_wireframe", { text: 3 })), /Invalid arguments/);
  assert.equal((await callMcpTool("share_wireframe", { text: valid })).isError, undefined);
});
