/**
 * The MCP tools (guide, render, share) as plain functions, with no MCP SDK: tsquare.dev wraps them
 * in its hosted endpoint (tsquare.dev/mcp), and a local stdio server can reuse them unchanged.
 *
 * Results use the MCP tool-result shape ({ content, isError }), so a server returns them as they are.
 * Problems come back as a result with isError, not a thrown error, so the model reads them and fixes
 * its text: the messages are the same line-numbered ones `tsquare check` prints.
 */
import { z } from "zod";
import { compileWireframe, formatIssues } from "./compile.js";
import { languageReference } from "./prompt.js";
import { boardSize, renderWireframePng } from "./render.js";
import { encodeWireframe, MAX_SHARED_TEXT } from "./share.js";

export type ToolContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
  [key: string]: unknown;
}

export interface ToolOptions {
  /** Where share and image links point (default https://tsquare.dev). */
  base?: string;
}

/** Longest side of the PNG a model gets back. Models downscale anything bigger, and it keeps the result small. */
export const MODEL_IMAGE_MAX = 1600;
/** Longest image link the site serves (its render URLs cap the data at this many characters). */
export const MAX_IMAGE_LINK_DATA = 16_000;

const DEFAULT_BASE = "https://tsquare.dev";

/** Short server instructions: what the tools are for and the order to use them in. */
export const MCP_INSTRUCTIONS =
  "tsquare draws low-fidelity UI wireframes from a small text language: multi-screen boards with notes and flow arrows, grayscale by default. " +
  "Call wireframe_guide once before writing your first wireframe, then render_wireframe to check and see it, and share_wireframe to give the user links.";

const textInput = z
  .string()
  .max(MAX_SHARED_TEXT)
  .describe("The wireframe in tsquare text (a ```tsquare code fence around it is fine).");
const flowsInput = z.boolean().optional().describe("Draw flow arrows (default true). false leaves them out, as if there were no flow lines.");

