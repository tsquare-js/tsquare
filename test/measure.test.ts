/** Element positions: measureElements, elementsAt (what a click hits, in order) and elementsAtLine. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWireframe } from "../src/compile.js";
import { elementsAt, elementsAtLine, measureElements, type Measured, type MeasuredBox, type MeasuredElement, type MeasuredFlow } from "../src/measure.js";
import { boardLayout } from "../src/render.js";

const BOARD = [
  'board "Sign in"', //                                 1
  '  screen "Sign in" #signin', //                      2
  '    heading "Welcome back"', //                      3
  "    stack", //                                       4
  '      input "Email"', //                             5
  '      button "Send code" primary #send', //          6
  '  screen "Check your email" #check', //             7
  '    text "We sent you a code"', //                  8
  '    button "Resend" tooltip="Wait 30 seconds"', //  9
  '  screen "Expired"', //                             10
  '    text "Your session ended"', //                  11
  '    modal "Session expired"', //                    12
  '      button "Sign in again" primary', //           13
  '  flow send -> check "Code sent"', //               14
].join("\n");

const measure = async (text: string, opts?: { flows?: boolean }) => {
  const { spec, lines, issues } = compileWireframe(text);
  assert.deepEqual(issues, []);
  return measureElements(spec!, lines, opts);
};
const at = (line: number, els: Measured[]) => els.find((e) => e.line === line)!;
const el = (line: number, els: Measured[]) => at(line, els) as MeasuredElement;
const center = (b: MeasuredBox) => [b.x + b.width / 2, b.y + b.height / 2] as const;
const hitLines = (els: Measured[], x: number, y: number, tolerance?: number) => elementsAt(els, x, y, { tolerance }).map((e) => e.line);

test("compileWireframe returns each element's line", () => {
  const { spec, lines } = compileWireframe(BOARD);
  const byLine = Object.fromEntries(Object.entries(lines).map(([k, l]) => [l, spec!.elements[k].type]));
  assert.deepEqual(byLine, { 1: "Board", 2: "Screen", 3: "Heading", 4: "Stack", 5: "Input", 6: "Button", 7: "Screen", 8: "Text", 9: "Button", 10: "Screen", 11: "Text", 12: "Modal", 13: "Button", 14: "Flow" });
});

test("every element and flow, in drawing order, tied to its lines", async () => {
  const els = await measure(BOARD);
  assert.deepEqual(els.map((e) => e.line), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  assert.deepEqual(
    els.filter((e): e is MeasuredElement => e.type !== "Flow").map(({ line, endLine, id, type, label, screenLine, parentLine }) => ({ line, endLine, id, type, label, screenLine, parentLine })).slice(0, 7),
    [
      { line: 1, endLine: 14, id: undefined, type: "Board", label: "Sign in", screenLine: null, parentLine: null },
      { line: 2, endLine: 6, id: "signin", type: "Screen", label: "Sign in", screenLine: null, parentLine: 1 },
      { line: 3, endLine: 3, id: undefined, type: "Heading", label: "Welcome back", screenLine: 2, parentLine: 2 },
      { line: 4, endLine: 6, id: undefined, type: "Stack", label: undefined, screenLine: 2, parentLine: 2 },
      { line: 5, endLine: 5, id: undefined, type: "Input", label: "Email", screenLine: 2, parentLine: 4 },
      { line: 6, endLine: 6, id: "send", type: "Button", label: "Send code", screenLine: 2, parentLine: 4 },
      { line: 7, endLine: 9, id: "check", type: "Screen", label: "Check your email", screenLine: null, parentLine: 1 },
    ],
  );
  const { width, height } = boardLayout(compileWireframe(BOARD).spec!);
  assert.deepEqual(el(1, els).box, { x: 0, y: 0, width, height });
  // a screen: its frame, and the band with its name above it
  const screen = el(2, els);
  assert.equal(screen.labelBox!.y + screen.labelBox!.height, screen.box.y);
  assert.equal(screen.labelBox!.width, screen.box.width);
  // a tooltip is the overlay of the element it belongs to, above it
  const resend = el(9, els);
  assert.ok(resend.overlay && resend.overlay.y + resend.overlay.height <= resend.box.y);
  // a modal is its card, not the dimmed screen behind it
  const modal = el(12, els), expired = el(10, els);
  assert.ok(modal.box.width < expired.box.width && modal.box.height < expired.box.height / 2);

  const flow = at(14, els) as MeasuredFlow;
  assert.deepEqual({ ...flow, path: undefined, labelBox: undefined }, { line: 14, endLine: 14, type: "Flow", label: "Code sent", from: "send", to: "check", fromLine: 6, toLine: 7, path: undefined, labelBox: undefined });
  // the line runs from the button's right edge to the next screen's left edge
  const send = el(6, els).box, check = el(7, els).box;
  const [start, end] = [flow.path[0], flow.path[flow.path.length - 1]];
  assert.ok(Math.abs(start[0] - (send.x + send.width)) <= 1.5 && start[1] > send.y && start[1] < send.y + send.height);
  assert.equal(end[0], check.x);
});

test("what a click hits, most likely meant first", async () => {
  const els = await measure(BOARD);
  const send = el(6, els).box, flow = at(14, els) as MeasuredFlow, label = flow.labelBox!;
  const y = flow.path[0][1];
  const signin = el(2, els).box, check = el(7, els).box;
  // A: a button, then the blocks around it
  assert.deepEqual(hitLines(els, ...center(send)), [6, 4, 2, 1]);
  // B: empty space on a screen
  assert.deepEqual(hitLines(els, signin.x + 40, signin.y + signin.height - 40), [2, 1]);
  // C: the arrow in the gap between screens
  assert.deepEqual(hitLines(els, (signin.x + signin.width + check.x) / 2, y), [14, 1]);
  // D: the label pill comes first, whatever is under it
  assert.deepEqual(hitLines(els, ...center(label)), [14, 4, 2, 1]);
  // E: the arrow over a stack: the flow before the stack
  assert.deepEqual(hitLines(els, (send.x + send.width + label.x) / 2, y), [14, 4, 2, 1]);
  // where the arrow crosses a button, the button first
  assert.deepEqual(hitLines(els, send.x + send.width - 3, y), [6, 14, 4, 2, 1]);
  // F: a tooltip is its element's, and comes first
  assert.deepEqual(hitLines(els, ...center(el(9, els).overlay!)).slice(0, 1), [9]);
  // G, H: inside a modal
  assert.deepEqual(hitLines(els, ...center(el(13, els).box)), [13, 12, 10, 1]);
  const modal = el(12, els).box;
  assert.deepEqual(hitLines(els, modal.x + modal.width - 10, modal.y + modal.height - 10), [12, 10, 1]);
  // I: on the dimmed part beside an open modal, its screen's content is covered
  assert.equal(el(12, els).scrim, true);
  assert.deepEqual(hitLines(els, ...center(el(11, els).box)), [10, 1]);
  // J: a screen's name
  assert.deepEqual(hitLines(els, ...center(el(10, els).labelBox!)), [10, 1]);
  // K: the board
  assert.deepEqual(hitLines(els, 5, 5), [1]);
});

test("without a scrim, what shows beside a modal or drawer is hit as usual; what's under it isn't", async () => {
  const modal = await measure(BOARD.replace('modal "Session expired"', 'modal "Session expired" no-scrim'));
  assert.equal(el(12, modal).scrim, false);
  assert.deepEqual(hitLines(modal, ...center(el(11, modal).box)), [11, 10, 1]);
  assert.deepEqual(hitLines(modal, ...center(el(13, modal).box)), [13, 12, 10, 1]);

  const drawer = await measure(BOARD.replace('modal "Session expired"', "drawer side=right no-scrim"));
  const text = el(11, drawer).box, panel = el(12, drawer).box;
  assert.ok(panel.x > text.x + 10 && panel.x < text.x + text.width); // the panel covers the text's right part
  assert.deepEqual(hitLines(drawer, text.x + 5, text.y + text.height / 2), [11, 10, 1]);
  assert.deepEqual(hitLines(drawer, panel.x + 5, text.y + text.height / 2), [12, 10, 1]);

  // dimmed, the drawer covers its whole screen
  const dimmed = await measure(BOARD.replace('modal "Session expired"', "drawer side=right"));
  assert.equal(el(12, dimmed).scrim, true);
  assert.deepEqual(hitLines(dimmed, text.x + 5, text.y + text.height / 2), [10, 1]);
});

test("a toast hides what's under it, and nothing else", async () => {
  const els = await measure(['board', '  screen phone "Feed"', '    image "Photo" height=760', '    toast "Saved"'].join("\n"));
  const toast = el(4, els).box, image = el(3, els).box;
  assert.ok(toast.width < image.width / 2); // the pill, not the full-width row it's centered in
  assert.ok(toast.y < image.y + image.height); // over the image
  assert.deepEqual(hitLines(els, ...center(toast)), [4, 2, 1]);
  assert.deepEqual(hitLines(els, toast.x - 10, toast.y + toast.height / 2), [3, 2, 1]);
});

test("a flow's line is hit within the tolerance, and only near the line", async () => {
  const els = await measure(BOARD);
  const flow = at(14, els) as MeasuredFlow, signin = el(2, els).box, check = el(7, els).box;
  const x = (signin.x + signin.width + check.x) / 2, y = flow.path[0][1];
  assert.deepEqual(hitLines(els, x, y + 5), [14, 1]);
  assert.deepEqual(hitLines(els, x, y + 10), [1]);
  assert.deepEqual(hitLines(els, x, y + 10, 12), [14, 1]);
  assert.deepEqual(hitLines(els, x, y + 60, 12), [1]);
});

test("the element at a line, innermost first", async () => {
  const els = await measure(BOARD);
  assert.deepEqual(elementsAtLine(els, 5).map((e) => e.line), [5, 4, 2, 1]);
  assert.deepEqual(elementsAtLine(els, 4).map((e) => e.line), [4, 2, 1]);
  assert.deepEqual(elementsAtLine(els, 14).map((e) => e.line), [14, 1]);
  // a comment inside a block gives the block
  const withComment = await measure(BOARD.replace('      input "Email"', '      # the form\n      input "Email"'));
  assert.deepEqual(elementsAtLine(withComment, 5).map((e) => e.line), [4, 2, 1]);
  assert.deepEqual(elementsAtLine(els, 99), []);
});

test("without flows: no flow entries, and boxes for a board drawn without them", async () => {
  const els = await measure(BOARD, { flows: false });
  assert.equal(els.filter((e) => e.type === "Flow").length, 0);
  const { width } = boardLayout(compileWireframe(BOARD).spec!, { flows: false });
  assert.equal(el(1, els).box.width, width);
});

test("content past the bottom of its screen is cut off, or left out when none of it shows", async () => {
  const text = ['board', '  screen phone "Long"', ...Array.from({ length: 20 }, (_, i) => `    image "Photo ${i + 1}" height=120`)].join("\n");
  const els = await measure(text);
  const screen = el(2, els).box;
  const images = els.filter((e): e is MeasuredElement => e.type === "Image");
  assert.ok(images.length > 2 && images.length < 20);
  for (const i of images) assert.ok(i.box.y + i.box.height <= screen.y + screen.height);
  assert.ok(images.at(-1)!.box.height < 120); // the last one shown is cut by the frame
});

test("an element missing from lines gets line 0, which elementsAtLine never returns", async () => {
  const { spec } = compileWireframe(BOARD);
  const els = await measureElements(spec!, {});
  assert.ok(els.every((e) => e.line === 0));
  assert.deepEqual(elementsAtLine(els, 0), []);
});
