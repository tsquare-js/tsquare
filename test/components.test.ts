/** Component behavior that isn't just drawing: calendar months, page lists, value checks, list items. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWireframe, renderWireframe } from "../src/compile.js";
import { monthGrid, pageList } from "../src/components.js";
import { EXAMPLES } from "../src/playground/reference.js";
import { LABEL_H } from "../src/layout.js";
import { printWireframeText } from "../src/print.js";
import { boardLayout, measureAnchors, measureBoardLayout, renderWireframeSvg } from "../src/render.js";
import { parseWireframeText } from "../src/text.js";
import { board, problems } from "./helpers.js";

test("every component's reference example renders", async () => {
  for (const [name, text] of Object.entries(EXAMPLES)) {
    assert.match(String(await renderWireframe(text, { format: "svg" })), /^<svg /, name);
  }
});

test("the calendar lays out the named month", () => {
  assert.deepEqual(monthGrid("October 2026"), { start: 4, days: 31 }); // starts on a Thursday
  assert.deepEqual(monthGrid("February 2028"), { start: 2, days: 29 }); // leap year
  assert.deepEqual(monthGrid("Sept 2026"), { start: 2, days: 30 });
  assert.deepEqual(monthGrid("Next month"), { start: 3, days: 31 }); // generic when it can't tell
});

test("toast is an overlay: a direct child of a Screen", () => {
  assert.deepEqual(problems(board('text "Saved"', 'toast "Saved" action="Undo"')), []);
  assert.match(problems(board("stack", '  toast "Saved"')).join("\n"), /Toast must be a direct child of a Screen/);
});

test("content taller than its screen is cut off; bars and overlays stay inside the screen", async () => {
  // before 0.12.3 the screen's body grew with its content: toasts and tab bars ended up below the
  // frame (not drawn), modals and bottom drawers too low
  const outside: string[] = [];
  for (const last of ['toast "Saved"', "tabbar items=[{label=Home icon=house}, {label=Search icon=search}] active=0", 'modal "Delete?"', "drawer side=bottom"]) {
    const { spec } = compileWireframe(board('image "Photo" height=900', last));
    const key = Object.keys(spec!.elements).find((k) => spec!.elements[k].type !== "Board" && spec!.elements[k].type !== "Screen" && spec!.elements[k].type !== "Image")!;
    const { boxes } = await measureAnchors(spec!, [key]);
    const [item] = boardLayout(spec!).items;
    const frameBottom = item.y + item.height, frameTop = item.y + LABEL_H;
    const b = boxes[key];
    if (!(b && b.y > frameTop && b.y + b.h <= frameBottom)) outside.push(`${last.split(" ")[0]}: ${JSON.stringify(b)} not inside ${frameTop}–${frameBottom}`);
  }
  assert.deepEqual(outside, []);
});

/** Where each screen's first element sits, against where the board's layout puts that screen. */
async function screenOffsets(names: string[]) {
  const text = ["board", ...names.flatMap((n) => [`  screen phone "${n}"`, '    text "x"'])].join("\n");
  const { spec } = compileWireframe(text);
  const texts = Object.keys(spec!.elements).filter((k) => spec!.elements[k].type === "Text");
  const { boxes } = await measureAnchors(spec!, texts);
  const { items } = boardLayout(spec!);
  return texts.map((k, i) => boxes[k].x - (items[i].x + 18)); // 18: the screen's padding
}

test("a screen name longer than its screen ends in … instead of widening its column", async () => {
  // before 0.12.4 the name widened its column: the screens after it were drawn right of where the
  // board's layout put them, and the last one was cut off at the board's edge
  const names = ["Checkout, error state: the card was declined by the bank", "Done", "ÉCRAN D'ACCUEIL — ÉTAT VIDE, AUCUNE DONNÉE", "Last"];
  assert.deepEqual(await screenOffsets(names), [0, 0, 0, 0]);
});

test("no name too wide for its screen is missed, whatever its characters", async () => {
  // runs of the widest character of each kind, around the length where it stops fitting a phone (390px)
  for (const ch of ["W", "Q", "+", "f", "Œ", "—", "a"]) {
    for (let n = 20; n <= 60; n += 3) {
      const [first, second] = await screenOffsets([ch.repeat(n), "Next"]);
      assert.deepEqual([first, second], [0, 0], `${ch} × ${n}`);
    }
  }
});

test("pagination shows the ends and the current page's neighbours", () => {
  assert.deepEqual(pageList(5, 2), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageList(12, 6), [1, "…", 5, 6, 7, "…", 12]);
  assert.deepEqual(pageList(12, 1), [1, 2, "…", 12]);
  assert.deepEqual(pageList(12, 12), [1, "…", 11, 12]);
});

