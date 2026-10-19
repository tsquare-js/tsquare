/**
 * renderAll(): replaces the wireframe code blocks on a page with their boards, the way Mermaid's
 * script does for its diagrams. Browser code; the standalone script (dist/tsquare.min.js) runs it
 * on load. It finds the HTML that markdown renderers make of a ```tsquare fence:
 *
 *   <pre><code class="language-tsquare">…</code></pre>      marked, markdown-it, remark/rehype, Hugo
 *   <div class="language-tsquare highlighter-rouge">…</div>  Jekyll
 *   <code data-lang="tsquare">…</code>                      Hugo's highlighter
 *   <pre class="tsquare">…</pre>, <div class="tsquare">…</div>   written by hand, as with Mermaid
 *
 * Each becomes <figure class="tsquare-board"><img …></figure>, or, when the text has problems,
 * <div class="tsquare-problems"> listing them by line. Running it again skips what's done.
 */
import { compileWireframe } from "./compile.js";
import { boardLayout, renderWireframeSvg } from "./render.js";

export const DEFAULT_SELECTOR = ".tsquare, .language-tsquare, [data-lang='tsquare']";

export interface RenderAllOptions {
  /** Where to look (default: the whole document). */
  root?: ParentNode;
  /** Which elements hold wireframe text (default: DEFAULT_SELECTOR). */
  selector?: string;
}

export interface RenderAllResult {
  /** Boards drawn. */
  rendered: number;
  /** Blocks whose text has problems (listed in place of the board). */
  invalid: number;
}

const DONE = "data-tsquare";
// Low specificity (:where), so a page's own CSS wins
const STYLES = `:where(.tsquare-board){margin:1em 0}
:where(.tsquare-board) img{display:block;max-width:100%;height:auto}
:where(.tsquare-problems){margin:1em 0;padding:.5em .75em;border-left:3px solid #d33;font-size:.9em}
:where(.tsquare-problems) ul{margin:.25em 0 0;padding-left:1.25em;font-family:ui-monospace,Menlo,monospace}`;

export async function renderAll(opts: RenderAllOptions = {}): Promise<RenderAllResult> {
  const root = opts.root ?? document;
  const doc = (root as Node).ownerDocument ?? (root as Document);
  const result: RenderAllResult = { rendered: 0, invalid: 0 };
  const targets: Element[] = [];
  for (const el of root.querySelectorAll(opts.selector ?? DEFAULT_SELECTOR)) {
    // a <code> is replaced with its <pre>, so the page's code-block styling goes too
    const target = el.tagName === "CODE" ? (el.closest("pre") ?? el) : el;
    if (target.hasAttribute(DONE) || target.closest(`[${DONE}]`)) continue;
    if (targets.some((t) => t.contains(target) || target.contains(t))) continue; // Jekyll's div holds the code
    targets.push(target);
  }
  if (targets.length) addStyles(doc);
  for (const target of targets) {
    const source = target.textContent ?? "";
    const replacement = await renderBlock(doc, source);
    replacement.setAttribute(DONE, "");
    target.replaceWith(replacement);
    if (replacement.classList.contains("tsquare-board")) result.rendered++;
    else result.invalid++;
  }
  return result;
}

async function renderBlock(doc: Document, source: string): Promise<Element> {
  const { spec, issues } = compileWireframe(source);
  if (!spec || issues.length) return problems(doc, issues.map((i) => `line ${i.line}: ${i.message}`));
  try {
    const svg = await renderWireframeSvg(spec, { skipValidation: true });
    const { width, height } = boardLayout(spec);
    const title = (spec.elements[spec.root]?.props as { title?: string } | undefined)?.title;
    const win = doc.defaultView ?? globalThis;
    const figure = doc.createElement("figure");
    figure.className = "tsquare-board";
    const img = doc.createElement("img");
    img.src = win.URL.createObjectURL(new win.Blob([svg], { type: "image/svg+xml" }));
    img.width = width;
    img.height = height;
    img.alt = title ? `Wireframe: ${title}` : "Wireframe";
    figure.append(img);
    return figure;
  } catch (err) {
    return problems(doc, [`tsquare couldn't render this board: ${err instanceof Error ? err.message : String(err)}`]);
  }
}

function problems(doc: Document, lines: string[]) {
  const box = doc.createElement("div");
  box.className = "tsquare-problems";
  box.setAttribute("role", "note");
  const title = doc.createElement("strong");
  title.textContent = lines.length === 1 ? "1 problem in this wireframe" : `${lines.length} problems in this wireframe`;
  const list = doc.createElement("ul");
  for (const line of lines) list.append(Object.assign(doc.createElement("li"), { textContent: line }));
  box.append(title, list);
  return box;
}

function addStyles(doc: Document) {
  if (doc.getElementById("tsquare-styles")) return;
  const style = doc.createElement("style");
  style.id = "tsquare-styles";
  style.textContent = STYLES;
  doc.head.append(style);
}
