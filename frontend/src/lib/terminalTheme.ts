import type { ITerminalOptions } from "@xterm/xterm";

/** Warm palette matching the app shell (see styles/theme.css). */
const theme: ITerminalOptions["theme"] = {
  background: "#141210",
  foreground: "#f5f0e8",
  cursor: "#c15f3c",
  selectionBackground: "#c15f3c66",
  black: "#141210",
  red: "#e07a6e",
  green: "#8fbf9f",
  yellow: "#e0c07a",
  blue: "#8eabcf",
  magenta: "#c9a0c0",
  cyan: "#8fc4c0",
  white: "#f5f0e8",
  brightBlack: "#78716c",
  brightRed: "#f0a099",
  brightGreen: "#b0d4bb",
  brightYellow: "#f0d59a",
  brightBlue: "#b0c4df",
  brightMagenta: "#ddb8d4",
  brightCyan: "#b0d9d5",
  brightWhite: "#fffaf3",
};

/** Options every embedded session terminal is created with. */
export const terminalOptions: ITerminalOptions = {
  cursorBlink: true,
  convertEol: true,
  scrollback: 5000,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
  lineHeight: 1.3,
  theme,
  allowProposedApi: true,
};
