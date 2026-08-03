import { PROVIDER_LABELS, ProviderStatus } from "../types";

interface Props {
  providers: ProviderStatus[];
  loading?: boolean;
  onConnect: (id: string) => void;
  onRefresh: () => void;
}

function statusTone(p: ProviderStatus): "ok" | "warn" | "off" {
  if (p.authenticated) return "ok";
  if (p.installed) return "warn";
  return "off";
}

export function ProviderCards({ providers, loading, onConnect, onRefresh }: Props) {
  return (
    <section className="providers-panel" aria-label="Connected apps">
      <div className="side-section-head">
        <h2>Agents</h2>
        <button
          className="icon-button"
          onClick={onRefresh}
          disabled={loading}
          type="button"
          aria-label="Refresh agents"
          title="Refresh agents"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M15.4 6.2A6.3 6.3 0 1 0 16 13M15.4 6.2V2.9m0 3.3h-3.3" />
          </svg>
        </button>
      </div>
      <div className="provider-list">
        {providers.map((p) => {
          const tone = statusTone(p);
          return (
            <article key={p.id} className={`provider-card tone-${tone}`}>
              <div className={`provider-mark provider-mark-${p.id}`} aria-hidden="true">
                {p.id === "claude" ? "A" : p.id === "codex" ? "O" : "C"}
              </div>
              <div className="provider-copy">
                <div className="provider-card-top">
                  <div className="provider-name">{PROVIDER_LABELS[p.id] ?? p.name}</div>
                  <span className={`status-dot status-${tone}`} aria-hidden="true" />
                </div>
                <div className="provider-meta">
                  {p.authenticated ? "Connected" : p.installed ? "Sign in required" : "Not installed"}
                </div>
                <p className="provider-message">
                  {p.installed
                    ? p.authenticated
                      ? p.version
                        ? `Ready · ${p.version}`
                        : "Ready to run"
                      : p.message
                    : p.installHint}
                </p>
              </div>
              <div className="provider-actions">
                {p.installed ? (
                  <button
                    type="button"
                    className={p.authenticated ? "mini-action" : "mini-action primary"}
                    onClick={() => onConnect(p.id)}
                    title={p.authenticated ? `Reconnect ${p.name}` : `Connect ${p.name}`}
                  >
                    {p.authenticated ? "↻" : "Connect"}
                  </button>
                ) : (
                  <span className="provider-missing" title="Install the CLI, then refresh">
                    —
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
