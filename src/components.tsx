import React, { Children, cloneElement, isValidElement, type CSSProperties, type ReactNode } from "react";
import { iconNode } from "./icons";
import type { ComponentRenderProps } from "@json-render/image";
import {
  BOARD_GAP,
  BOARD_PADDING,
  LABEL_H,
  NOTE_WIDTH,
  TITLE_H,
  screenSize,
  theme as t,
} from "./layout";

/**
 * Satori renders a subset of CSS. Rules followed here:
 * - every element that has more than one child sets display:flex
 * - absolute positioning is relative to the direct parent (Yoga), so overlays
 *   are lifted out and placed by Screen rather than nested in the body
 */

type Dir = "row" | "column";
type Props<P = Record<string, any>> = ComponentRenderProps<P> & { dir?: Dir; stretch?: boolean };

const flexAlign = { start: "flex-start", center: "center", end: "flex-end", stretch: "stretch" } as const;
const flexJustify = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
} as const;

function Box({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  // Satori chokes on undefined style values, so drop them.
  const clean: Record<string, unknown> = { display: "flex" };
  for (const [k, v] of Object.entries(style ?? {})) if (v !== undefined && v !== null) clean[k] = v;
  return <div style={clean as CSSProperties}>{children}</div>;
}

/** Tell each child which way its parent lays out, so leaves can avoid stretching. */
function withDir(children: ReactNode, dir: Dir, stretch = false) {
  return Children.toArray(children).map((c) => (isValidElement(c) ? cloneElement(c as any, { dir, stretch }) : c));
}

/**
 * Containers in a row fill its height (sidebars, side-by-side cards) unless the
 * row sets `align` explicitly. Leaves keep the row's centering.
 */
function fillRow(inRow?: boolean, edge = true): CSSProperties {
  if (!inRow) return {};
  return { alignSelf: edge ? "stretch" : "flex-start" };
}

/** Leaves like buttons shouldn't stretch across a column. */
function hug(dir?: Dir): CSSProperties {
  return dir === "row" ? {} : { alignSelf: "flex-start" };
}

// ── Icons ───────────────────────────────────────────────────────────────

export function IconGlyph({ name, size = 20, color = t.ink, strokeWidth = 2 }: {
  name?: string | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const node = name ? iconNode(name) : null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {node
        ? node.map(([tag, attrs]: [string, Record<string, string>], i: number) =>
            React.createElement(tag, { key: i, ...attrs }),
          )
        : <circle cx="12" cy="12" r="9" />}
    </svg>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────────

function Board({ element, children }: Props) {
  const p = element.props;
  const gap = p.gap ?? BOARD_GAP;
  const items = Children.toArray(children);
  const perRow = p.layout === "grid" ? Math.max(1, p.columns ?? 3) : Math.max(1, items.length);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));

  return (
    <Box
      style={{
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: p.padding ?? BOARD_PADDING,
        backgroundColor: t.board,
        fontFamily: t.font,
        color: t.ink,
      }}
    >
      {p.title ? (
        <Box style={{ height: TITLE_H, fontSize: 28, fontWeight: 600, color: t.ink }}>{p.title}</Box>
      ) : null}
      <Box style={{ flexDirection: "column", gap }}>
        {rows.map((row, i) => (
          <Box key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap }}>
            {row}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function StatusBar() {
  return (
    <Box
      style={{
        height: 34,
        flexShrink: 0,
        padding: "0 26px",
        alignItems: "center",
        justifyContent: "space-between",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      <Box>9:41</Box>
      <Box style={{ gap: 5, alignItems: "center" }}>
        <IconGlyph name="signal" size={15} strokeWidth={2.4} />
        <IconGlyph name="wifi" size={15} strokeWidth={2.4} />
        <IconGlyph name="battery-full" size={17} strokeWidth={2} />
      </Box>
    </Box>
  );
}

function BrowserBar() {
  return (
    <Box
      style={{
        height: 40,
        flexShrink: 0,
        padding: "0 14px",
        gap: 16,
        alignItems: "center",
        backgroundColor: t.fill,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <Box style={{ gap: 7 }}>
        {[0, 1, 2].map((i) => (
          <Box key={i} style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.fill2, border: `1px solid ${t.lineStrong}` }} />
        ))}
      </Box>
      <Box style={{ flexGrow: 1, justifyContent: "center" }}>
        <Box style={{ width: 420, height: 24, borderRadius: 12, backgroundColor: t.paper, border: `1px solid ${t.line}` }} />
      </Box>
      <Box style={{ width: 57 }} />
    </Box>
  );
}

function Screen({ element, children }: Props) {
  const p = element.props;
  const s = screenSize(p);
  const top: ReactNode[] = [];
  const body: ReactNode[] = [];
  const bottom: ReactNode[] = [];
  const overlays: ReactNode[] = [];
  for (const c of Children.toArray(children)) {
    const type = isValidElement(c) ? (c.props as any).element?.type : null;
    if (type === "NavBar") top.push(c);
    else if (type === "TabBar") bottom.push(c);
    else if (type === "Modal" || type === "Drawer") overlays.push(c);
    else body.push(c);
  }

  return (
    <Box style={{ flexDirection: "column", flexShrink: 0 }}>
      <Box style={{ height: LABEL_H, fontSize: 16, fontWeight: 600, color: t.text }}>{p.name ?? ""}</Box>
      <Box
        style={{
          width: s.width,
          height: s.height,
          flexDirection: "column",
          backgroundColor: t.paper,
          border: `1.5px solid ${t.lineStrong}`,
          borderRadius: s.radius,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          color: t.ink,
          fontSize: 15,
        }}
      >
        {s.chrome && s.device === "phone" ? <StatusBar /> : null}
        {s.chrome && s.device === "desktop" ? <BrowserBar /> : null}
        <Box style={{ position: "relative", flexGrow: 1, flexDirection: "column", overflow: "hidden" }}>
          {top}
          <Box
            style={{
              flexGrow: 1,
              flexDirection: "column",
              padding: s.padding,
              gap: p.gap ?? 14,
              overflow: "hidden",
            }}
          >
            {withDir(body, "column")}
          </Box>
          {bottom}
          {overlays}
        </Box>
      </Box>
    </Box>
  );
}

function Note({ element, dir }: Props) {
  const p = element.props;
  const onBoard = dir === undefined; // Board children don't get a dir
  return (
    <Box
      style={{
        width: p.width ?? (onBoard ? NOTE_WIDTH : undefined),
        marginTop: onBoard ? LABEL_H : 0,
        flexShrink: 0,
        padding: 14,
        backgroundColor: t.notes[(p.color ?? "yellow") as keyof typeof t.notes] ?? t.notes.yellow,
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        fontSize: 14,
        lineHeight: 1.5,
        color: t.ink,
        ...(onBoard ? {} : hug(dir)),
      }}
    >
      {p.text}
    </Box>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────

const borderSide = (side?: string | null): CSSProperties => {
  const b = `1px solid ${t.line}`;
  switch (side) {
    case "all": return { border: b };
    case "left": return { borderLeft: b };
    case "right": return { borderRight: b };
    case "top": return { borderTop: b };
    case "bottom": return { borderBottom: b };
    default: return {};
  }
};

function Stack({ element, children, stretch }: Props) {
  const p = element.props;
  const dir: Dir = p.direction ?? "column";
  return (
    <Box
      style={{
        flexDirection: dir,
        gap: p.gap ?? (dir === "row" ? 12 : 12),
        padding: p.padding ?? 0,
        alignItems: flexAlign[(p.align ?? (dir === "row" ? "center" : "stretch")) as keyof typeof flexAlign],
        justifyContent: flexJustify[(p.justify ?? "start") as keyof typeof flexJustify],
        flexWrap: p.wrap ? "wrap" : "nowrap",
        flexGrow: p.grow ? 1 : 0,
        flexShrink: p.width ? 0 : 1,
        width: p.width ?? undefined,
        minHeight: 0,
        backgroundColor: p.fill ? t.fill : undefined,
        ...borderSide(p.border),
        // stacks with a visible edge (sidebars, panels) fill the row's height; others sit at the top
        ...fillRow(stretch, p.width != null || !!p.fill || (!!p.border && p.border !== "none")),
      }}
    >
      {withDir(children, dir, dir === "row" && p.align == null)}
    </Box>
  );
}

function Grid({ element, children }: Props) {
  const p = element.props;
  const gap = p.gap ?? 16;
  const cols = Math.max(1, p.columns ?? 2);
  return (
    <Box style={{ padding: p.padding ?? 0, flexDirection: "column" }}>
    <Box style={{ flexDirection: "row", flexWrap: "wrap", margin: -gap / 2 }}>
      {Children.toArray(children).map((c, i) => (
        <Box key={i} style={{ width: `${100 / cols}%`, padding: gap / 2, flexDirection: "column" }}>
          {withDir(c, "column")}
        </Box>
      ))}
    </Box>
    </Box>
  );
}

function Card({ element, children, stretch }: Props) {
  const p = element.props;
  const filled = p.variant === "filled";
  return (
    <Box
      style={{
        flexDirection: "column",
        gap: p.gap ?? 10,
        padding: p.padding ?? 16,
        borderRadius: 10,
        border: filled ? "none" : `1.5px solid ${t.line}`,
        backgroundColor: filled ? t.fill : t.paper,
        flexGrow: p.grow ? 1 : 0,
        width: p.width ?? undefined,
        flexShrink: p.width ? 0 : 1,
        ...fillRow(stretch),
      }}
    >
      {p.title ? <Box style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</Box> : null}
      {withDir(children, "column")}
    </Box>
  );
}

function Divider({ element, dir }: Props) {
  const vertical = element.props.vertical ?? dir === "row";
  return vertical ? (
    <Box style={{ width: 1, alignSelf: "stretch", backgroundColor: t.line, flexShrink: 0 }} />
  ) : (
    <Box style={{ height: 1, alignSelf: "stretch", backgroundColor: t.line, flexShrink: 0 }} />
  );
}

function Spacer({ element }: Props) {
  const size = element.props.size;
  return size != null ? (
    <Box style={{ flexBasis: `${size}px`, flexGrow: 0, flexShrink: 0 }} />
  ) : (
    <Box style={{ flexGrow: 1 }} />
  );
}

// ── Content ─────────────────────────────────────────────────────────────

function Heading({ element }: Props) {
  const p = element.props;
  const size = { 1: 26, 2: 20, 3: 16 }[(p.level ?? 1) as 1 | 2 | 3] ?? 26;
  return (
    <Box
      style={{
        fontSize: size,
        fontWeight: 600,
        lineHeight: 1.25,
        color: t.ink,
        justifyContent: p.align === "center" ? "center" : p.align === "right" ? "flex-end" : "flex-start",
        textAlign: p.align ?? "left",
      }}
    >
      {p.text}
    </Box>
  );
}

const LINE_WIDTHS = [100, 94, 97, 89, 95, 91];

function PlaceholderLines({ count, height = 8, gap = 9, color = t.fill2, last = 62 }: {
  count: number;
  height?: number;
  gap?: number;
  color?: string;
  last?: number;
}) {
  return (
    <Box style={{ flexDirection: "column", gap, alignSelf: "stretch" }}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i}
          style={{
            height,
            borderRadius: height / 2,
            backgroundColor: color,
            width: `${i === count - 1 && count > 1 ? last : LINE_WIDTHS[i % LINE_WIDTHS.length]}%`,
          }}
        />
      ))}
    </Box>
  );
}

function Text({ element }: Props) {
  const p = element.props;
  const size = { sm: 13, md: 15, lg: 18 }[(p.size ?? "md") as "sm" | "md" | "lg"] ?? 15;
  if (p.text == null) {
    return <PlaceholderLines count={p.lines ?? 2} height={Math.round(size * 0.55)} gap={Math.round(size * 0.6)} />;
  }
  return (
    <Box
      style={{
        fontSize: size,
        lineHeight: 1.45,
        color: p.muted ? t.muted : t.text,
        fontWeight: p.bold ? 600 : 400,
        justifyContent: p.align === "center" ? "center" : p.align === "right" ? "flex-end" : "flex-start",
        textAlign: p.align ?? "left",
      }}
    >
      {p.text}
    </Box>
  );
}

function Image({ element, dir }: Props) {
  const p = element.props;
  const h = p.height ?? 160;
  const w = p.width ?? (dir === "row" ? h : "100%");
  return (
    <Box
      style={{
        position: "relative",
        width: w,
        height: h,
        flexShrink: 0,
        backgroundColor: t.fill,
        border: `1.5px solid ${t.line}`,
        borderRadius: p.rounded ? 12 : 4,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke={t.line} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <line x1="100" y1="0" x2="0" y2="100" stroke={t.line} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      {p.label ? (
        <Box
          style={{
            padding: "3px 8px",
            fontSize: 12,
            color: t.muted,
            backgroundColor: t.fill,
            borderRadius: 4,
          }}
        >
          {p.label}
        </Box>
      ) : null}
    </Box>
  );
}

function Icon({ element, dir }: Props) {
  const p = element.props;
  return (
    <Box style={{ flexShrink: 0, ...hug(dir) }}>
      <IconGlyph name={p.name} size={p.size ?? 20} />
    </Box>
  );
}

function AvatarCircle({ initials, size = 40 }: { initials?: string | null; size?: number }) {
  return (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.fill2,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: Math.round(size * 0.38),
        fontWeight: 600,
        color: t.text,
        overflow: "hidden",
      }}
    >
      {initials ? initials.slice(0, 2).toUpperCase() : <IconGlyph name="user" size={Math.round(size * 0.55)} color={t.muted} />}
    </Box>
  );
}

function Avatar({ element, dir }: Props) {
  return (
    <Box style={hug(dir)}>
      <AvatarCircle initials={element.props.initials} size={element.props.size ?? 40} />
    </Box>
  );
}

function BadgePill({ label, variant }: { label: string; variant?: string | null }) {
  const solid = variant !== "outline";
  return (
    <Box
      style={{
        height: 22,
        padding: "0 9px",
        borderRadius: 11,
        alignItems: "center",
        fontSize: 12,
        fontWeight: 600,
        flexShrink: 0,
        backgroundColor: solid ? t.primary : "transparent",
        color: solid ? t.onPrimary : t.text,
        border: solid ? "none" : `1.5px solid ${t.lineStrong}`,
      }}
    >
      {label}
    </Box>
  );
}

function Badge({ element, dir }: Props) {
  return (
    <Box style={hug(dir)}>
      <BadgePill label={element.props.label} variant={element.props.variant} />
    </Box>
  );
}

// ── Controls ────────────────────────────────────────────────────────────

function Button({ element, dir }: Props) {
  const p = element.props;
  const variant = p.variant ?? "primary";
  const h = { sm: 32, md: 42, lg: 50 }[(p.size ?? "md") as "sm" | "md" | "lg"] ?? 42;
  const fg = variant === "primary" ? t.onPrimary : t.ink;
  return (
    <Box
      style={{
        height: h,
        padding: `0 ${Math.round(h * 0.45)}px`,
        gap: 8,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: h < 36 ? 13 : 15,
        fontWeight: 600,
        color: fg,
        backgroundColor: variant === "primary" ? t.primary : "transparent",
        border: variant === "secondary" ? `1.5px solid ${t.lineStrong}` : "none",
        ...(p.fullWidth ? { alignSelf: "stretch" } : hug(dir)),
      }}
    >
      {p.icon ? <IconGlyph name={p.icon} size={h < 36 ? 16 : 18} color={fg} /> : null}
      {p.label ? <Box>{p.label}</Box> : null}
    </Box>
  );
}

/** Fields fill a column; in a row they take the given width or share the space. */
function fieldWidth(width: unknown, dir?: Dir): CSSProperties {
  if (width != null) return { width: width as number, flexShrink: 0 };
  return dir === "row" ? { flexGrow: 1, flexBasis: "0px", minWidth: 120 } : {};
}

function FieldLabel({ text }: { text?: string | null }) {
  return text ? <Box style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{text}</Box> : null;
}

function Field({ children, height = 42, top = false }: { children?: ReactNode; height?: number; top?: boolean }) {
  return (
    <Box
      style={{
        height,
        padding: top ? "10px 12px" : "0 12px",
        gap: 8,
        alignItems: top ? "flex-start" : "center",
        border: `1.5px solid ${t.lineStrong}`,
        borderRadius: 8,
        backgroundColor: t.paper,
        fontSize: 15,
      }}
    >
      {children}
    </Box>
  );
}

function Input({ element, dir }: Props) {
  const p = element.props;
  const rows = p.multiline ?? 1;
  const isPassword = p.type === "password";
  const shown = p.value ?? null;
  const content =
    isPassword && shown ? "•".repeat(Math.min(shown.length, 12)) : shown;
  return (
    <Box style={{ flexDirection: "column", gap: 6, ...fieldWidth(p.width, dir), ...(p.grow ? { flexGrow: 1 } : {}) }}>
      <FieldLabel text={p.label} />
      <Field height={rows > 1 ? rows * 22 + 20 : 42} top={rows > 1}>
        {p.type === "search" ? <IconGlyph name="search" size={18} color={t.muted} /> : null}
        <Box style={{ flexGrow: 1, color: content ? t.ink : t.muted }}>
          {content ?? p.placeholder ?? (isPassword ? "••••••••" : "")}
        </Box>
        {isPassword ? <IconGlyph name="eye-off" size={18} color={t.muted} /> : null}
      </Field>
      {p.helper ? <Box style={{ fontSize: 12, color: t.muted }}>{p.helper}</Box> : null}
    </Box>
  );
}

function Select({ element, dir }: Props) {
  const p = element.props;
  return (
    <Box style={{ flexDirection: "column", gap: 6, ...fieldWidth(p.width, dir) }}>
      <FieldLabel text={p.label} />
      <Field>
        <Box style={{ flexGrow: 1, color: p.value ? t.ink : t.muted }}>{p.value ?? p.placeholder ?? "Select…"}</Box>
        <IconGlyph name="chevron-down" size={18} color={t.text} />
      </Field>
    </Box>
  );
}

function CheckMark({ checked, round = false }: { checked?: boolean | null; round?: boolean }) {
  return (
    <Box
      style={{
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: round ? 10 : 5,
        border: `1.5px solid ${checked && !round ? t.primary : t.lineStrong}`,
        backgroundColor: checked && !round ? t.primary : t.paper,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? (
        round ? (
          <Box style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.primary }} />
        ) : (
          <IconGlyph name="check" size={14} color={t.onPrimary} strokeWidth={3} />
        )
      ) : null}
    </Box>
  );
}

function Checkbox({ element, dir }: Props) {
  const p = element.props;
  return (
    <Box style={{ gap: 10, alignItems: "center", ...hug(dir) }}>
      <CheckMark checked={p.checked} />
      {p.label ? <Box style={{ color: t.text }}>{p.label}</Box> : null}
    </Box>
  );
}

function Radio({ element, dir }: Props) {
  const p = element.props;
  return (
    <Box style={{ gap: 10, alignItems: "center", ...hug(dir) }}>
      <CheckMark checked={p.checked} round />
      {p.label ? <Box style={{ color: t.text }}>{p.label}</Box> : null}
    </Box>
  );
}

function Switch({ on }: { on?: boolean | null }) {
  return (
    <Box
      style={{
        width: 42,
        height: 24,
        borderRadius: 12,
        padding: 3,
        flexShrink: 0,
        backgroundColor: on ? t.primary : t.fill2,
        justifyContent: on ? "flex-end" : "flex-start",
      }}
    >
      <Box style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: t.paper }} />
    </Box>
  );
}

function Toggle({ element }: Props) {
  const p = element.props;
  return (
    <Box style={{ gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      {p.label ? <Box style={{ color: t.text }}>{p.label}</Box> : null}
      <Switch on={p.on} />
    </Box>
  );
}

// ── Navigation & data ───────────────────────────────────────────────────

const LEADING_ICON: Record<string, string> = { menu: "menu", back: "arrow-left", close: "x" };

function NavBar({ element }: Props) {
  const p = element.props;
  const leading =
    p.leading === "logo" ? (
      <Box style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: t.fill2 }} />
    ) : p.leading && p.leading !== "none" ? (
      <IconGlyph name={LEADING_ICON[p.leading]} size={22} />
    ) : null;
  const actions = (
    <Box style={{ gap: 18, alignItems: "center", justifyContent: "flex-end" }}>
      {(p.actions ?? []).map((a: string, i: number) => (
        <IconGlyph key={i} name={a} size={22} />
      ))}
    </Box>
  );
  const title = p.title ? <Box style={{ fontSize: 17, fontWeight: 600 }}>{p.title}</Box> : null;
  const centered = p.align === "center";
  return (
    <Box
      style={{
        height: 56,
        flexShrink: 0,
        padding: "0 16px",
        gap: 14,
        alignItems: "center",
        borderBottom: `1px solid ${t.line}`,
        backgroundColor: t.paper,
      }}
    >
      {centered
        ? [
            <Box key="l" style={{ width: 90, alignItems: "center" }}>{leading}</Box>,
            <Box key="c" style={{ flexGrow: 1, justifyContent: "center" }}>{title}</Box>,
            <Box key="r" style={{ width: 90, justifyContent: "flex-end" }}>{actions}</Box>,
          ]
        : [
            leading ? <Box key="l">{leading}</Box> : null,
            title ? <Box key="t">{title}</Box> : null,
            <Box key="s" style={{ flexGrow: 1 }} />,
            <Box key="a">{actions}</Box>,
          ]}
    </Box>
  );
}

function TabBar({ element }: Props) {
  const p = element.props;
  const active = p.active ?? 0;
  return (
    <Box
      style={{
        height: 76,
        flexShrink: 0,
        padding: "8px 0 18px",
        borderTop: `1px solid ${t.line}`,
        backgroundColor: t.paper,
      }}
    >
      {(p.items ?? []).map((item: { label: string; icon?: string }, i: number) => {
        const color = i === active ? t.ink : t.muted;
        return (
          <Box
            key={i}
            style={{ flexGrow: 1, flexBasis: "0px", flexDirection: "column", alignItems: "center", gap: 4, color, fontSize: 11, fontWeight: i === active ? 600 : 400 }}
          >
            <IconGlyph name={item.icon} size={22} color={color} />
            <Box>{item.label}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

function Tabs({ element }: Props) {
  const p = element.props;
  const active = p.active ?? 0;
  return (
    <Box style={{ borderBottom: `1px solid ${t.line}`, gap: 4 }}>
      {(p.items ?? []).map((label: string, i: number) => (
        <Box
          key={i}
          style={{
            padding: "10px 14px",
            marginBottom: -1,
            fontSize: 14,
            fontWeight: i === active ? 600 : 400,
            color: i === active ? t.ink : t.muted,
            borderBottom: i === active ? `2.5px solid ${t.ink}` : "2.5px solid transparent",
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  );
}

function List({ element, children, stretch }: Props) {
  const dividers = element.props.dividers ?? true;
  const items = withDir(children, "column");
  return (
    <Box style={{ flexDirection: "column", flexGrow: element.props.grow ? 1 : 0, ...fillRow(stretch, false) }}>
      {items.map((c, i) => (
        <Box key={i} style={{ flexDirection: "column" }}>
          {i > 0 && dividers ? <Box style={{ height: 1, backgroundColor: t.line }} /> : null}
          {c}
        </Box>
      ))}
    </Box>
  );
}

function ListItem({ element }: Props) {
  const p = element.props;
  const leading = (() => {
    switch (p.leading) {
      case "icon":
        return (
          <Box style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: t.fill, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <IconGlyph name={p.icon} size={20} />
          </Box>
        );
      case "avatar":
        return <AvatarCircle size={40} />;
      case "image":
        return (
          <Box style={{ width: 48, height: 48, borderRadius: 6, backgroundColor: t.fill, border: `1.5px solid ${t.line}`, flexShrink: 0 }} />
        );
      case "checkbox":
        return <CheckMark />;
      default:
        return null;
    }
  })();
  const trailing = (() => {
    switch (p.trailing) {
      case "chevron":
        return <IconGlyph name="chevron-right" size={20} color={t.muted} />;
      case "toggle":
        return <Switch on />;
      case "text":
        return <Box style={{ fontSize: 13, color: t.muted, flexShrink: 0 }}>{p.trailingText ?? ""}</Box>;
      case "badge":
        return <BadgePill label={p.trailingText ?? "1"} />;
      case "icon":
        return <IconGlyph name={p.trailingIcon ?? "more-horizontal"} size={20} color={t.muted} />;
      default:
        return null;
    }
  })();
  return (
    <Box style={{ minHeight: 60, padding: "10px 0", gap: 14, alignItems: "center" }}>
      {leading}
      <Box style={{ flexGrow: 1, flexShrink: 1, flexDirection: "column", gap: 4 }}>
        {p.title ? (
          <Box style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{p.title}</Box>
        ) : (
          <Box style={{ height: 9, width: "55%", borderRadius: 5, backgroundColor: t.fill2 }} />
        )}
        {p.subtitle ? (
          <Box style={{ fontSize: 13, color: t.muted }}>{p.subtitle}</Box>
        ) : p.title ? null : (
          <Box style={{ height: 7, width: "80%", borderRadius: 4, backgroundColor: t.fill, marginTop: 4 }} />
        )}
      </Box>
      {trailing}
    </Box>
  );
}

const CELL_WIDTHS = [70, 45, 60, 38, 52];

function Table({ element }: Props) {
  const p = element.props;
  const cols: string[] = p.columns ?? [];
  const data: string[][] | null = p.data ?? null;
  const rowCount = data ? data.length : p.rows ?? 4;
  return (
    <Box style={{ flexDirection: "column", border: `1.5px solid ${t.line}`, borderRadius: 8, overflow: "hidden", fontSize: 14 }}>
      <Box style={{ backgroundColor: t.fill }}>
        {cols.map((c, i) => (
          <Box key={i} style={{ flexGrow: 1, flexBasis: "0px", padding: "10px 14px", fontSize: 13, fontWeight: 600, color: t.text }}>
            {c}
          </Box>
        ))}
      </Box>
      {Array.from({ length: rowCount }, (_, r) => (
        <Box key={r} style={{ borderTop: `1px solid ${t.line}`, minHeight: 42, alignItems: "center" }}>
          {cols.map((_, c) => (
            <Box key={c} style={{ flexGrow: 1, flexBasis: "0px", padding: "10px 14px", color: t.text }}>
              {data ? (
                data[r]?.[c] ?? ""
              ) : (
                <Box
                  style={{
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: c === 0 ? t.fill2 : t.fill,
                    width: `${CELL_WIDTHS[(r + c * 2) % CELL_WIDTHS.length]}%`,
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ── Overlays ────────────────────────────────────────────────────────────

function Scrim({ show, children, style }: { show: boolean; children?: ReactNode; style?: CSSProperties }) {
  return (
    <Box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: show ? t.scrim : "transparent",
        ...style,
      }}
    >
      {children}
    </Box>
  );
}

function Modal({ element, children }: Props) {
  const p = element.props;
  return (
    <Scrim show={p.scrim ?? true} style={{ alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Box
        style={{
          width: p.width ?? 320,
          flexDirection: "column",
          gap: 14,
          padding: 22,
          borderRadius: 14,
          backgroundColor: t.paper,
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        }}
      >
        {p.title ? <Box style={{ fontSize: 18, fontWeight: 600 }}>{p.title}</Box> : null}
        {withDir(children, "column")}
      </Box>
    </Scrim>
  );
}

function Drawer({ element, children }: Props) {
  const p = element.props;
  const side: "left" | "right" | "bottom" = p.side ?? "left";
  const bottom = side === "bottom";
  const size = p.size ?? (bottom ? 380 : 300);
  const panel: CSSProperties = bottom
    ? { left: 0, right: 0, bottom: 0, minHeight: size, maxHeight: "92%", borderRadius: "18px 18px 0 0", boxShadow: "0 -6px 24px rgba(0,0,0,0.14)" }
    : {
        top: 0,
        bottom: 0,
        [side]: 0,
        width: size,
        boxShadow: side === "left" ? "6px 0 24px rgba(0,0,0,0.14)" : "-6px 0 24px rgba(0,0,0,0.14)",
      };
  return (
    <Scrim show={p.scrim ?? true}>
      <Box
        style={{
          position: "absolute",
          flexDirection: "column",
          backgroundColor: t.paper,
          padding: bottom ? "10px 20px 20px" : 20,
          gap: 14,
          overflow: "hidden",
          ...panel,
        }}
      >
        {bottom && (p.handle ?? true) ? (
          <Box style={{ justifyContent: "center", paddingBottom: 4 }}>
            <Box style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: t.fill2 }} />
          </Box>
        ) : null}
        {p.title ? (
          <Box style={{ alignItems: "center", justifyContent: "space-between" }}>
            <Box style={{ fontSize: 18, fontWeight: 600 }}>{p.title}</Box>
            <IconGlyph name="x" size={22} color={t.muted} />
          </Box>
        ) : null}
        {withDir(children, "column")}
      </Box>
    </Scrim>
  );
}

export const registry = {
  Board,
  Screen,
  Note,
  Stack,
  Grid,
  Card,
  Divider,
  Spacer,
  Heading,
  Text,
  Image,
  Icon,
  Avatar,
  Badge,
  Button,
  Input,
  Checkbox,
  Radio,
  Toggle,
  Select,
  NavBar,
  TabBar,
  Tabs,
  List,
  ListItem,
  Table,
  Modal,
  Drawer,
};
