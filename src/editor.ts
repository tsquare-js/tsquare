/**
 * tsquare/editor: the playground's code editor for your own page. Highlighting, autocomplete
 * (pass languageData() from "tsquare"), problems underlined by line, Enter keeping the
 * indentation, and pasting a whole model reply keeps just its code block. Browser code, with
 * CodeMirror bundled in: it doesn't share CodeMirror with the page and takes no extensions.
 *
 *   import { createEditor } from "tsquare/editor";
 *   import { compileWireframe, languageData } from "tsquare";
 *
 *   const editor = createEditor(element, { doc: text, data: languageData(), onChange: (text) => {
 *     editor.setIssues(compileWireframe(text).issues);
 *   } });
 *
 * Give the element a height; the editor fills it. Colors come from CSS variables
 * (--tsquare-editor-*, --tsquare-syntax-*), light or dark by the page's color-scheme.
 */
import { createEditor as create } from "./playground/editor.js";
import type { EditorOptions } from "./playground/editor-options.js";

export type { EditorOptions };

export interface WireframeEditor {
  /** The editor's root element (CodeMirror's), inside the element you gave. */
  readonly dom: HTMLElement;
  getText(): string;
  /** Replace the whole text, as one step that undo reverts. */
  setText(text: string): void;
  /** Underline problems by line ({ line, message }, as compileWireframe returns them); [] clears them. */
  setIssues(issues: { line: number; message: string }[]): void;
  /** Select a line, scroll to it and focus the editor. */
  goToLine(line: number): void;
  focus(): void;
  /** Remove the editor and its listeners. */
  destroy(): void;
}

export function createEditor(parent: HTMLElement, options: EditorOptions = {}): WireframeEditor {
  const editor = create(parent, options);
  return {
    dom: editor.view.dom,
    getText: editor.getText,
    setText: editor.setText,
    setIssues: editor.setIssues,
    goToLine: editor.goToLine,
    focus: () => editor.view.focus(),
    destroy: editor.destroy,
  };
}
