/**
 * The playground's code editor: CodeMirror 6 with tsquare highlighting,
 * autocomplete from the catalog (via /api/language), and errors underlined by
 * line. Runs in the browser; bundled into playground.js by the build.
 *
 * Colors come from CSS variables (--syn-*), so the light/dark switch is pure CSS.
 */
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, type Completion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, StreamLanguage, bracketMatching, syntaxHighlighting, type StringStream } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, type Command } from "@codemirror/view";
import { tags } from "@lezer/highlight";
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

    // `#` starts a comment, except right after `=` or `:` where it's a value (accent=#1a73e8)
    if (stream.peek() === "#") {
      if (afterEquals && stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return "color";
      stream.skipToEnd();
      return "comment";
    }
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
    if (stream.match(/^[^\s,=:[\]{}"#]+/)) return "atom";
    stream.next();
    return null;
  },
  tokenTable: { color: tags.color },
  languageData: { commentTokens: { line: "#" } },
});

const highlight = HighlightStyle.define([
  { tag: tags.typeName, color: "var(--syn-component)", fontWeight: "600" },
  { tag: tags.string, color: "var(--syn-string)" },
  { tag: tags.propertyName, color: "var(--syn-prop)" },
  { tag: [tags.number, tags.bool], color: "var(--syn-number)" },
  { tag: tags.atom, color: "var(--syn-word)" },
  { tag: tags.color, color: "var(--syn-color)" },
  { tag: tags.comment, color: "var(--syn-comment)", fontStyle: "italic" },
  { tag: [tags.operator, tags.bracket, tags.punctuation], color: "var(--syn-punct)" },
]);

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--editor-bg)", color: "var(--editor-ink)" },
  ".cm-scroller": { fontFamily: "var(--mono)", lineHeight: "20px" },
  ".cm-content": { caretColor: "var(--editor-ink)", padding: "12px 0" },
  ".cm-cursor": { borderLeftColor: "var(--editor-ink)" },
  ".cm-gutters": { backgroundColor: "var(--editor-bg)", color: "var(--muted)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--editor-active)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "var(--editor-selection) !important" },
  ".cm-tooltip": { backgroundColor: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px", overflow: "hidden" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-soft)", color: "var(--ink)" },
  ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", marginLeft: "8px" },
  ".cm-completionInfo": { maxWidth: "320px", padding: "8px 10px", fontFamily: "var(--sans)", fontSize: "12.5px", lineHeight: "1.45" },
  ".cm-diagnostic": { fontFamily: "var(--sans)", fontSize: "12.5px" },
  ".cm-lintRange-error": { backgroundImage: "none", textDecoration: "underline wavy var(--error)", textUnderlineOffset: "3px" },
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
    if (/^\s*#/.test(before) || /\s#[^"]*$/.test(before)) return null; // in a comment
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

export interface Editor {
  view: EditorView;
  getText(): string;
  /** Replace the whole document as one undoable step. */
  setText(text: string): void;
  setIssues(issues: { line: number; message: string }[]): void;
  goToLine(line: number): void;
  /** Scroll the cursor back into view (after the panels around the editor change size). */
  revealCursor(): void;
}

export function createEditor(parent: HTMLElement, opts: { doc: string; data: LanguageData; onChange: (text: string) => void }): Editor {
  const extensions: Extension[] = [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    history(),
    bracketMatching(),
    closeBrackets(),
    highlightSelectionMatches(),
    lintGutter(),
    tsquareLanguage,
    syntaxHighlighting(highlight),
    autocompletion({ override: [completions(opts.data)], icons: false, activateOnTyping: true }),
    EditorState.tabSize.of(2),
    keymap.of([{ key: "Enter", run: newlineKeepIndent }, ...closeBracketsKeymap, ...completionKeymap, ...searchKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
    theme,
    pasteFencedBlock,
    EditorView.contentAttributes.of({ "aria-label": "Wireframe text", spellcheck: "false", autocapitalize: "off" }),
    EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange(u.state.doc.toString()); }),
  ];
  const view = new EditorView({ parent, state: EditorState.create({ doc: opts.doc, extensions }) });

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
  };
}
