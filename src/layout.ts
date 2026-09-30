/** Sizes and colors shared by the components and the board-size calculation. */

export const theme = {
  font: "Inter",
  board: "#e6e8eb",
  paper: "#ffffff",
  ink: "#1f2328",
  text: "#3d434a",
  muted: "#868d96",
  line: "#d0d4d9",
  lineStrong: "#9ca3ab",
  fill: "#f0f2f4",
  fill2: "#e1e4e8",
  primary: "#2b3035",
  onPrimary: "#ffffff",
  scrim: "rgba(31, 35, 40, 0.38)",
  notes: {
    yellow: "#fdf1a8",
    blue: "#cfe6fb",
    pink: "#fbd3e0",
    green: "#d4f1d0",
  },
} as const;

export const DEVICES = {
  phone: { width: 390, height: 844, radius: 36, padding: 16 },
  tablet: { width: 820, height: 1180, radius: 24, padding: 24 },
  desktop: { width: 1280, height: 800, radius: 10, padding: 24 },
  custom: { width: 800, height: 600, radius: 8, padding: 20 },
} as const;

export type Device = keyof typeof DEVICES;

/** Height of the screen name label plus the space under it. */
export const LABEL_H = 40;
/** Height of the board title block. */
export const TITLE_H = 64;
export const BOARD_PADDING = 56;
export const BOARD_GAP = 64;
export const NOTE_WIDTH = 220;

export function screenSize(props: Record<string, any> = {}) {
  const device: Device = props.device ?? "phone";
  const base = DEVICES[device] ?? DEVICES.phone;
  // width/height override any preset: `screen phone height=1400` is a long scrolling phone page
  return {
    device,
    width: props.width ?? base.width,
    height: props.height ?? base.height,
    radius: base.radius,
    padding: props.padding ?? base.padding,
    chrome: props.chrome ?? (device === "phone" || device === "desktop"),
  };
}

/** Rough height of a Note so the board is tall enough to hold it. */
export function estimateNoteHeight(text: string, width: number) {
  const charsPerLine = Math.max(8, Math.floor((width - 28) / 7.4));
  const lines = text
    .split("\n")
    .reduce((n, para) => n + Math.max(1, Math.ceil(para.length / charsPerLine)), 0);
  return 28 + lines * 21;
}
