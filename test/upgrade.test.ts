/**
 * Older syntax: renames are always upgraded; link-only rules apply to text from links
 * made by an older version, and never change what current text means.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { decodeWireframe, encodeWireframe } from "../src/share.js";
import { upgradeSpec, upgradeWireframe } from "../src/upgrade.js";
import { LEGACY_LINK_PREFIX, LINK_PREFIX } from "../src/link-prefix.js";
import { list, read } from "./helpers.js";

/** A link as versions before 0.6.0 made it ("z" prefix). */
const zLink = (text: string) => "z" + deflateRawSync(Buffer.from(text, "utf8")).toString("base64url");

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

test("current text is unchanged as a link", () => {
  for (const f of list("examples", ".tsq")) assert.equal(decodeWireframe(encodeWireframe(read(f))), read(f), f);
});

test("decodeWireframe upgrades old (z) links", () => {
  const old = 'board\n  screen phone "Home"   # main\n    button "Get" icon=download\n';
  assert.equal(decodeWireframe(zLink(old)), 'board\n  # main\n  screen phone "Home"\n    button "Get" leadingIcon=download\n');
});

test("in a z link, #word is a comment, as it was then; in a y link it's an id", () => {
  const text = 'board\n  screen phone\n    button "Go" #todo fix later\n    button "Stop" #todo';
  assert.equal(decodeWireframe(zLink(text)), 'board\n  screen phone\n    #todo fix later\n    button "Go"\n    #todo\n    button "Stop"');
  assert.equal(decodeWireframe(encodeWireframe('    button "Go" #cta')), '    button "Go" #cta');
});

test("upgradeSpec renames props in JSON specs", () => {
  const spec = { root: "b", elements: { b: { type: "Button", props: { label: "Go", icon: "star" } } } };
  assert.deepEqual(upgradeSpec(spec).elements.b.props, { label: "Go", leadingIcon: "star" });
});

test("the playground recognizes links by the shared prefixes, not its own copy", () => {
  // 0.6.0 shipped a playground that only opened #z links, so its own new #y share links did nothing
  const app = read("src/playground/app.ts");
  assert.doesNotMatch(app, /["'`]#?[yz]["'`]/, "no hard-coded prefix letters in the playground");
  assert.match(app, /isLinkData\(location\.hash\.slice\(1\)\)/);
  assert.equal(encodeWireframe("board")[0], LINK_PREFIX);
  assert.equal(decodeWireframe(zLink("board")), "board", `${LEGACY_LINK_PREFIX} links still decode`);
});
