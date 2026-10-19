/**
 * React components for tsquare wireframes.
 *
 *   <Wireframe source={text} />                         a board from wireframe text
 *   <Markdown components={tsquareComponents}>…        ```tsquare blocks in react-markdown
 *   <WireframeStreaming value={isStreaming}>…          while a model's reply is still arriving
 *
 * Boards are drawn in the browser by tsquare (its browser build), as an <img> of the SVG. Nothing
 * is sent anywhere.
 */
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ComponentProps, type ReactNode } from "react";
import { boardLayout, compileWireframe, renderWireframeSvg } from "tsquare";

type Board = { url: string; width: number; height: number; title?: string };

export interface WireframeProps {
  /** The wireframe text. */
  source: string;
  /**
   * True while the text is still arriving, as when a model's reply streams in: the board updates
   * every 200 ms or so with the latest text that compiles, and problems wait until the text is
   * complete. Inside <WireframeStreaming>, it defaults to that value.
   */
  streaming?: boolean;
  className?: string;
  style?: CSSProperties;
}

const StreamingContext = createContext(false);

/** Sets `streaming` for every <Wireframe> inside, such as the ones tsquareComponents makes in react-markdown. */
export function WireframeStreaming({ value, children }: { value: boolean; children?: ReactNode }) {
  return <StreamingContext.Provider value={value}>{children}</StreamingContext.Provider>;
}

const ROOT: CSSProperties = { margin: "1em 0" };
const IMG: CSSProperties = { display: "block", maxWidth: "100%", height: "auto", transition: "opacity .15s" };
const PROBLEMS: CSSProperties = { margin: "1em 0", padding: ".5em .75em", borderLeft: "3px solid #d33", fontSize: ".9em" };
const STREAM_INTERVAL = 200;
const LIST: CSSProperties = { margin: ".25em 0 0", paddingLeft: "1.25em", fontFamily: "ui-monospace, Menlo, monospace" };

export function Wireframe({ source, streaming, className, style }: WireframeProps) {
  const inStream = useContext(StreamingContext);
  const isStreaming = streaming ?? inStream;
  const [board, setBoard] = useState<Board | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [pending, setPending] = useState(true); // newer text than what's shown hasn't been drawn or checked yet
  const url = useRef<string | null>(null);
  const seq = useRef(0); // each text gets a number; results are applied only if newer than what's shown
  const shown = useRef(0);
  const lastStart = useRef(0);
  const alive = useRef(true);

  useEffect(() => {
    const mine = ++seq.current;
    setPending(true);
    // While streaming, draw at most every STREAM_INTERVAL ms. A result still counts when newer text
    // has arrived since: it's the latest good board so far, and the next draw will follow.
    const delay = isStreaming ? Math.max(0, STREAM_INTERVAL - (Date.now() - lastStart.current)) : 0;
    const timer = setTimeout(() => {
      lastStart.current = Date.now();
      void draw(source, mine);
    }, delay);
    return () => clearTimeout(timer);
  }, [source, isStreaming]);

  async function draw(text: string, mine: number) {
    const apply = (update: () => void) => {
      if (!alive.current || mine < shown.current) return false;
      shown.current = mine;
      update();
      setPending(mine !== seq.current);
      return true;
    };
    const { spec, issues } = compileWireframe(text);
    if (!spec || issues.length) {
      apply(() => setProblems(issues.map((i) => `line ${i.line}: ${i.message}`)));
      return;
    }
    try {
      const svg = await renderWireframeSvg(spec, { skipValidation: true });
      const { width, height } = boardLayout(spec);
      const title = (spec.elements[spec.root]?.props as { title?: string } | undefined)?.title;
      apply(() => {
        const next = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        const old = url.current;
        url.current = next;
        if (old) setTimeout(() => URL.revokeObjectURL(old), 1000); // after the new image has replaced it
        setBoard({ url: next, width, height, title });
        setProblems([]);
      });
    } catch (err) {
      apply(() => setProblems([`tsquare couldn't render this board: ${err instanceof Error ? err.message : String(err)}`]));
    }
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = null;
    };
  }, []);

  // While streaming, partial text is often invalid mid-line: the board just waits for the next good
  // version. Once the text is complete, problems show and the last good board above them is dimmed.
  const showProblems = problems.length > 0 && !isStreaming;
  return (
    <figure className={["tsquare-board", className].filter(Boolean).join(" ")} style={{ ...ROOT, ...style }} aria-busy={pending || undefined}>
      {board ? (
        <img
          src={board.url}
          width={board.width}
          height={board.height}
          alt={board.title ? `Wireframe: ${board.title}` : "Wireframe"}
          style={{ ...IMG, opacity: showProblems ? 0.4 : 1 }}
        />
      ) : null}
      {showProblems ? (
        <div className="tsquare-problems" role="note" style={PROBLEMS}>
          <strong>{problems.length === 1 ? "1 problem in this wireframe" : `${problems.length} problems in this wireframe`}</strong>
          <ul style={LIST}>{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      ) : null}
    </figure>
  );
}

type HastNode = { type: string; value?: string; tagName?: string; properties?: { className?: unknown }; children?: HastNode[] };
const textOf = (n: HastNode): string => n.value ?? (n.children ?? []).map(textOf).join("");
const isTsquare = (className: unknown) =>
  (Array.isArray(className) ? className : String(className ?? "").split(" ")).includes("language-tsquare");

/** The wireframe text in a markdown code block (react-markdown's <pre>), or null when it's another language. */
function tsquareSource(node: HastNode | undefined, children: ReactNode): string | null {
  const code = node?.children?.find((c) => c.tagName === "code");
  if (code) return isTsquare(code.properties?.className) ? textOf(code) : null;
  // without the hast node: the <code> React element react-markdown puts inside
  const el = (Array.isArray(children) ? children[0] : children) as { props?: { className?: string; children?: unknown } } | undefined;
  if (el?.props && isTsquare(el.props.className)) return [el.props.children].flat().join("");
  return null;
}

/** react-markdown's `pre`: a ```tsquare block becomes its board, any other code block stays as it was. */
export function TsquarePre({ node, ...props }: ComponentProps<"pre"> & { node?: unknown }) {
  const source = tsquareSource(node as HastNode | undefined, props.children);
  return source == null ? <pre {...props} /> : <Wireframe source={source.replace(/\n$/, "")} />;
}

/** For react-markdown (and renderers that take the same `components`): `<Markdown components={tsquareComponents}>`, or spread it next to your own. */
export const tsquareComponents = { pre: TsquarePre };
