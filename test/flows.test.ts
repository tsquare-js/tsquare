/** Flow arrows: ids, flow lines, validation, routing, and the render-time off switch. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWireframe } from "../src/compile.js";
import { linePath, route } from "../src/flows.js";
import { printWireframeText } from "../src/print.js";
import { boardLayout, renderWireframeSvg } from "../src/render.js";
import { parseWireframeText } from "../src/text.js";
import { upgradeWireframe } from "../src/upgrade.js";
import { problems } from "./helpers.js";

const BOARD = [
  'board "Flow"',
  '  screen phone "Sign in" #signin',
  '    button primary "Sign in" #submit',
  '  screen phone "Home" #home',
  '    button "Sign out" #signout',
  '  flow submit -> home "Tap Sign in" line=curved start=dot dashed color=blue',
  "  flow signout -> signin",
].join("\n");

test("ids and flow lines parse, and print back the same way", () => {
  const { spec, issues } = parseWireframeText(BOARD);
  assert.deepEqual(issues, []);
  const els = Object.values(spec!.elements);
  assert.equal(els.find((e) => e.type === "Button" && e.props.label === "Sign in")!.props.id, "submit");
  const flow = els.find((e) => e.type === "Flow")!;
  assert.deepEqual(flow.props, { from: "submit", to: "home", label: "Tap Sign in", line: "curved", start: "dot", dashed: true, color: "blue" });
  const printed = printWireframeText(spec!);
  assert.match(printed, /screen phone "Sign in" #signin/);
  assert.match(printed, /flow submit -> home "Tap Sign in"/);
  assert.deepEqual(parseWireframeText(printed).spec!.elements, spec!.elements);
});

test("flow mistakes are errors that say how to fix them", () => {
  const p = (text: string) => problems(text).join("\n");
  assert.match(p(BOARD.replace("-> home", "-> hme")), /no element has the id #hme \(did you mean #home\?\)/);
  assert.match(p(BOARD.replace("#signout", "#submit")), /the id #submit is also used by the Button on line 3; ids must be unique/);
  assert.match(p(BOARD + "\n  flow home -> home"), /needs two different ends/);
  assert.match(p(BOARD + "\n  flow nope"), /a flow line looks like: flow <from> -> <to>/);
  assert.match(p(BOARD.replace("  flow signout -> signin", "    flow signout -> signin")), /flow lines go at the board level/);
  assert.match(p(BOARD + '\n  note "x" #n'), /Note can't have an id/);
  assert.match(p(BOARD.replace("color=blue", "color=navy")), /navy/);
  assert.match(p(BOARD.replace("#signout", "#Submit")), /the id #Submit is also used by the Button on line 3 \(as #submit; ids ignore case\)/);
});

test("an arrow can't point into a closed accordion", () => {
  const text = 'board\n  screen phone #a\n    button "Go" #go\n  screen phone #b\n    accordion "More"\n      button "Hidden" #hid\n  flow go -> hid';
  assert.match(problems(text).join(), /#hid is inside the Accordion on line 5, which is closed, so it isn't drawn; add open to the accordion/);
  assert.deepEqual(problems(text.replace('accordion "More"', 'accordion "More" open')), []);
});

test("ids ignore case", () => {
  assert.deepEqual(problems(BOARD.replace("#home", "#Home").replace("flow signout -> signin", "flow signout -> SignIn")), []);
  assert.match(problems(BOARD + "\n  flow Home -> home").join(), /needs two different ends/);
});

test("avatar #initials stays initials; ids come after the main text", () => {
  const { spec } = parseWireframeText('board\n  screen phone\n    avatar #jd\n    avatar "AB" #me');
  const avatars = Object.values(spec!.elements).filter((e) => e.type === "Avatar").map((e) => e.props);
  assert.deepEqual(avatars, [{ initials: "#jd" }, { initials: "AB", id: "me" }]);
});

test("routes stay off screens they don't belong to; skips get separate lanes", () => {
  // three screens in a row, 64px apart
  const [s1, s2, s3] = [0, 164, 328].map((x) => ({ x, y: 0, w: 100, h: 200 }));
  const screens = [s1, s2, s3];
  const a = { x: 20, y: 50, w: 60, h: 20 }, b = { x: 184, y: 90, w: 60, h: 20 }, c = { x: 348, y: 120, w: 60, h: 20 };
  const next = route({ from: a, to: b, fromScreen: s1, toScreen: s2 }, screens, 64);
  assert.deepEqual([next.from, next.to, next.lane], ["right", "left", undefined]);
  assert.equal(next.points[1].x, 132, "turns in the middle of the gap");
  const skip = route({ from: a, to: c, fromScreen: s1, toScreen: s3 }, screens, 64);
  assert.deepEqual([skip.from, skip.to], ["right", "left"]);
  assert.ok(skip.lane! > 200, "under the screens, not across the middle one");
  assert.ok(skip.points.every((p) => p.y > 200 || p.x <= 100 || (p.x >= 100 && p.x <= 164) || (p.x >= 264 && p.x <= 328) || p.x >= 348), "only in gaps, the lane, or its own screens");
  const back = route({ from: b, to: a, fromScreen: s2, toScreen: s1 }, screens, 64, 0, 1);
  assert.deepEqual([back.from, back.to, back.lane], ["left", "right", undefined], "a neighbor going back: across the gap");
  assert.notEqual(back.points[1].x, next.points[1].x, "on its own track in the gap");
  const back1 = route({ from: c, to: a, fromScreen: s3, toScreen: s1 }, screens, 64, 0);
  const back2 = route({ from: c, to: a, fromScreen: s3, toScreen: s1 }, screens, 64, 1); // the same skip, as the second lane flow
  assert.deepEqual([back1.from, back1.to], ["left", "right"]);
  assert.notEqual(back1.lane, back2.lane);
  // straight and curved keep the lane's corners, so they don't cut across the middle screen
  for (const line of ["straight", "curved"]) {
    const { d } = linePath(skip, skip.points, line);
    assert.match(d, new RegExp(`\\b${skip.lane}\\b`), `${line} goes through the lane`);
  }
  assert.match(linePath(next, next.points, "straight").d, /^M\S+ \S+ L\S+ \S+$/, "beside its screens, straight is one segment");
  const down = route({ from: { x: 20, y: 20, w: 60, h: 20 }, to: { x: 20, y: 120, w: 60, h: 20 }, fromScreen: s1, toScreen: s1 }, screens, 64);
  assert.deepEqual([down.from, down.to], ["bottom", "top"]);
});

test("with flows off, the board is the same as without its flow lines", async () => {
  const without = compileWireframe(BOARD.split("\n").filter((l) => !l.startsWith("  flow")).join("\n")).spec!;
  const off = await renderWireframeSvg(compileWireframe(BOARD).spec!, { flows: false });
  assert.equal(off, await renderWireframeSvg(without));
  const on = await renderWireframeSvg(compileWireframe(BOARD).spec!);
  assert.notEqual(on, off);
});

test("links keep #ids; an old `# comment` still moves to its own line", () => {
  assert.equal(upgradeWireframe('    button "Go" #cta', { fromLink: true }), '    button "Go" #cta');
  assert.equal(upgradeWireframe('    button "Go" # cta', { fromLink: true }), '    # cta\n    button "Go"');
});

test("a labeled flow between neighbors widens the gap to fit its label, only when flows are drawn", () => {
  const spec = compileWireframe(BOARD).spec!;
  assert.ok(boardLayout(spec).gap > 64, "room for the label");
  assert.equal(boardLayout(spec, { flows: false }).gap, 64);
  assert.equal(boardLayout(compileWireframe(BOARD.replace('board "Flow"', 'board "Flow" gap=40')).spec!).gap, 40, "an explicit gap wins");
  assert.equal(boardLayout(compileWireframe(BOARD.replace(' "Tap Sign in"', "")).spec!).gap, 64, "no label, no change");
});
