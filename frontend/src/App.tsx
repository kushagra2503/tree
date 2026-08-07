import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderCards } from "./components/ProviderCards";
import { PromptComposer } from "./components/PromptComposer";
import { TerminalTabs } from "./components/TerminalTabs";
import { PROVIDER_LABELS, type LocalSession, type ProviderStatus } from "./types";
import {
  CloseSession,
  ConnectProvider,
  GetProviders,
  RefreshProviders,
  SelectFolder,
  StartSession,
  StopSession,
} from "../wailsjs/go/main/App";
import "./App.css";

const EMPTY_PROVIDERS: ProviderStatus[] = [
  {
    id: "claude",
    name: "Claude Code",
    installed: false,
    path: "",
    version: "",
    authenticated: false,
    message: "Checking…",
    installHint: "",
  },
  {
    id: "codex",
    name: "Codex",
    installed: false,
    path: "",
    version: "",
    authenticated: false,
    message: "Checking…",
    installHint: "",
  },
  {
    id: "cursor",
    name: "Cursor",
    installed: false,
    path: "",
    version: "",
    authenticated: false,
    message: "Checking…",
    installHint: "",
  },
];

function App() {
  const [providers, setProviders] = useState<ProviderStatus[]>(EMPTY_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerId, setProviderId] = useState("claude");
  const [folder, setFolder] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingProviders(true);
    try {
      const list = (await RefreshProviders()) as ProviderStatus[];
      setProviders(list?.length ? list : EMPTY_PROVIDERS);
      const installed = list?.find((p) => p.installed);
      setProviderId((current) => {
        if (list?.some((p) => p.id === current && p.installed)) return current;
        return installed?.id ?? current;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const list = (await GetProviders()) as ProviderStatus[];
        setProviders(list?.length ? list : EMPTY_PROVIDERS);
        const installed = list?.find((p) => p.installed);
        if (installed) setProviderId(installed.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoadingProviders(false);
      }
    })();
  }, []);

  const onConnect = async (id: string) => {
    setError("");
    try {
      await ConnectProvider(id);
      window.setTimeout(() => {
        void refresh();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onFolderPick = async () => {
    setError("");
    try {
      const path = await SelectFolder();
      if (path) setFolder(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onRun = async () => {
    setError("");
    setBusy(true);
    try {
      const info = await StartSession(providerId, prompt, folder, 120, 36);
      const local: LocalSession = {
        id: info.id,
        provider: info.provider,
        title: info.title || `${info.provider} · ${prompt.slice(0, 40)}`,
        folder: info.folder,
        running: info.running,
        prompt,
      };
      setSessions((prev) => [...prev, local]);
      setActiveId(local.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onStop = async (id: string) => {
    try {
      await StopSession(id);
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, running: false } : s)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const onClose = async (id: string) => {
    try {
      await CloseSession(id);
    } catch {
      // Session may already be gone.
    }
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        setActiveId(next.length ? next[next.length - 1].id : null);
      }
      return next;
    });
  };

  const onExited = useCallback((id: string, _code: number) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, running: false } : s)));
  }, []);

  const subtitle = useMemo(() => {
    const connected = providers.filter((p) => p.authenticated).length;
    return connected > 0
      ? `${connected} app${connected === 1 ? "" : "s"} connected`
      : "Connect a local coding CLI to begin";
  }, [providers]);

  const activeSession = sessions.find((session) => session.id === activeId) ?? null;
  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const projectName = folder.split("/").filter(Boolean).at(-1) ?? "No project";
  const connectedCount = providers.filter((provider) => provider.authenticated).length;

  const onNewSession = () => {
    setActiveId(null);
    setPrompt("");
    setError("");
  };

  return (
    <div className="app-shell paper-stage">
      <div className="paper-window">
        <header className="paper-topbar">
          <div className="paper-home">
            <span className="tree-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3.5v17M12 7.5 7.5 12M12 10.5l5-4M12 14.5l-4 3M12 13l4.5 4" />
              </svg>
            </span>
            <h1>Tree</h1>
          </div>

          <nav className="paper-tabs" aria-label="Session tabs">
            <button type="button" className="paper-tab dashboard-tab" onClick={onNewSession}>
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <rect x="3" y="3" width="4.5" height="4.5" />
                <rect x="10.5" y="3" width="4.5" height="4.5" />
                <rect x="3" y="10.5" width="4.5" height="4.5" />
                <rect x="10.5" y="10.5" width="4.5" height="4.5" />
              </svg>
              Dashboard
            </button>
            {sessions.map((session) => (
              <button
                type="button"
                className={`paper-tab ${session.id === activeId ? "active" : ""}`}
                key={session.id}
                onClick={() => setActiveId(session.id)}
                title={session.title}
              >
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M5 2.8h5l3 3v9.4H5zM10 2.8v3h3" />
                </svg>
                <span>{session.title}</span>
                {session.id === activeId ? <i aria-hidden="true">×</i> : null}
              </button>
            ))}
            {activeId === null ? (
              <button type="button" className="paper-tab active" onClick={onNewSession}>
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M5 2.8h5l3 3v9.4H5zM10 2.8v3h3" />
                </svg>
                New session
                <i aria-hidden="true">×</i>
              </button>
            ) : null}
          </nav>

          <div className="paper-top-actions">
            <div className="agent-avatars" aria-label={`${connectedCount} connected agents`}>
              {providers.filter((provider) => provider.authenticated).map((provider) => (
                <span className={`provider-mark provider-mark-${provider.id}`} key={provider.id}>
                  {provider.id === "claude" ? "A" : provider.id === "codex" ? "O" : "C"}
                </span>
              ))}
            </div>
            <span className="zoom-label">{loadingProviders ? "…" : `${connectedCount}/3`}</span>
            <button
              type="button"
              className="icon-button"
              onClick={() => void refresh()}
              disabled={loadingProviders}
              aria-label="Refresh apps"
              title="Refresh apps"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M15.4 6.2A6.3 6.3 0 1 0 16 13M15.4 6.2V2.9m0 3.3h-3.3" />
              </svg>
            </button>
          </div>
        </header>

        <div className="paper-grid">
          <aside className="session-sidebar">
            <div className="sidebar-document">
              <span className="sidebar-document-icon" aria-hidden="true">◆</span>
              <strong>{projectName === "No project" ? "Tree workspace" : projectName}</strong>
              <button type="button" className="icon-button" aria-label="Toggle sidebar">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="3" y="4" width="14" height="12" />
                  <path d="M12.5 4v12" />
                </svg>
              </button>
            </div>

            <section className="sidebar-section">
              <div className="side-section-head">
                <h2>Pages</h2>
                <button
                  type="button"
                  className="icon-button"
                  onClick={onNewSession}
                  aria-label="New session"
                  title="New session"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                </button>
              </div>
              <div className="page-list">
                <button type="button" className={activeId === null ? "active" : ""} onClick={onNewSession}>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M5 2.8h5l3 3v9.4H5zM10 2.8v3h3" />
                  </svg>
                  New session
                </button>
                <button type="button" onClick={() => void onFolderPick()}>
                  <svg viewBox="0 0 18 18" aria-hidden="true">
                    <path d="M2.8 5.2h5l1.4 1.6h6v7.4H2.8z" />
                  </svg>
                  {folder ? projectName : "Choose project"}
                  {folder ? <span>✓</span> : null}
                </button>
              </div>
            </section>

            <section className="sidebar-section sessions-section">
              <div className="side-section-head">
                <h2>Sessions</h2>
                <span>{sessions.length}</span>
              </div>
              <div className="session-list">
                {sessions.length === 0 ? (
                  <p className="session-list-empty">Sessions will appear here after your first run.</p>
                ) : (
                  sessions.map((session) => (
                    <button
                      type="button"
                      className={`session-item ${session.id === activeId ? "active" : ""}`}
                      key={session.id}
                      onClick={() => setActiveId(session.id)}
                      aria-label={session.title}
                    >
                      <span className={`session-state ${session.running ? "running" : ""}`} />
                      <span className="session-copy">
                        <strong>{session.title}</strong>
                        <small>{PROVIDER_LABELS[session.provider] ?? session.provider}</small>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <ProviderCards
              providers={providers}
              loading={loadingProviders}
              onConnect={(id) => void onConnect(id)}
              onRefresh={() => void refresh()}
            />

            <footer className="sidebar-footer">
              <span>What’s new</span>
              <i>•</i>
              <span>{subtitle}</span>
            </footer>
          </aside>

          <nav className="canvas-tools" aria-label="Canvas tools">
            <button type="button" className="active" aria-label="Select">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 3 9 7-4.3 1.1L8 16z" /></svg>
            </button>
            <button type="button" aria-label="Pan">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6.4 9V5.4a1 1 0 0 1 2 0V8m0-2.8a1 1 0 0 1 2 0V8m0-2a1 1 0 0 1 2 0v2.4m0-1.4a1 1 0 0 1 2 0v4.4c0 3-1.9 5.1-4.7 5.1H8.5c-1.5 0-2.5-.8-3.3-2l-1.5-2.3a1 1 0 0 1 1.6-1.2l1.1 1.1z" /></svg>
            </button>
            <button type="button" aria-label="Frame">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></svg>
            </button>
            <button type="button" aria-label="Rectangle">
              <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3.5" y="3.5" width="13" height="13" /></svg>
            </button>
          </nav>

          <main className={`main-workspace ${activeId === null ? "new-session-workspace" : ""}`}>
            <div className="canvas-breadcrumb">
              <span>{projectName}</span>
              <i>/</i>
              <strong>{activeSession?.title ?? "New session"}</strong>
            </div>
            <TerminalTabs
              sessions={sessions}
              activeId={activeId}
              selectedProvider={selectedProvider}
              folder={folder}
              onStop={(id) => void onStop(id)}
              onClose={(id) => void onClose(id)}
              onExited={onExited}
            />
            <PromptComposer
              providers={providers}
              providerId={providerId}
              folder={folder}
              prompt={prompt}
              error={error}
              busy={busy}
              expanded={activeId === null}
              onProviderChange={setProviderId}
              onFolderPick={() => void onFolderPick()}
              onPromptChange={setPrompt}
              onRun={() => void onRun()}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
