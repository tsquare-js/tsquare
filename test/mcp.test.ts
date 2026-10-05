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

/** The links in a share result, by label ("Share link …", "Image link (SVG)", …). */
const linksOf = (r: Parameters<typeof textOf>[0]) =>
  Object.fromEntries(textOf(r).split("\n").filter((l) => /^(Share link|Image link|Markdown|HTML)/.test(l)).map((l) => [l.slice(0, l.indexOf(": ")), l.slice(l.indexOf(": ") + 2)]));

test("share links decode to the text without its code fence", () => {
  const r = shareWireframeTool({ text: "```tsquare\n" + valid + "\n```\n", flows: false });
  const data = textOf(r).match(/\/playground#(\S+)/)![1];
  assert.equal(decodeWireframe(data), valid + "\n");
  assert.match(linksOf(r)["Image link (SVG)"], /^https:\/\/tsquare\.dev\/svg\/y\S+\?flows=0$/);
});

test("share returns an image link and the share link by default", () => {
  const links = linksOf(shareWireframeTool({ text: valid }));
  assert.deepEqual(Object.keys(links), ["Image link (SVG)", "Share link (opens it in the playground to view and edit)"]);
  assert.match(textOf(shareWireframeTool({ text: valid })), /one changed character breaks it/);
});

test("share returns only the links asked for, in that order", () => {
  const r = shareWireframeTool({ text: valid, links: ["markdown", "png", "html", "png"] }, { base: "http://localhost:3000/" });
  const links = linksOf(r);
  assert.deepEqual(Object.keys(links), ["Markdown", "Image link (PNG)", "HTML"]);
  assert.match(links.Markdown, /^!\[Sign in\]\(http:\/\/localhost:3000\/svg\/y\S+\)$/);
  assert.match(links["Image link (PNG)"], /^http:\/\/localhost:3000\/png\/y\S+$/);
  assert.match(links.HTML, /^<img src="http:\/\/localhost:3000\/svg\/y\S+" alt="Sign in">$/);
  const quoted = linksOf(shareWireframeTool({ text: valid.replace('"Sign in"', '"Say \\"hi\\""'), links: ["html"] }));
  assert.match(quoted.HTML, /alt="Say &quot;hi&quot;"/);
});

test("a wireframe too long for an image link gets the share link instead", () => {
  // varied text compresses poorly: over the site's 16,000-character image link limit, under the decoder's 64 KB
  let seed = 7;
  const word = () => Array.from({ length: 8 }, () => String.fromCharCode(97 + ((seed = (seed * 48271) % 2147483647) % 26))).join("");
  const long = ["board", "  screen phone height=99999", ...Array.from({ length: 1200 }, () => `    text "${word()} ${word()} ${word()}"`)].join("\n");
  const r = shareWireframeTool({ text: long, links: ["png"] });
  assert.equal(r.isError, undefined);
  assert.deepEqual(Object.keys(linksOf(r)), ["Share link (opens it in the playground to view and edit)"]);
  assert.match(textOf(r), /too long for an image link/);
});

test("share gives no links for text the decoder would reject", () => {
  // under the schema's character limit, but over the decoder's byte limit, and compresses to a short link
  const long = ["board", "  screen phone height=99999", ...Array.from({ length: 2200 }, () => '    text "日本語のテキスト日本語のテキスト"')].join("\n");
  const r = shareWireframeTool({ text: long });
  assert.equal(r.isError, true);
  assert.match(textOf(r), /too long to share/);
  assert.doesNotMatch(textOf(r), /tsquare\.dev/);
});

test("share refuses invalid text", () => {
  assert.equal(shareWireframeTool({ text: board("bogus") }).isError, true);
});

test("callMcpTool checks names and arguments", async () => {
  assert.equal((await callMcpTool("nope")).isError, true);
  assert.match(textOf(await callMcpTool("render_wireframe", { text: 3 })), /Invalid arguments/);
  assert.equal((await callMcpTool("share_wireframe", { text: valid })).isError, undefined);
  assert.match(textOf(await callMcpTool("share_wireframe", { text: valid, links: ["pdf"] })), /Invalid arguments[^]*links/);
  assert.deepEqual(Object.keys(linksOf(await callMcpTool("share_wireframe", { text: valid, links: ["png"] }))), ["Image link (PNG)"]);
});
