/**
 * Error messages feed the model's repair loop, so they're part of the contract:
 * each one names the line and says how to fix it.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestIcons } from "../src/icons.js";
import { board, problems } from "./helpers.js";

const only = (text: string) => {
  const p = problems(text);
  assert.equal(p.length, 1, p.join("\n"));
  return p[0];
};

test("a prop on the wrong component names the component it belongs to", () => {
  assert.match(only(board('input "Email" fullWidth')), /fullWidth is a Button prop, not an Input one; an Input already fills its width/);
  assert.match(only(board('card "x" border=true')), /Card has no prop "border": border is a Stack prop/);
  assert.match(only(board('input "Phone" ghost')), /ghost is a Button option, not an Input one/);
});

test("a prop or list wrapped onto its own line says where it belongs", () => {
  const text = ["board", "  screen phone", "    list", '      listitem "Password"', "        trailing=chevron"].join("\n");
  assert.equal(only(text), "line 5: trailing=…: props go on the same line as their component; move it to the end of line 4");
});

test("comments go on their own line; # elsewhere is text", () => {
  assert.deepEqual(problems(board("# a comment", 'table columns=[Order] data=[[#1001]]', 'text "Order #12345"')), []);
  assert.match(only(board('button "Save" # main action')), /a comment must be on its own line/);
});

test("unknown icons suggest what was meant", () => {
  assert.deepEqual(suggestIcons("chevron"), ["chevron-right", "chevron-left", "chevron-down", "chevron-up"]);
  assert.equal(suggestIcons("compose")[0], "square-pen");
  assert.equal(suggestIcons("call")[0], "phone");
  assert.deepEqual(suggestIcons("serach"), ["search"]);
  assert.match(only(board('button "Go" leadingIcon=compose')), /unknown icon "compose" \(did you mean square-pen/);
});

test("a list item kind written as an icon says to use the kind", () => {
  assert.match(
    only(board("list", '  listitem "Password" trailingIcon=chevron')),
    /chevron is a trailing kind, not an icon name: write trailing=chevron/,
  );
});

test("a list item value that contradicts its kind is an error", () => {
  assert.match(only(board("list", '  listitem "x" leading=avatar leadingIcon=star')), /leadingIcon only shows with leading=icon/);
});

test("a value under the wrong prop name points at the right one", () => {
  assert.match(problems(board("image type=map")).join(), /type is an Input prop, not an Image one; for an Image, write kind=map \(or just map\)/);
  assert.match(problems(board("input kind=date")).join(), /for an Input, write type=date \(or just date\)/);
  assert.match(problems(board("chart type=pie")).join(), /for a Chart, write kind=pie/);
});

test("an invalid value names the prop, the value and the options", () => {
  assert.equal(only(board("input type=otp")), "line 3: Input: type=otp isn't an option; use one of text, password, search, email, date, code");
  assert.equal(only(board('heading "Hi" level=4')), "line 3: Heading: level=4 isn't an option; use one of 1, 2, 3");
  assert.equal(only(board("image height=tall")), "line 3: Image: height=tall should be a number");
  assert.equal(only(board("table columns=Name")), "line 3: Table: columns=Name should be a list like [a, b]");
  assert.equal(only(board("slider range=[1]")), "line 3: Slider: range=[1] needs at least 2 items");
  assert.equal(only(board("grid columns=0")), "line 3: Grid: columns=0 is too small (at least 1)");
});

test("a value that failed doesn't also trip the checks that read it", () => {
  // digits=6 is right for a code input: the only problem is the type
  assert.equal(only(board("input type=otp digits=6")), "line 3: Input: type=otp isn't an option; use one of text, password, search, email, date, code");
  assert.match(only(board('listitem "A" leading=avatr leadingIcon=star')), /leading=avatr isn't an option/);
  // a check that only sees a prop is set still runs: an avatar item can't show any leading icon
  assert.deepEqual(problems(board('listitem "A" leading=avatar leadingIcon=person')), [
    'line 3: ListItem: unknown icon "person" (did you mean user, person-standing?)',
    "line 3: ListItem: leadingIcon only shows with leading=icon (this item has leading=avatar); remove one of them",
  ]);
  // checks that don't use the failed value still run
  assert.deepEqual(problems(board("progress shape=square step=2")), [
    "line 3: Progress: shape=square isn't an option; use one of bar, circle",
    "line 3: Progress: step only shows with steps (e.g. steps=4 step=2)",
  ]);
});

test("an example in a message never repeats the invalid value", () => {
  assert.deepEqual(problems(board("progress step=two")), [
    "line 3: Progress: step=two should be a number",
    "line 3: Progress: step only shows with steps (e.g. steps=4 step=2)",
  ]);
});
