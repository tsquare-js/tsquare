/** Anchored overlays: measuring element positions, placing overlays, and the final render. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { findAnchors, parseDate, place } from "../src/anchors.js";
import { compileWireframe } from "../src/compile.js";
import { measureAnchors, renderWireframeSvg } from "../src/render.js";
import { board, problems, read } from "./helpers.js";

const spec = (text: string) => {
  const { spec, issues } = compileWireframe(text);
  assert.deepEqual(issues, []);
  return spec!;
};

test("finds open selects, open date inputs, open menus and tooltips, with their screens", () => {
  const s = spec(board(
    'select "Country" open options=[A, B]',
    'input "Date" type=date open',
    'input "Name" open=false',
    'button "More" open menu=[Edit]',
    'button "Plain" tooltip="Hi"',
  ));
  const anchors = findAnchors(s);
  assert.deepEqual(anchors.map((a) => [s.elements[a.id].type, a.kind, a.field]), [
    ["Select", "options", true],
    ["Input", "calendar", true],
    ["Button", "menu", false],
    ["Button", "tooltip", false],
  ]);
  assert.ok(anchors.every((a) => s.elements[a.screen].type === "Screen"));
});

test("measuring reads back where elements are", async () => {
  // a custom screen without chrome and with known padding
  const s = spec(['board padding=0', '  screen custom width=400 height=300 padding=20 chrome=false', '    select "Country" open options=[A, B]', '    button "Save" tooltip="Hi"'].join("\n"));
  const { anchors, boxes } = await measureAnchors(s);
  const screen = boxes[anchors[0].screen], field = boxes[`${anchors[0].id}#field`], button = boxes[anchors[1].id];
  assert.ok(screen && field && button, "every marker found");
  assert.deepEqual([screen.w, screen.h], [400 - 3, 300 - 3]); // the frame inside its 1.5px border
  // A marker fills its box inside the box's border, so a bordered field measures up to 1.5px in
  // from its outer edge on each side (3px narrower): invisible in the output.
  const near = (actual: number, expected: number, within: number, what: string) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} vs ${expected}`);
  near(field.x - screen.x, 20, 2, "field x"); // the screen's padding
  near(field.w, 400 - 3 - 40, 3, "field width");
  assert.ok(button.y > field.y + field.h, "the button is below the select");
});

test("overlays open below, or above when there's no room, and stay inside the screen", () => {
  const screen = { x: 0, y: 0, w: 400, h: 600 };
  const below = place({ x: 20, y: 100, w: 360, h: 42 }, { w: 360, h: 152 }, screen, { prefer: "below", align: "start", gap: 4 });
  assert.equal(below.side, "below");
  assert.equal(below.y, 146);
  const flipped = place({ x: 20, y: 520, w: 360, h: 42 }, { w: 360, h: 152 }, screen, { prefer: "below", align: "start", gap: 4 });
  assert.equal(flipped.side, "above");
  assert.equal(flipped.bottom, 600 - 516); // pinned by its bottom edge just above the field
  const clamped = place({ x: 380, y: 100, w: 20, h: 20 }, { w: 180, h: 100 }, screen, { prefer: "below", align: "start", gap: 4 });
  assert.equal(clamped.x, 400 - 8 - 180); // pushed back inside the screen
  const tip = place({ x: 180, y: 8, w: 40, h: 20 }, { w: 120, h: 30 }, screen, { prefer: "above", align: "center", gap: 4 });
  assert.equal(tip.side, "below"); // no room above at the top of the screen
});

test("date values give the calendar month and day", () => {
  assert.deepEqual(parseDate("Oct 14, 2026"), { month: "October 2026", day: 14 });
  assert.deepEqual(parseDate("14 October 2026"), { month: "October 2026", day: 14 });
  assert.deepEqual(parseDate("2026-02-03"), { month: "February 2026", day: 3 });
  assert.deepEqual(parseDate("March 2027"), { month: "March 2027", day: undefined });
  assert.equal(parseDate("tomorrow"), null);
});

test("open states need what they show", () => {
  assert.match(problems(board('input "Name" open')).join(), /open shows a date picker, so it needs type=date/);
  assert.match(problems(board('button "More" open')).join(), /add menu=\[…\]/);
  assert.match(problems(board("list", '  listitem "Row" open')).join(), /add menu=\[…\]/);
  assert.match(problems(board('select "Size" open')).join(), /add options=\[…\]/);
  assert.match(problems('board tooltip="x"\n  screen phone\n    text "a"').join(), /Board has no prop "tooltip"/);
  assert.match(problems('board\n  screen phone\n    text "a"\n  note "Check copy" tooltip="x"').join(), /Note has no prop "tooltip"/);
});

test("a custom accent in the marker range doesn't confuse measuring", async () => {
  // the stepper's connecting line is drawn as a plain rect in the accent color, before the screen's marker
  const text = 'board accent=#fe0001\n  screen custom width=400 height=300 padding=20 chrome=false\n    progress steps=3 step=2\n    select "Size" open options=[S, M]';
  const { anchors, boxes } = await measureAnchors(spec(text));
  const screen = boxes[anchors[0].screen];
  assert.ok(screen && Math.abs(screen.w - 397) <= 1, `screen measured as the screen, not the accent button: ${JSON.stringify(screen)}`);
});

test("the final render has the overlays but none of the measuring markers", async () => {
  const text = board('select "Country" value=B open options=[A, B, C]', 'button "Save" tooltip="Saves a draft"');
  const open = await renderWireframeSvg(spec(text));
  const closed = await renderWireframeSvg(spec(text.replace(" open", "").replace(' tooltip="Saves a draft"', "")));
  assert.doesNotMatch(open, /fill="#fe[0-9a-f]{4}"/);
  assert.ok(open.length > closed.length, "the open render draws more");
});

test("boards without overlays render exactly as before (one pass)", async () => {
  const s = spec(read("examples/sign-in.tsq"));
  assert.deepEqual(findAnchors(s), []);
  assert.equal(await renderWireframeSvg(s), await renderWireframeSvg(spec(read("examples/sign-in.tsq"))));
});
