/// <reference types="node" preserve="true" />
// Main API: wireframe text in, SVG/PNG out.
export { renderWireframe, compileWireframe, formatIssues, WireframeError, type CompileResult } from "./compile.js";
export { wireframePrompt, repairPrompt } from "./prompt.js";
export { printWireframeText as formatWireframe } from "./print.js";
export { encodeWireframe, decodeWireframe, MAX_SHARED_TEXT } from "./share.js";
export { mcpTools, MCP_INSTRUCTIONS, LINK_KINDS, DEFAULT_LINKS, type LinkKind, wireframeGuide, renderWireframeTool, shareWireframeTool, callMcpTool, type ToolResult, type ToolContent, type ToolOptions, type McpToolName } from "./mcp.js";
export { upgradeWireframe, upgradeSpec, RENAMED_PROPS, type UpgradeOptions } from "./upgrade.js";
// In a browser: replace the page's ```tsquare code blocks with their boards (what the standalone script runs on load).
export { renderAll, DEFAULT_SELECTOR, type RenderAllOptions, type RenderAllResult } from "./dom.js";

// Where each element and flow is drawn, and what is under a point or a line (click an element of a board).
export { measureElements, elementsAt, elementsAtLine, type Measured, type MeasuredElement, type MeasuredFlow, type MeasuredBox, type MeasureOptions } from "./measure.js";

// Lower level: the compiled spec and the pieces used to render it.
export { renderWireframeSvg, renderWireframePng, checkSpec, boardSize, boardLayout, measureBoardLayout, type BoardItem, type RenderWireframeOptions } from "./render.js";
export { parseWireframeText, type TextIssue, type ParseResult } from "./text.js";
export { catalog, componentDefinitions } from "./catalog.js";
export { registry } from "./components.js";
export { theme, DEVICES } from "./layout.js";
// For editors: what highlighting and autocomplete need, derived from the catalog.
export { languageData, type LanguageData, type ComponentInfo, type PropInfo } from "./playground/language-data.js";