/** The link kinds share_wireframe offers: the playground's Copy link menu, with the same names. */
export const LINK_KINDS = ["share", "svg", "png", "markdown", "html"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
/** What a plain "share it" gets: one image link and the link to edit it. */
export const DEFAULT_LINKS: LinkKind[] = ["svg", "share"];
const LINK_LABELS: Record<LinkKind, string> = {
  share: "Share link (opens it in the playground to view and edit)",
  svg: "Image link (SVG)",
  png: "Image link (PNG)",
  markdown: "Markdown",
  html: "HTML",
};
const linksInput = z
  .array(z.enum(LINK_KINDS))
  .min(1)
  .optional()
  .describe(
    "Which links to return; ask only for what the user needs, since each link is long. share: open and edit it in the playground. svg: an image link to view or embed. png: an image link for tools that don't show SVG. markdown: an image for READMEs and docs. html: an <img> tag for web pages. Default [svg, share].",
  );

const GUIDE_HEADER = `# Writing tsquare wireframes

Workflow:
1. Write the wireframe text for the user's request, following the language below.
2. Call render_wireframe with it. If it reports problems, fix every line it names and render again.
3. Look at the image for what the checker can't see: content cut off at the bottom of a screen (make the screen taller with height=… or remove content), cramped rows, text that wraps badly. Fix and render again.
4. Call share_wireframe with only the links the user needs (links=[…]; by default an image link and the share link to edit it), and give them to the user exactly as returned: each link carries the whole wireframe, so one changed character breaks it. Show the wireframe text too, in a \`\`\`tsquare code block, so they can keep it.
`;

export const mcpTools = {
  wireframe_guide: {
    title: "tsquare language guide",
    description:
      "How to write a tsquare wireframe: the text format, the rules, a worked example and every component with its props. Call it once before writing your first wireframe.",
    inputSchema: z.object({}),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  render_wireframe: {
    title: "Render a wireframe",
    description:
      "Check tsquare wireframe text and render it. Returns a PNG of the board so you can see it, or the problems by line number (with the valid options) if the text isn't valid. Fix every problem and call it again.",
    inputSchema: z.object({ text: textInput, flows: flowsInput }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  share_wireframe: {
    title: "Share a wireframe",
    description:
      "Links for valid tsquare wireframe text, the same kinds as the playground's Copy link menu: a share link to edit it in the playground, image links (SVG, PNG), Markdown and HTML. Ask only for the links the user needs (default: an SVG image link and the share link). Each link contains the whole wireframe text (compressed), so anyone with a link can read it.",
    inputSchema: z.object({ text: textInput, flows: flowsInput, links: linksInput }),
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
} as const;

export type McpToolName = keyof typeof mcpTools;

const text = (t: string): ToolContent => ({ type: "text", text: t });
const problems = (issues: Parameters<typeof formatIssues>[0]): ToolResult => ({
  content: [text(`The wireframe has ${issues.length} problem${issues.length === 1 ? "" : "s"}. Fix each line and try again.\n${formatIssues(issues)}`)],
  isError: true,
});

/** The wireframe_guide tool: workflow plus the language reference. */
export function wireframeGuide(): ToolResult {
  return { content: [text(`${GUIDE_HEADER}\n${languageReference()}`)] };
}

/** The render_wireframe tool: a PNG sized for a model to look at, or line-numbered problems. */
export async function renderWireframeTool(args: { text: string; flows?: boolean }): Promise<ToolResult> {
  const { spec, issues } = compileWireframe(args.text);
  if (!spec || issues.length) return problems(issues);
  const flows = args.flows !== false;
  const { width, height } = boardSize(spec, { flows });
  const scale = Math.min(1, MODEL_IMAGE_MAX / Math.max(width, height));
  const png = await renderWireframePng(spec, { skipValidation: true, flows, scale });
  const shown = scale < 1 ? `, shown at ${Math.round(width * scale)}×${Math.round(height * scale)}` : "";
  return {
    content: [
      text(`Valid. The board is ${width}×${height}${shown}. Check the image for clipped or cramped content, then call share_wireframe for links.`),
      { type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" },
    ],
  };
}

/** The share_wireframe tool: image and playground links, computed locally (nothing is sent anywhere). */
export function shareWireframeTool(args: { text: string; flows?: boolean; links?: LinkKind[] }, opts: ToolOptions = {}): ToolResult {
  const { spec, issues } = compileWireframe(args.text);
  if (!spec || issues.length) return problems(issues);
  const base = (opts.base ?? DEFAULT_BASE).replace(/\/+$/, "");
  // links carry the bare text: a fence line is skipped by the parser, but would show up in the playground
  const bare = args.text.replace(/^[ \t]*```.*(\r?\n|$)/gm, "").trim() + "\n";
  // decodeWireframe caps the text in UTF-8 bytes, which the schema's character limit doesn't bound
  if (Buffer.byteLength(bare, "utf8") > MAX_SHARED_TEXT)
    return { content: [text(`This wireframe is too long to share as a link (over ${MAX_SHARED_TEXT / 1000} KB of text). Split it into smaller boards.`)], isError: true };
  const data = encodeWireframe(bare);
  const query = args.flows === false ? "?flows=0" : "";
  const title = String((spec.elements[spec.root]?.props as Record<string, unknown> | undefined)?.title ?? "Wireframe");
  const kinds = [...new Set(args.links?.length ? args.links : DEFAULT_LINKS)];
  const share = `${base}/playground#${data}`;
  const lines: string[] = [];
  const notes = ["Give each link exactly as written: it carries the whole wireframe, so anyone with it can read the wireframe, and one changed character breaks it."];
  if (data.length > MAX_IMAGE_LINK_DATA && kinds.some((k) => k !== "share")) {
    // the site's render URLs cap the data; the playground's #fragment has no such limit
    if (!kinds.includes("share")) kinds.unshift("share");
    notes.unshift("This wireframe is too long for an image link, so only the share link is included. To get image links, split it into smaller boards.");
  }
  const svg = `${base}/svg/${data}${query}`;
  for (const kind of kinds) {
    if (kind !== "share" && data.length > MAX_IMAGE_LINK_DATA) continue;
    const link = {
      share,
      svg,
      png: `${base}/png/${data}${query}`,
      markdown: `![${title.replace(/[[\]\n]/g, " ")}](${svg})`,
      html: `<img src="${svg}" alt="${title.replace(/["\n]/g, (c) => (c === '"' ? "&quot;" : " "))}">`,
    }[kind];
    lines.push(`${LINK_LABELS[kind]}: ${link}`);
  }
  return { content: [text([...lines, "", ...notes].join("\n"))] };
}

/** Run a tool by name, for servers that dispatch by name. Unknown names come back as an error result. */
export async function callMcpTool(name: string, args: Record<string, unknown> = {}, opts: ToolOptions = {}): Promise<ToolResult> {
  if (name === "wireframe_guide") return wireframeGuide();
  if (name !== "render_wireframe" && name !== "share_wireframe")
    return { content: [text(`Unknown tool "${name}". Tools: ${Object.keys(mcpTools).join(", ")}.`)], isError: true };
  const parsed = mcpTools[name].inputSchema.safeParse(args);
  if (!parsed.success) return { content: [text(`Invalid arguments: ${z.prettifyError(parsed.error)}`)], isError: true };
  return name === "render_wireframe" ? renderWireframeTool(parsed.data) : shareWireframeTool(parsed.data, opts);
}
