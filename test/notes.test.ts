/** Notes about what they're indented under: the board, a screen or an element (src/notes.tsx). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileWireframe } from "../src/compile.js";
import { FIELD_LABEL, NOTE_MARKER, NOTE_MARKER_OUT, NOTES_TOP } from "../src/layout.js";
import { elementsAt, elementsAtLine, measureElements, type Measured, type MeasuredElement, type MeasuredFlow } from "../src/measure.js";
import { prepareNotes, screenMarks } from "../src/notes.js";
import { printWireframeText } from "../src/print.js";
import { boardLayout, measureBoardLayout, renderWireframeSvg } from "../src/render.js";
import { problems } from "./helpers.js";

const BOARD = [
  'board "Sign-up"', //                                                        1
  '  screen phone "Create account" #signup', //                                2
  '    input password "Password"', //                                          3
  '      note "At least 8 characters"', //                                     4
  '    checkbox "I agree to the terms"', //                                    5
  '      note "Open question: a sheet or a new page?" color=pink', //          6
  '    button ghost "Skip for now" #skip', //                                  7
  '    spacer', //                                                             8
  '    button primary "Continue" fullWidth #continue', //                      9
  '  screen phone "Verify email" #verify', //                                  10
  '    input type=code digits=6', //                                           11
  '      note "Expires after 10 minutes"', //                                  12
  '    button primary "Verify" fullWidth #confirm', //                         13
  '  screen phone "Welcome" #welcome', //                                      14
  '    note "Shown once" color=blue', //                                       15
  '    heading "You\'re all set"', //                                          16
  '    stack', //                                                              17
  '      radio "Email me tips" checked', //                                    18
  '      radio "Don\'t"', //                                                    19
  '      note "Tips are off by default in the EU"', //                         20
  '  flow continue -> verify "Code sent"', //                                  21
  '  flow confirm -> welcome', //                                              22
  '  flow skip -> welcome "Skip verification"', //                             23
  '  note "Copy is a draft"', //                                               24
].join("\n");

const compile = (text: string) => {
  const r = compileWireframe(text);
  assert.deepEqual(r.issues, []);
  return r;
};
const measure = async (text: string, opts?: Parameters<typeof measureElements>[2]) => {
  const { spec, lines } = compile(text);
  return measureElements(spec!, lines, opts);
};
const at = (line: number, els: Measured[]) => els.find((e) => e.line === line) as MeasuredElement;
/** The board text without its note lines. */
const withoutNotes = (text: string) => text.split("\n").filter((l) => !/^\s*note\b/.test(l)).join("\n");

test("a note can go under any element, and the text prints back the same", () => {
  assert.deepEqual(problems(BOARD), []);
  const printed = printWireframeText(compile(BOARD).spec!);
  assert.equal(printWireframeText(compile(printed).spec!), printed);
  // the notes stay where they're written
  assert.match(printed, /input password "Password"\n {6}note "At least 8 characters"/);
});

test("a note under a flow line is an error that says where notes go", () => {
  const text = 'board\n  screen phone "A" #a\n  screen phone "B" #b\n  flow a -> b\n    note "Why"';
  assert.ok(problems(text).some((p) => /a note can't go under a flow line; indent it under the element or screen it's about/.test(p)), problems(text).join("\n"));
});

