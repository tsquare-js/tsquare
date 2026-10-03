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
