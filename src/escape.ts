/**
 * Escaping for HTML attribute values, shared by the playground's Copy link → HTML and the MCP
 * share tool, so the two give the same <img> tag. & first, or the entities it adds get escaped again.
 */
export const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\r\n]+/g, " ");