test("notes leave the layout and are numbered in the order they're written, across the board", () => {
  const { spec } = compile(BOARD);
  const prepared = prepareNotes(spec!);
  const els = prepared.elements;
  const marks = (name: string) => screenMarks(Object.values(els).find((e) => e.type === "Screen" && (e.props as any).name === name));
  assert.deepEqual(marks("Create account").map((m) => [m.n, m.text, m.onScreen]), [[1, "At least 8 characters", false], [2, "Open question: a sheet or a new page?", false]]);
  assert.deepEqual(marks("Verify email").map((m) => m.n), [3]);
  assert.deepEqual(marks("Welcome").map((m) => [m.n, m.onScreen]), [[4, true], [5, false]]);
  // nothing in a screen holds a note any more; the board note stays on the board
  for (const [k, el] of Object.entries(els)) {
    if (k === prepared.root) continue;
    assert.ok(!(el.children ?? []).some((c) => els[c].type === "Note"), `${k} still holds a note`);
  }
  assert.equal((els[prepared.root].children ?? []).filter((c) => els[c].type === "Note").length, 1);
  // preparing again changes nothing, and the numbers don't depend on the mode
  assert.equal(prepareNotes(prepared), prepared);
  assert.deepEqual(screenMarks(Object.values(prepareNotes(spec!, "markers").elements).find((e) => (e.props as any)?.name === "Welcome")).map((m) => m.n), [4, 5]);
});

test('notes "off" draws exactly the board without its note lines', async () => {
  const off = await renderWireframeSvg(compile(BOARD).spec!, { notes: "off" });
  const none = await renderWireframeSvg(compile(withoutNotes(BOARD)).spec!);
  assert.equal(off, none);
});

test("a board without notes under screens or elements renders as it did (prepareNotes changes nothing)", () => {
  const text = withoutNotes(BOARD) + '\n  note "On the board"';
  const { spec } = compile(text);
  assert.equal(prepareNotes(spec!), spec);
});

test("notes under a screen make it taller by exactly their drawn height; markers and off don't", async () => {
  const { spec } = compile(BOARD);
  const on = await measureBoardLayout(spec!);
  const markers = await measureBoardLayout(spec!, { notes: "markers" });
  const off = await measureBoardLayout(spec!, { notes: "off" });
  assert.ok(on.height > markers.height);
  assert.deepEqual(markers.items.map((i) => i.height), off.items.filter((i) => i.type === "Screen").map((i) => i.height));
  // markers leave the board's own notes out too
  assert.equal(markers.items.filter((i) => i.type === "Note").length, 0);
  assert.equal(on.items.filter((i) => i.type === "Note").length, 1);
  // each screen's last note ends at the bottom of its box on the board
  const els = await measure(BOARD);
  const screens = on.items.filter((i) => i.type === "Screen");
  for (const s of screens) {
    const notes = els.filter((e): e is MeasuredElement => e.type === "Note" && e.box.x === s.x && e.box.y > s.y);
    if (!notes.length) continue;
    const last = notes[notes.length - 1];
    assert.equal(Math.round(last.box.y + last.box.height), Math.round(s.y + s.height), `last note under ${s.name}`);
  }
});

test("measureElements lists each note with its number, its marker and the element it's about", async () => {
  const els = await measure(BOARD);
  const pw = at(3, els), password = at(4, els);
  assert.equal(password.type, "Note");
  assert.equal(password.number, 1);
  assert.equal(password.parentLine, 3);
  assert.equal(password.label, "At least 8 characters");
  // under its screen, as wide as the screen
  const signup = at(2, els);
  assert.equal(password.box.x, signup.box.x);
  assert.equal(password.box.width, signup.box.width);
  assert.equal(password.box.y, signup.box.y + signup.box.height + NOTES_TOP);
  // the marker: just outside the top-right corner of the field's box (below its label)
  const m = password.marker!;
  assert.equal(m.width, NOTE_MARKER);
  assert.equal(m.x + NOTE_MARKER / 2, pw.box.x + pw.box.width + NOTE_MARKER_OUT);
  assert.equal(m.y + NOTE_MARKER / 2, pw.box.y + FIELD_LABEL - NOTE_MARKER_OUT);
  // a note about a screen: its marker follows the screen's name, in the band above the frame
  const welcome = at(14, els), shown = at(15, els);
  assert.equal(shown.number, 4);
  // (lifted 2 px to center on the name's line)
  assert.ok(shown.marker!.y >= welcome.labelBox!.y - 2 && shown.marker!.y + NOTE_MARKER <= welcome.labelBox!.y + welcome.labelBox!.height, "in the name band");
  assert.ok(shown.marker!.x > welcome.labelBox!.x + 40, "after the name");
  // a note about a stack: its marker hangs on the radios, not on the stack's far corner
  const radios = [at(18, els), at(19, els)], group = at(20, els);
  const right = Math.max(...radios.map((r) => r.box.x + r.box.width));
  assert.equal(group.marker!.x + NOTE_MARKER / 2, right + NOTE_MARKER_OUT);
  assert.ok(right < at(17, els).box.x + at(17, els).box.width - 40, "the radios end well before the stack");
});

