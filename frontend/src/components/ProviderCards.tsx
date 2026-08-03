import { providerLabel, type ProviderStatus } from "../types";

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
    <section className="providers panel" aria-label="Connected apps">
      <div className="providers-head">
        <h2>Apps</h2>
        <button className="btn ghost" onClick={onRefresh} disabled={loading} type="button">
          Refresh
        </button>
      </div>
      <div className="provider-row">
        {providers.map((p) => {
          const tone = statusTone(p);
          return (
            <article key={p.id} className={`provider-card tone-${tone}`}>
              <div className="provider-card-top">
                <div>
                  <div className="provider-name">{providerLabel(p.id, p.name)}</div>
                  <div className="provider-meta">
                    {p.installed ? p.version || "Installed" : "Not installed"}
                  </div>
                </div>
                <span className={`pill pill-${tone}`}>
                  {p.authenticated ? "Connected" : p.installed ? "Sign in" : "Missing"}
                </span>
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
              <div className="provider-actions">
                {p.installed ? (
                  <button
                    type="button"
                    className={p.authenticated ? "btn ghost" : "btn primary"}
                    onClick={() => onConnect(p.id)}
                  >
                    {p.authenticated ? "Reconnect" : "Connect"}
                  </button>
                ) : (
                  <span className="hint">Install the CLI, then refresh</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
