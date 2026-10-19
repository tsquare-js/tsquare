import { deflateRawSync, inflateRawSync } from "node:zlib";

// Raw deflate + base64url for share links (share.ts).
// deflate.browser.ts replaces this file in the browser build (dist/browser/).
export const deflateToBase64url = (text: string) =>
  deflateRawSync(Buffer.from(text, "utf8"), { level: 9 }).toString("base64url");

export const inflateFromBase64url = (data: string, maxOutputLength: number) =>
  inflateRawSync(Buffer.from(data, "base64url"), { maxOutputLength }).toString("utf8");
