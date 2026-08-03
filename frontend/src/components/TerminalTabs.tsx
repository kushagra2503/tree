import { PROVIDER_LABELS, type LocalSession, type ProviderStatus } from "../types";
import { TerminalSession } from "./TerminalSession";

interface Props {
  sessions: LocalSession[];
  activeId: string | null;
  selectedProvider?: ProviderStatus;
  folder: string;
  onStop: (id: string) => void;
  onClose: (id: string) => void;
  onExited: (id: string, code: number) => void;
}

export function TerminalTabs({
  sessions,
  activeId,
  selectedProvider,
  folder,
  onStop,
  onClose,
  onExited,
}: Props) {
  const active = sessions.find((s) => s.id === activeId) ?? null;
  const providerName = active
    ? PROVIDER_LABELS[active.provider] ?? active.provider
    : selectedProvider
      ? PROVIDER_LABELS[selectedProvider.id] ?? selectedProvider.name
      : "Local agent";
  const providerID = active?.provider ?? selectedProvider?.id ?? "claude";

  if (!active) {
    return (
      <section className="terminal-panel terminal-panel-empty" aria-label="New session">
        <div className="workspace-toolbar">
          <div className="toolbar-agent">
            <span className={`provider-mark provider-mark-${providerID}`} aria-hidden="true">
              {providerID === "claude" ? "A" : providerID === "codex" ? "O" : "C"}
            </span>
            <div>
              <strong>{providerName}</strong>
              <span>{selectedProvider?.authenticated ? "Ready" : "Local CLI"}</span>
            </div>
          </div>
          <span className="workspace-mode">NEW SESSION</span>
        </div>
        <div className="terminal-empty">
          <div className="empty-command-mark" aria-hidden="true">
            <span>›</span><span>_</span>
          </div>
          <p className="eyebrow">AGENT TERMINAL</p>
          <h2>Terminal, rebuilt around the work.</h2>
          <p>
            Pick an agent, choose a project, then describe the outcome. The real CLI runs
            here with its native prompts and permissions.
          </p>
          <div className="empty-context">
            <span className={selectedProvider?.installed ? "ready" : ""}>
              <i /> {selectedProvider?.installed ? providerName : "Choose an installed agent"}
            </span>
            <span>
              <i /> {folder ? folder.split("/").filter(Boolean).at(-1) : "No project selected"}
            </span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="terminal-panel" aria-label="Sessions">
      <div className="workspace-toolbar">
        <div className="toolbar-agent">
          <span className={`provider-mark provider-mark-${active.provider}`} aria-hidden="true">
            {active.provider === "claude" ? "A" : active.provider === "codex" ? "O" : "C"}
          </span>
          <div>
            <strong>{providerName}</strong>
            <span>{active.running ? "Working in project" : "Session complete"}</span>
          </div>
        </div>
        <div className="workspace-actions">
          <span className={`live-status ${active.running ? "running" : ""}`}>
            <i /> {active.running ? "LIVE" : "ENDED"}
          </span>
          {active.running ? (
            <button type="button" className="btn danger" onClick={() => onStop(active.id)}>
              Stop
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={() => onClose(active.id)}>
              Close session
            </button>
          )}
        </div>
      </div>

      <div className="session-overview">
        <div>
          <span className="overview-label">CURRENT TASK</span>
          <h2>{active.title}</h2>
          <p>{active.prompt}</p>
        </div>
        <div className="overview-path" title={active.folder}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2.8 5.6h5l1.5 1.7h7.9v8.2H2.8z" />
          </svg>
          <span>{active.folder}</span>
        </div>
      </div>

      <div className="terminal-stage">
        {sessions.map((s) => (
          <TerminalSession
            key={s.id}
            sessionId={s.id}
            active={s.id === activeId}
            onExited={onExited}
          />
        ))}
      </div>
    </section>
  );
}