test("with flows off, screens and notes are measured where that render puts them", async () => {
  const { spec } = compile(BOARD);
  const layout = await measureBoardLayout(spec!, { flows: false });
  const els = await measure(BOARD, { flows: false });
  const screens = els.filter((e): e is MeasuredElement => e.type === "Screen");
  assert.deepEqual(screens.map((s) => s.box.x), layout.items.filter((i) => i.type === "Screen").map((i) => i.x));
  // the labeled arrows widened the gaps with flows on
  assert.ok((await measureBoardLayout(spec!)).width > layout.width);
});

test('with notes "markers", a note is its marker; with "off", notes aren\'t listed', async () => {
  const markers = await measure(BOARD, { notes: "markers" });
  const note = at(4, markers);
  assert.deepEqual(note.box, note.marker);
  assert.equal(at(24, markers), undefined); // the board's own note isn't drawn
  const off = await measure(BOARD, { notes: "off" });
  assert.equal(off.filter((e) => e.type === "Note").length, 0);
});

test("a click on a marker gives its note first; the caret on a note gives the note, then what it's about", async () => {
  const els = await measure(BOARD);
  const note = at(12, els);
  const hit = elementsAt(els, note.marker!.x + NOTE_MARKER / 2, note.marker!.y + NOTE_MARKER / 2);
  assert.equal(hit[0], note);
  // an element's block includes the notes under it (a host replacing the block takes them along)
  assert.equal(at(11, els).endLine, 12);
  assert.deepEqual(elementsAtLine(els, 12).slice(0, 2).map((e) => e.line), [12, 11]);
  // the note under the screen is hit as a leaf
  assert.equal(elementsAt(els, note.box.x + 10, note.box.y + 10)[0], note);
});

test("an arrow that skips a screen runs below the notes under the screens", async () => {
  const els = await measure(BOARD);
  const skip = els.find((e): e is MeasuredFlow => e.type === "Flow" && e.from === "skip")!;
  const lane = Math.max(...skip.path.map(([, y]) => y));
  const lowestNote = Math.max(...els.filter((e): e is MeasuredElement => e.type === "Note" && e.screenLine != null).map((e) => e.box.y + e.box.height));
  assert.equal(lane, lowestNote + 24);
  // without notes the lane is where it always was: 24 px under the screens
  const plain = await measure(withoutNotes(BOARD));
  const plainSkip = plain.find((e): e is MeasuredFlow => e.type === "Flow" && e.from === "skip")!;
  const frames = plain.filter((e): e is MeasuredElement => e.type === "Screen").map((e) => e.box.y + e.box.height);
  assert.equal(Math.max(...plainSkip.path.map(([, y]) => y)), Math.max(...frames) + 24);
});

test("an element that isn't drawn gets no marker, but its note is still listed under the screen", async () => {
  const text = 'board\n  screen phone "A" height=300\n    spacer size=600\n    button "Far below"\n      note "Cut off"';
  const els = await measure(text);
  const note = els.find((e) => e.type === "Note") as MeasuredElement;
  assert.ok(note, "listed");
  assert.equal(note.marker, undefined);
  assert.equal(boardLayout(compile(text).spec!).items[0].height > 300 + 40, true);
});
