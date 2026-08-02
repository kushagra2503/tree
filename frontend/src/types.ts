export type ProviderID = "claude" | "codex" | "cursor";

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

export const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};
