// The browser build's deflate.ts. Browsers only deflate asynchronously (CompressionStream),
// and encodeWireframe/decodeWireframe are synchronous, so share links need Node for now.
const needsNode = (): never => {
  throw new Error("encodeWireframe and decodeWireframe need Node (node:zlib); the browser build of tsquare renders SVG only");
};
export const deflateToBase64url = (_text: string): string => needsNode();
export const inflateFromBase64url = (_data: string, _max: number): string => needsNode();
