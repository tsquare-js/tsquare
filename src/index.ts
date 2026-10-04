/// <reference types="node" preserve="true" />
// Main API: wireframe text in, SVG/PNG out.
export { renderWireframe, compileWireframe, formatIssues, WireframeError, type CompileResult } from "./compile.js";
export { wireframePrompt, repairPrompt } from "./prompt.js";
export { printWireframeText as formatWireframe } from "./print.js";
export { encodeWireframe, decodeWireframe, MAX_SHARED_TEXT } from "./share.js";
export { mcpTools, MCP_INSTRUCTIONS, wireframeGuide, renderWireframeTool, shareWireframeTool, callMcpTool, type ToolResult, type ToolContent, type ToolOptions, type McpToolName } from "./mcp.js";
export { upgradeWireframe, upgradeSpec, RENAMED_PROPS, type UpgradeOptions } from "./upgrade.js";

// Lower level: the compiled spec and the pieces used to render it.
export { renderWireframeSvg, renderWireframePng, checkSpec, boardSize, boardLayout, type BoardItem, type RenderWireframeOptions } from "./render.js";
export { parseWireframeText, type TextIssue, type ParseResult } from "./text.js";
export { catalog, componentDefinitions } from "./catalog.js";
export { registry } from "./components.js";
export { theme, DEVICES } from "./layout.js";
