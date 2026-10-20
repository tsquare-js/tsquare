// The editor's options, apart from editor.ts so tsquare/editor's published types don't reference CodeMirror.
import type { LanguageData } from "./language-data.js";

export interface EditorOptions {
  /** The starting text. */
  doc?: string;
  /** Autocomplete for components, props, option words, icons and accents: pass languageData(). Without it, no autocomplete. */
  data?: LanguageData;
  /** Called with the whole text after every change. */
  onChange?: (text: string) => void;
  /** Line numbers in a gutter. Default true. */
  lineNumbers?: boolean;
  /** The editable area's accessible name. Default "Wireframe text". */
  ariaLabel?: string;
}
