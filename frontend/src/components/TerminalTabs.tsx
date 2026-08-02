import type { LocalSession } from "../types";
import { TerminalSession } from "./TerminalSession";

interface Props {
  sessions: LocalSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onStop: (id: string) => void;
  onClose: (id: string) => void;
  onExited: (id: string, code: number) => void;
}

export function TerminalTabs({
  sessions,
  activeId,
  onSelect,
  onStop,
  onClose,
  onExited,
}: Props) {
  const active = sessions.find((s) => s.id === activeId) ?? null;

  if (sessions.length === 0) {
    return (
      <section className="panel terminal-panel">
        <div className="terminal-empty">
          Choose an app, pick a project folder, and run a prompt.
          <br />
          Each run opens an embedded terminal for that CLI.
        </div>
      </section>
    );
  }

  return (
    <section className="panel terminal-panel" aria-label="Sessions">
      <div className="terminal-tabs">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`tab ${s.id === activeId ? "active" : "idle"}`}
            onClick={() => onSelect(s.id)}
            title={s.title}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="terminal-toolbar">
        <span>
          {active?.provider ?? ""}
          {active?.folder ? ` · ${active.folder}` : ""}
          {active && !active.running ? " · stopped" : ""}
        </span>
        <div className="header-actions">
          {active?.running ? (
            <button type="button" className="btn danger" onClick={() => onStop(active.id)}>
              Stop
            </button>
          ) : null}
          {active ? (
            <button type="button" className="btn ghost" onClick={() => onClose(active.id)}>
              Close
            </button>
          ) : null}
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
