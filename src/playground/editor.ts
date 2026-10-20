/**
 * The code editor: CodeMirror 6 with tsquare highlighting, autocomplete from the catalog
 * (languageData()), and problems underlined by line. Runs in the browser: the playground uses
 * it, and it's published as `tsquare/editor` (src/editor.ts, with CodeMirror bundled in).
 *
 * Colors come from CSS variables, so a page restyles it and switches light/dark with CSS alone:
 * --tsquare-editor-* for the editor and its popups, --tsquare-syntax-* for the highlighting.
 * Unset, they default to the playground's colors, light or dark by the element's color-scheme.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, syntaxHighlighting, type StringStream } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type Command, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { EditorOptions } from "./editor-options.js";
import type { ComponentInfo, LanguageData, PropInfo } from "./language-data.js";

// ── Highlighting ────────────────────────────────────────────────────────

interface LineState { argument: boolean; afterEquals: boolean }

/** One line at a time: the first word is the component, then quoted text, key=value, bare words, lists. */
const tsquareLanguage = StreamLanguage.define<LineState>({
  name: "tsquare",
  startState: () => ({ argument: false, afterEquals: false }),
  token(stream: StringStream, state: LineState) {
    if (stream.sol()) { state.argument = false; state.afterEquals = false; }
    if (stream.eatSpace()) return null;
    const afterEquals = state.afterEquals;
    state.afterEquals = false;

    // A comment is a whole line starting with #; anywhere else # is text (#1001, accent=#1a73e8)
    if (!state.argument && stream.peek() === "#") {
      stream.skipToEnd();
      return "comment";
    }
    // a hex color right after = (accent=#1a73e8), not a list item like [#1001]
    if (afterEquals && /[=:]\s*$/.test(stream.string.slice(0, stream.pos)) && stream.match(/^#[0-9a-fA-F]{3,8}(?![\w-])/)) return "color";
    if (stream.match(/^```.*/)) return "comment";
    if (!state.argument) {
      state.argument = true;
      if (stream.match(/^[A-Za-z][\w-]*/)) return "typeName";
    }
    // a quote opens a string only at the start of a token, so "Don't" stays a word
    const quote = stream.peek();
    if (quote === '"' || quote === "'") {
      stream.next();
      let escaped = false;
      for (let c = stream.next(); c != null; c = stream.next()) {
        if (c === quote && !escaped) break;
        escaped = !escaped && c === "\\";
      }
      return "string";
    }
    if (stream.match(/^[\w-]+(?=\s*[=:])/)) return "propertyName";
    if (stream.eat("=") || stream.eat(":")) { state.afterEquals = true; return "operator"; }
    if (stream.match(/^-?\d+(\.\d+)?(?![\w-])/)) return "number";
    if (stream.match(/^(true|false|null)(?![\w-])/)) return "bool";
    if (stream.eat(/[[\]{}]/)) { state.afterEquals = stream.current() === "[" || stream.current() === "{"; return "bracket"; }
    if (stream.eat(",")) return "punctuation";
    if (stream.match(/^[^\s,=:[\]{}"]+/)) return "atom";
    stream.next();
    return null;
  },
  tokenTable: { color: tags.color },
  languageData: { commentTokens: { line: "#" } },
});

/** A themable color: the page's variable if it sets one, else the default for light or dark. */
const v = (name: string, light: string, dark: string) => `var(--tsquare-${name}, light-dark(${light}, ${dark}))`;

const highlight = HighlightStyle.define([
  { tag: tags.typeName, color: v("syntax-component", "#0b3d91", "#8ab4ff"), fontWeight: "600" },
  { tag: tags.string, color: v("syntax-string", "#17754a", "#7ee2a8") },
  { tag: tags.propertyName, color: v("syntax-prop", "#6d28d9", "#c4a7ff") },
  { tag: [tags.number, tags.bool], color: v("syntax-number", "#b45309", "#f5b971") },
  { tag: tags.atom, color: v("syntax-word", "#0e7490", "#67d4e8") },
  { tag: tags.color, color: v("syntax-color", "#be185d", "#f49ac1") },
  { tag: tags.comment, color: v("syntax-comment", "#8b95a5", "#6f7a8a"), fontStyle: "italic" },
  { tag: [tags.operator, tags.bracket, tags.punctuation], color: v("syntax-punct", "#5b6472", "#9aa4b2") },
]);

const ink = v("editor-fg", "#1f2328", "#e6ebf2");
const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "var(--tsquare-editor-font-size, 13px)", backgroundColor: v("editor-bg", "#ffffff", "#111821"), color: ink },
  ".cm-scroller": { fontFamily: 'var(--tsquare-editor-font, ui-monospace, "SF Mono", Menlo, Consolas, monospace)', lineHeight: "20px" },
  ".cm-content": { caretColor: ink, padding: "12px 0" },
  ".cm-cursor": { borderLeftColor: ink },
  ".cm-gutters": { backgroundColor: v("editor-bg", "#ffffff", "#111821"), color: v("editor-gutter", "#6f7782", "#8b95a5"), border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: v("editor-active-line", "rgba(31, 111, 214, 0.045)", "rgba(255, 255, 255, 0.035)") },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: `${v("editor-selection", "rgba(31, 111, 214, 0.26)", "rgba(80, 150, 255, 0.36)")} !important` },
  ".cm-tooltip": { backgroundColor: v("editor-popup-bg", "#ffffff", "#151c25"), color: ink, border: `1px solid ${v("editor-popup-border", "#dfe2e6", "#253041")}`, borderRadius: "8px", overflow: "hidden" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: v("editor-popup-selected", "rgba(59, 153, 251, 0.16)", "rgba(59, 153, 251, 0.22)"), color: ink },
  ".cm-completionDetail": { color: v("editor-gutter", "#6f7782", "#8b95a5"), fontStyle: "normal", marginLeft: "8px" },
  ".cm-completionInfo": { maxWidth: "320px", padding: "8px 10px", fontFamily: "var(--tsquare-editor-ui-font, system-ui, sans-serif)", fontSize: "12.5px", lineHeight: "1.45" },
  ".cm-diagnostic": { fontFamily: "var(--tsquare-editor-ui-font, system-ui, sans-serif)", fontSize: "12.5px" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: `underline wavy ${v("editor-error", "#c2362b", "#ff7b70")}`, textUnderlineOffset: "3px" },
});

// ── Autocomplete ────────────────────────────────────────────────────────

const normalize = (s: string) => s.toLowerCase().replace(/[-_]/g, "");

function completions(data: LanguageData) {
  const byName = new Map(data.components.map((c) => [normalize(c.name), c]));
  const componentOptions: Completion[] = data.components.map((c) => ({
    label: c.name,
    type: "class",
    detail: c.children ? "holds elements" : undefined,
    info: c.description,
  }));
  const iconOptions: Completion[] = data.icons.map((label) => ({ label, type: "constant" }));
  const accentOptions: Completion[] = data.accents.map((label) => ({ label, type: "constant", detail: "accent" }));

  const valuesFor = (prop: PropInfo | undefined, key: string): Completion[] => {
    if (key === "icon" || prop?.icon) return iconOptions;
    if (prop?.accent) return accentOptions;
    return (prop?.values ?? []).map((label) => ({ label, type: "enum" }));
  };

  const argumentOptions = (c: ComponentInfo): Completion[] => [
    ...c.words.map((label) => ({ label, type: "keyword", detail: "option" })),
    ...c.props.map((p) => ({
      label: `${p.name}=`,
      type: "property",
      detail: p.kind === "enum" ? p.values!.slice(0, 4).join(" | ") + (p.values!.length > 4 ? " …" : "") : p.kind,
      info: p.description,
      boost: -1,
    })),
  ];

  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos);
    const before = line.text.slice(0, ctx.pos - line.from);
    if (/^\s*#/.test(before)) return null; // in a comment (whole lines only)
    if ((before.match(/"/g) ?? []).length % 2 === 1) return null; // in quoted text

    // The component name, at the start of the line
    const first = before.match(/^(\s*)([\w-]*)$/);
    if (first) {
      if (!first[2] && !ctx.explicit) return null;
      return { from: line.from + first[1].length, options: componentOptions, validFor: /^[\w-]*$/ };
    }

    const component = byName.get(normalize(before.trim().split(/\s+/)[0] ?? ""));
    if (!component) return null;

    // key=value, including inside lists and objects: actions=[sea…  items=[{icon=ho…
    const kv = before.match(/([\w-]+)\s*[=:]\s*(?:\[[^\]]*?)?(?:\{[^}]*?[=:]\s*)?([\w#-]*)$/);
    if (kv) {
      const key = before.match(/([\w-]+)\s*[=:]\s*[\w#-]*$/)?.[1] ?? kv[1];
      const prop = component.props.find((p) => p.name === kv[1]);
      const options = valuesFor(key === "icon" ? undefined : prop, key);
      if (!options.length) return null;
      return { from: ctx.pos - kv[2].length, options, validFor: /^[\w#-]*$/ };
    }

    // `icon search`: Icon's main text is an icon name
    const word = before.match(/\s([\w-]*)$/);
    if (!word) return null;
    if (!word[1] && !ctx.explicit) return null;
    const isIconName = component.name === "icon" && /^\s*icon\s+[\w-]*$/.test(before);
    return { from: ctx.pos - word[1].length, options: isIconName ? iconOptions : argumentOptions(component), validFor: /^[\w-]*$/ };
  };
}

// ── Editing helpers ─────────────────────────────────────────────────────

/** Enter keeps the indentation of the current line, or of the nearest line above it when this one is blank. */
const newlineKeepIndent: Command = (view) => {
  const { state } = view;
  const changes = state.changeByRange((range) => {
    let line = state.doc.lineAt(range.from);
    while (!line.text.trim() && line.number > 1) line = state.doc.line(line.number - 1);
    const indent = line.text.match(/^ */)![0];
    const text = "\n" + indent;
    return { changes: { from: range.from, to: range.to, insert: text }, range: EditorSelection.cursor(range.from + text.length) };
  });
  view.dispatch(state.update(changes, { scrollIntoView: true, userEvent: "input" }));
  return true;
};

/** Pasting a whole model reply keeps just the fenced code block. */
const pasteFencedBlock = EditorView.domEventHandlers({
  paste(event, view) {
    const text = event.clipboardData?.getData("text/plain") ?? "";
    const m = text.match(/```[^\n]*\n([\s\S]*?)```/);
    if (!m || text.trim() === m[0].trim()) return false;
    event.preventDefault();
    view.dispatch(view.state.replaceSelection(m[1]));
    view.dom.dispatchEvent(new CustomEvent("tsquare-pasted-block", { bubbles: true }));
    return true;
  },
});

/**
 * Wrapping long lines: a wrapped line's continuation rows start 4 spaces deeper than the line's own
 * indentation (2 deeper would look like a child element). Each visible line gets its indentation
 * as a hanging indent: padding for every row, minus the same on the first, which starts with the
 * spaces themselves.
 */
const CONTINUATION = 4;
const hangingIndent = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = this.build(view); }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = this.build(u.view); }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          const line = view.state.doc.lineAt(pos);
          const indent = line.text.match(/^ */)![0].length;
          builder.add(line.from, line.from, Decoration.line({ attributes: { style: `padding-left: calc(6px + ${indent + CONTINUATION}ch); text-indent: -${indent + CONTINUATION}ch` } }));
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (p) => p.decorations },
);
const wrapping = [EditorView.lineWrapping, hangingIndent];

export interface Editor {
  view: EditorView;
  getText(): string;
  /** Replace the whole document as one undoable step. */
  setText(text: string): void;
  setIssues(issues: { line: number; message: string }[]): void;
  goToLine(line: number): void;
  /** Scroll the cursor back into view (after the panels around the editor change size). */
  revealCursor(): void;
  /** Remove the editor and its listeners. */
  destroy(): void;
}

export function createEditor(parent: HTMLElement, opts: EditorOptions = {}): Editor {
  const extensions: Extension[] = [
    opts.lineNumbers === false ? [] : [lineNumbers(), highlightActiveLineGutter()],
    highlightActiveLine(),
    drawSelection(),
    history(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    lintGutter(),
    tsquareLanguage,
    syntaxHighlighting(highlight),
    opts.data ? autocompletion({ override: [completions(opts.data)], icons: false, activateOnTyping: true }) : [],
    EditorState.tabSize.of(2),
    keymap.of([{ key: "Enter", run: newlineKeepIndent }, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
    theme,
    pasteFencedBlock,
    opts.lineWrapping ? wrapping : [],
    EditorView.contentAttributes.of({ "aria-label": opts.ariaLabel ?? "Wireframe text", spellcheck: "false", autocapitalize: "off" }),
    EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange?.(u.state.doc.toString()); }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ doc: opts.doc ?? "", extensions }) });

  return {
    view,
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 }, scrollIntoView: true, userEvent: "input.replace" });
    },
    setIssues(issues) {
      const doc = view.state.doc;
      const diagnostics: Diagnostic[] = issues
        .filter((i) => i.line >= 1 && i.line <= doc.lines)
        .map((i) => {
          const line = doc.line(i.line);
          const start = line.from + (line.text.length - line.text.trimStart().length);
          return { from: start, to: Math.max(start, line.to), severity: "error", message: i.message };
        });
      view.dispatch(setDiagnostics(view.state, diagnostics));
    },
    revealCursor() {
      if (view.hasFocus) view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest" }) });
    },
    goToLine(n) {
      const line = view.state.doc.line(Math.min(Math.max(1, n), view.state.doc.lines));
      view.dispatch({ selection: { anchor: line.from, head: line.to }, scrollIntoView: true });
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}
