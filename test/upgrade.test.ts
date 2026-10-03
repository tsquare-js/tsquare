/**
 * Older syntax: renames are always upgraded; link-only rules apply to text from links
 * made by an older version, and never change what current text means.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeWireframe, encodeWireframe } from "../src/share.js";
import { upgradeSpec, upgradeWireframe } from "../src/upgrade.js";
import { list, read } from "./helpers.js";

test("renamed props are rewritten in place, on the right components only", () => {
  assert.equal(upgradeWireframe('button "Get" icon=download'), 'button "Get" leadingIcon=download');
  assert.equal(upgradeWireframe('  listitem "Inbox" leading=icon icon=inbox'), '  listitem "Inbox" leading=icon leadingIcon=inbox');
  assert.equal(upgradeWireframe('list-item "A" icon=star'), 'list-item "A" leadingIcon=star');
  for (const same of ['button "icon=x" leadingIcon=star', "tabbar items=[{label=Home icon=house}]", "icon search"]) {
    assert.equal(upgradeWireframe(same), same);
  }
});

test("links: a comment after an element moves onto its own line", () => {
  assert.equal(upgradeWireframe('  screen phone "Home"   # main', { fromLink: true }), '  # main\n  screen phone "Home"');
  assert.equal(
    upgradeWireframe('    button "Get" icon=download # cta', { fromLink: true }),
    '    # cta\n    button "Get" leadingIcon=download',
  );
});

test("links: # that's text today is left alone", () => {
  for (const same of [
    'board "X" accent=#1a73e8',
    "    table columns=[Order] data=[[#1001], [#1002]]",
    '    text "Order #12345"',
    "    avatar #JD",
    "    avatar size=32 #KM",
    "    icon #star",
  ]) {
    assert.equal(upgradeWireframe(same, { fromLink: true }), same);
  }
  // after the avatar's text is set, a #word is an old comment again
  assert.equal(upgradeWireframe('    avatar "AB" # note', { fromLink: true }), '    # note\n    avatar "AB"');
});

test("text without fromLink keeps trailing comments (they're an error for new text)", () => {
  assert.equal(upgradeWireframe('  screen phone "Home"   # main'), '  screen phone "Home"   # main');
});

test("current text is unchanged, even as a link", () => {
  for (const f of list("examples", ".tsq")) assert.equal(upgradeWireframe(read(f), { fromLink: true }), read(f), f);
});

test("decodeWireframe upgrades old links", () => {
  const old = 'board\n  screen phone "Home"   # main\n    button "Get" icon=download\n';
  assert.equal(decodeWireframe(encodeWireframe(old)), 'board\n  # main\n  screen phone "Home"\n    button "Get" leadingIcon=download\n');
});

test("upgradeSpec renames props in JSON specs", () => {
  const spec = { root: "b", elements: { b: { type: "Button", props: { label: "Go", icon: "star" } } } };
  assert.deepEqual(upgradeSpec(spec).elements.b.props, { label: "Go", leadingIcon: "star" });
});
