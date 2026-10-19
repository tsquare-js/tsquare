/**
 * The components in jsdom with React's client renderer: a board from text, problems by line,
 * the streaming behavior (last good board, dimmed; problems held back), react-markdown's code
 * blocks, and blob URLs released on unmount. jsdom has no URL.createObjectURL, so it's stubbed.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
const created: string[] = [];
const revoked: string[] = [];
before(() => {
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  URL.createObjectURL = () => { const u = `blob:test/${created.length + 1}`; created.push(u); return u; };
  URL.revokeObjectURL = (u: string) => { revoked.push(u); };
});
after(() => dom.window.close());

const SIGN_IN = readFileSync(new URL("../../../examples/sign-in.tsq", import.meta.url), "utf8");
const BROKEN = 'board\n  screen phone\n    buton "Oops"';

// React and the components load after the globals above exist
const load = async () => {
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const lib = await import("../src/index.js");
  const Markdown = (await import("react-markdown")).default;
  return { React, createRoot, act, lib, Markdown };
};

async function mount(element: React.ReactElement) {
  const { createRoot, act } = await load();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    rerender: (el: React.ReactElement) => act(async () => root.render(el)),
    unmount: () => act(async () => root.unmount()),
  };
}

/** Wait until the rendering settles (satori runs asynchronously after the effect). */
async function until(check: () => boolean, what: string) {
  const { act } = await load();
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await act(() => new Promise((r) => setTimeout(r, 25)));
  }
  assert.fail(`timed out waiting for ${what}`);
}

test("Wireframe draws a board as an image with its size and title", async () => {
  const { React, lib } = await load();
  const view = await mount(React.createElement(lib.Wireframe, { source: SIGN_IN, className: "mine" }));
  await until(() => !!view.container.querySelector("img"), "the board");
  const figure = view.container.querySelector("figure")!;
  assert.equal(figure.className, "tsquare-board mine");
  const img = figure.querySelector("img")!;
  assert.match(img.getAttribute("src")!, /^blob:test\//);
  assert.ok(Number(img.getAttribute("width")) > 0 && Number(img.getAttribute("height")) > 0);
  assert.equal(img.getAttribute("alt"), "Wireframe: Sign in");
  assert.equal(figure.getAttribute("aria-busy"), null);
  await view.unmount();
});

test("Wireframe lists problems by line", async () => {
  const { React, lib } = await load();
  const view = await mount(React.createElement(lib.Wireframe, { source: BROKEN }));
  await until(() => !!view.container.querySelector(".tsquare-problems"), "the problems");
  assert.equal(view.container.querySelector("strong")!.textContent, "1 problem in this wireframe");
  assert.match(view.container.querySelector("li")!.textContent!, /^line 3: unknown component "buton" \(did you mean button\?\)/);
  assert.equal(view.container.querySelector("img"), null);
  await view.unmount();
});

test("while streaming, the board keeps the last good version and problems wait until the text is complete", async () => {
  const { React, lib } = await load();
  const el = (source: string, streaming: boolean) => React.createElement(lib.Wireframe, { source, streaming });
  const view = await mount(el(SIGN_IN, true));
  await until(() => !!view.container.querySelector("img"), "the first board");
  const firstSrc = view.container.querySelector("img")!.getAttribute("src");

  // a partial line arrives: not valid yet
  await view.rerender(el(SIGN_IN + "\n    butto", true));
  await until(() => view.container.querySelector("figure")!.getAttribute("aria-busy") === null, "the partial text to be checked");
  assert.equal(view.container.querySelector("img")!.getAttribute("src"), firstSrc, "the last good board stays");
  assert.equal(view.container.querySelector("img")!.style.opacity, "1", "not dimmed mid-stream (it would flicker)");
  assert.equal(view.container.querySelector(".tsquare-problems"), null, "no problems while streaming");

  // the line completes: a new board
  await view.rerender(el(SIGN_IN + '\n    button "Help"', true));
  await until(() => view.container.querySelector("img")!.getAttribute("src") !== firstSrc, "the new board");

  // the reply ends with a mistake: now the problems show, and the last good board is dimmed
  await view.rerender(el(SIGN_IN + "\n    butto", false));
  await until(() => !!view.container.querySelector(".tsquare-problems"), "the problems");
  assert.equal(view.container.querySelector("img")!.style.opacity, "0.4");
  await view.unmount();
});

test("a steady stream still shows boards along the way, not only at the end", async () => {
  const { React, lib } = await load();
  const lines = SIGN_IN.split("\n");
  const view = await mount(React.createElement(lib.Wireframe, { source: lines.slice(0, 3).join("\n"), streaming: true }));
  const seen = new Set<string>();
  // a token every 20 ms, never pausing
  for (let i = 3; i <= lines.length; i++) {
    for (const chunk of [lines.slice(0, i).join("\n").slice(0, -3), lines.slice(0, i).join("\n")]) {
      await view.rerender(React.createElement(lib.Wireframe, { source: chunk, streaming: true }));
      await new Promise((r) => setTimeout(r, 20));
      const src = view.container.querySelector("img")?.getAttribute("src");
      if (src) seen.add(src);
    }
  }
  assert.ok(seen.size >= 1, "a board appeared before the stream ended");
  await view.unmount();
});

test("tsquareComponents: react-markdown's ```tsquare blocks become boards, other code blocks stay", async () => {
  const { React, lib, Markdown } = await load();
  const markdown = `Here's the screen:\n\n\`\`\`tsquare\n${SIGN_IN}\`\`\`\n\nAnd some code:\n\n\`\`\`js\nconst x = 1;\n\`\`\`\n`;
  const view = await mount(React.createElement(Markdown, { components: lib.tsquareComponents }, markdown));
  await until(() => !!view.container.querySelector("figure.tsquare-board img"), "the board");
  assert.equal(view.container.querySelectorAll("figure.tsquare-board").length, 1);
  assert.equal(view.container.querySelector("pre code.language-js")!.textContent, "const x = 1;\n");
  assert.equal(view.container.querySelector("code.language-tsquare"), null);
  await view.unmount();
});

test("WireframeStreaming sets streaming for the boards inside (a reply still arriving in react-markdown)", async () => {
  const { React, lib, Markdown } = await load();
  const reply = (body: string, streaming: boolean) =>
    React.createElement(lib.WireframeStreaming, { value: streaming }, React.createElement(Markdown, { components: lib.tsquareComponents }, body));
  // mid-reply, the fence isn't closed and the text so far has a mistake
  const view = await mount(reply("```tsquare\n" + BROKEN, true));
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(view.container.querySelector(".tsquare-problems"), null, "held back while streaming");
  await view.rerender(reply("```tsquare\n" + BROKEN + "\n```\n", false));
  await until(() => !!view.container.querySelector(".tsquare-problems"), "the problems once the reply is done");
  await view.unmount();
});

test("unmounting releases the board's blob URL", async () => {
  const { React, lib } = await load();
  const view = await mount(React.createElement(lib.Wireframe, { source: SIGN_IN }));
  await until(() => !!view.container.querySelector("img"), "the board");
  const src = view.container.querySelector("img")!.getAttribute("src")!;
  await view.unmount();
  assert.ok(revoked.includes(src));
});
