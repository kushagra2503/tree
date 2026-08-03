/**
 * Wails event names emitted by the Go backend. These must stay in sync with the
 * `event*` constants in app.go.
 */
export const TERMINAL_OUTPUT_EVENT = "terminal:output";
export const TERMINAL_EXIT_EVENT = "terminal:exit";
export const PROVIDERS_UPDATED_EVENT = "providers:updated";

/**
 * Initial PTY size requested for a new session. The terminal refits itself once
 * the host element has real dimensions, so this only has to be reasonable.
 */
export const DEFAULT_COLS = 120;
export const DEFAULT_ROWS = 36;
