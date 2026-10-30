// The editor's options, apart from editor.ts so tsquare/editor's published types don't reference CodeMirror.
import type { LanguageData } from "./language-data.js";

export interface EditorOptions {
  /** The starting text. */
  doc?: string;
  /** Autocomplete for components, props, option words, icons and accents: pass languageData(). Without it, no autocomplete. */
  data?: LanguageData;
  /** Called with the whole text after every change. */
  onChange?: (text: string) => void;
  /** Called with the caret's line (1 = the first) when it moves to another line. */
  onCursorLine?: (line: number) => void;
  /** Line numbers in a gutter. Default true. */
  lineNumbers?: boolean;
  /** Wrap long lines instead of scrolling sideways; continuation rows are indented under their line. Default false. */
  lineWrapping?: boolean;
  /** The editable area's accessible name. Default "Wireframe text". */
  ariaLabel?: string;
}
