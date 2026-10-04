/**
 * The link encoding used by render URLs (tsquare.dev/svg/<data>) and share
 * links (tsquare.dev/playground#<data>):
 *
 *   data = "y" + base64url(deflate-raw(utf-8 text))
 *
 * The leading letter names the language version the text was written in, so links
 * already pasted into docs keep meaning what they meant. Never change what an
 * existing prefix means.
 *   "z": before 0.6.0. Text that old may have trailing `# comments` (before 0.3.0),
 *        including `#word`, which since 0.6.0 would be an id; decoding moves them
 *        onto their own line, as they meant then.
 *   "y": 0.6.0 and later (`#name` after an element is its id).
 * The playground has a browser version of encode and decode (it uses
 * CompressionStream); any raw-deflate stream decodes the same way.
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { LEGACY_LINK_PREFIX, LINK_PREFIX, isLinkData } from "./link-prefix.js";
import { upgradeWireframe } from "./upgrade.js";

/** Largest decoded text accepted, in bytes. Plenty for a board; stops a tiny URL from inflating into megabytes. */
export const MAX_SHARED_TEXT = 64_000;

export function encodeWireframe(text: string): string {
  return LINK_PREFIX + deflateRawSync(Buffer.from(text, "utf8"), { level: 9 }).toString("base64url");
}

/**
 * The wireframe a link carries, upgraded to the current language: a link made
 * by an older version means today what it meant then (see upgrade.ts).
 */
export function decodeWireframe(data: string): string {
  const prefix = data.slice(0, 1);
  if (!isLinkData(data)) throw new Error(`unknown encoding "${prefix}" (expected a "${LINK_PREFIX}" or "${LEGACY_LINK_PREFIX}" prefix)`);
  const text = inflateRawSync(Buffer.from(data.slice(1), "base64url"), { maxOutputLength: MAX_SHARED_TEXT }).toString("utf8");
  return upgradeWireframe(text, { fromLink: prefix === LEGACY_LINK_PREFIX });
}
