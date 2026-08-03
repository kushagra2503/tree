/** Providers supported by the backend registry, in display order. */
export const PROVIDER_IDS = ["claude", "codex", "cursor"] as const;

export type ProviderID = (typeof PROVIDER_IDS)[number];

export interface ProviderStatus {
  id: string;
  name: string;
  installed: boolean;
  path: string;
  version: string;
  authenticated: boolean;
  message: string;
  installHint: string;
}

export interface SessionInfo {
  id: string;
  provider: string;
  title: string;
  folder: string;
  running: boolean;
}

export interface LocalSession extends SessionInfo {
  prompt: string;
}

export interface TerminalOutputEvent {
  sessionId: string;
  data: string;
}

export interface TerminalExitEvent {
  sessionId: string;
  code: number;
}

const PROVIDER_LABELS: Record<ProviderID, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

/**
 * Display name for a provider id. Falls back to the name reported by the
 * backend so an unrecognised provider still renders sensibly.
 */
export function providerLabel(id: string, fallback = ""): string {
  return PROVIDER_LABELS[id as ProviderID] ?? (fallback || id);
}

/**
 * Placeholder rows shown while the first provider probe is in flight, so the
 * layout does not jump once real statuses arrive.
 */
export function placeholderProviders(message = "Checking…"): ProviderStatus[] {
  return PROVIDER_IDS.map((id) => ({
    id,
    name: providerLabel(id),
    installed: false,
    path: "",
    version: "",
    authenticated: false,
    message,
    installHint: "",
  }));
}