test("values that contradict each other are errors that say why", () => {
  const cases: [string, RegExp][] = [
    ["progress steps=3 step=5", /step=5 is past the last step \(steps=3\)/],
    ["progress step=2", /step only shows with steps/],
    ["progress circle steps=3", /can't also be a circle/],
    ["pagination pages=5 current=9", /current=9 is past the last page/],
    ["slider range=[80, 20]", /range=\[80, 20\] goes backwards/],
    ["slider value=-5", /value=-5 is too small \(at least 0\)/],
    ["slider value=10 range=[20, 80]", /value \(one handle\) or range \(two\), not both/],
    ['calendar "February 2026" selected=30', /day 30 isn't in February 2026 \(it has 28 days\)/],
    ['calendar "October 2026" range=[18, 12]', /goes backwards/],
    ['input "Code" type=code digits=4 value="12345"', /5 characters but the code has 4 boxes/],
    ['input "Name" digits=4', /digits only applies to type=code/],
  ];
  for (const [line, message] of cases) {
    const p = problems(board(line));
    assert.equal(p.length, 1, `${line}: ${p.join("; ")}`);
    assert.match(p[0], message, line);
  }
});

test("bullets: mixed plain and object items, bare options inside {}", () => {
  const line = 'bullets icon=check items=[Unlimited boards, {label="SSO" icon=x muted}]';
  assert.deepEqual(problems(board(line)), []);
  const { spec } = parseWireframeText(board(line));
  const bullets = Object.values(spec!.elements).find((e) => e.type === "Bullets")!;
  assert.deepEqual(bullets.props.items, ["Unlimited boards", { label: "SSO", icon: "x", muted: true }]);
  assert.match(printWireframeText(spec!), /\{label=SSO icon=x muted\}/);
});

test("an unquoted value in {} can have spaces; muted is still a switch", () => {
  const { spec } = parseWireframeText(board("bullets items=[{label=Custom domain icon=x muted}, {label=Step 1 of 3}]"));
  const bullets = Object.values(spec!.elements).find((e) => e.type === "Bullets")!;
  assert.deepEqual(bullets.props.items, [{ label: "Custom domain", icon: "x", muted: true }, { label: "Step 1 of 3" }]);
});

test("bullet items reject misspelled keys and unknown icons", () => {
  const p = problems(board("bullets items=[A, {label=B icn=x}, {label=C icon=chekc}]"));
  assert.ok(p.some((m) => /Unrecognized key: "icn"/.test(m)), p.join("\n"));
  assert.ok(p.some((m) => /unknown icon "chekc" \(did you mean check/.test(m)), p.join("\n"));
});

test("screens after a row of notes sit where the layout puts them (#44)", async () => {
  // notes wrap for real when drawn; the layout used to estimate their height from the text's length
  const wide = "WARNING: MANDATORY REVIEW WINDOW MUST MATCH WORKFLOW WWW MMM QA APPROVAL";
  const text = ["board layout=grid columns=2", '  screen phone "Top"', '    text "top"', `  note "${wide}"`, `  note "${wide}"`, '  note "Short"', '  screen phone "Below"', '    text "below"'].join("\n");
  const { spec } = compileWireframe(text);
  const texts = Object.keys(spec!.elements).filter((k) => spec!.elements[k].type === "Text");
  const { boxes } = await measureAnchors(spec!, texts); // drawn
  const screens = (await measureBoardLayout(spec!)).items.filter((i) => i.type === "Screen");
  const offset = texts.map((k, i) => boxes[k].y - screens[i].y);
  assert.equal(offset[1], offset[0]); // the screen below the notes is as far from its layout as the one above
  assert.notEqual(boardLayout(spec!).items.filter((i) => i.type === "Screen")[1].y, screens[1].y); // the estimate is off here
});

test("the board is tall enough for a long note", async () => {
  const note = "MANDATORY REVIEW WINDOW: WWW MMM QA APPROVAL. ".repeat(30); // wide letters wrap onto more lines than estimated
  const { spec } = compileWireframe(`board\n  screen phone "Home"\n    text "x"\n  note "${note}"`);
  const { height, items } = await measureBoardLayout(spec!);
  const svg = await renderWireframeSvg(spec!);
  assert.match(svg, new RegExp(`^<svg width="\\d+" height="${height}"`));
  const n = items.find((i) => i.type === "Note")!;
  assert.ok(n.y + n.height <= height, "the note fits on the board");
  assert.ok(n.height > boardLayout(spec!).items.find((i) => i.type === "Note")!.height, "taller than the estimate said");
});
