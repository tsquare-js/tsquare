/**
 * The link encoding used by render URLs (tsquare.dev/svg/<data>) and share
 * links (tsquare.dev/playground#<data>):
 *
 *   data = "z" + base64url(deflate-raw(utf-8 text))
 *
 * The leading "z" names the encoding, so a future format can use another
 * letter without breaking links already pasted into docs. Never change what an
 * existing prefix means. The playground has a browser version of encode (it
 * uses CompressionStream); any raw-deflate stream decodes the same way.
 */
import { deflateRawSync, inflateRawSync } from "node:zlib";

/** Largest decoded text accepted, in bytes. Plenty for a board; stops a tiny URL from inflating into megabytes. */
export const MAX_SHARED_TEXT = 64_000;

export function encodeWireframe(text: string): string {
  return "z" + deflateRawSync(Buffer.from(text, "utf8"), { level: 9 }).toString("base64url");
}

export function decodeWireframe(data: string): string {
  if (!data.startsWith("z")) throw new Error(`unknown encoding "${data.slice(0, 1)}" (expected a "z" prefix)`);
  return inflateRawSync(Buffer.from(data.slice(1), "base64url"), { maxOutputLength: MAX_SHARED_TEXT }).toString("utf8");
}
