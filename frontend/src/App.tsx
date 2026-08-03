import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
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
  const projectParts = folder.split("/").filter(Boolean);
  const projectName = projectParts.at(-1) ?? "No project";
  const connectedCount = providers.filter((provider) => provider.authenticated).length;

  const onNewSession = () => {
    setActiveId(null);
    setPrompt("");
    setError("");
  };

  return (
    <div className="app-shell tree-window">
      <header className="window-bar">
        <div className="window-brand">
          <span className="tree-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M12 3.5v17M12 7.5 7.5 12M12 10.5l5-4M12 14.5l-4 3M12 13l4.5 4" />
            </svg>
          </span>
          <h1>Tree</h1>
          <span className="window-divider" />
          <span className="window-context">
            {activeSession ? activeSession.title : "New session"}
          </span>
        </div>
        <div className="window-status">
          <span className="connection-indicator">
            <i /> {loadingProviders ? "Checking agents" : subtitle}
          </span>
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

      <div className="desktop-grid">
        <aside className="session-sidebar">
          <div className="side-section-head">
            <h2>Sessions</h2>
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

          <button
            type="button"
            className={`new-session-button ${activeId === null ? "active" : ""}`}
            onClick={onNewSession}
          >
            <span>+</span>
            New session
            <kbd>⌘N</kbd>
          </button>

          <div className="session-list">
            {sessions.length === 0 ? (
              <p className="session-list-empty">Your agent sessions will appear here.</p>
            ) : (
              sessions.map((session, index) => (
                <button
                  type="button"
                  className={`session-item ${session.id === activeId ? "active" : ""}`}
                  key={session.id}
                  onClick={() => setActiveId(session.id)}
                  aria-label={session.title}
                >
                  <span className={`session-number ${session.running ? "running" : ""}`}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="session-copy">
                    <strong>{session.title}</strong>
                    <small>
                      {PROVIDER_LABELS[session.provider] ?? session.provider}
                      <span> · </span>
                      {session.running ? "running" : "ended"}
                    </small>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="sidebar-footer">
            <span className="connection-indicator">
              <i /> {connectedCount} of {providers.length} agents online
            </span>
            <span>Local processes only</span>
          </div>
        </aside>

        <main className="main-workspace">
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
            onProviderChange={setProviderId}
            onFolderPick={() => void onFolderPick()}
            onPromptChange={setPrompt}
            onRun={() => void onRun()}
          />
        </main>

        <aside className="context-sidebar">
          <section className="project-panel">
            <div className="side-section-head">
              <h2>Project</h2>
              <span className="panel-count">{folder ? "OPEN" : "NONE"}</span>
            </div>
            <button type="button" className="project-root" onClick={() => void onFolderPick()}>
              <span className="folder-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20">
                  <path d="M2.8 5.6h5l1.5 1.7h7.9v8.2H2.8z" />
                </svg>
              </span>
              <span>
                <strong>{projectName}</strong>
                <small>{folder || "Choose a working directory"}</small>
              </span>
            </button>
            {folder ? (
              <div className="project-tree" aria-label="Project path">
                {projectParts.slice(-4).map((part, index, parts) => (
                  <div
                    className={index === parts.length - 1 ? "active" : ""}
                    key={`${part}-${index}`}
                    style={{ "--tree-depth": index } as CSSProperties}
                  >
                    <span>{index === parts.length - 1 ? "◇" : "⌞"}</span>
                    {part}
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <ProviderCards
            providers={providers}
            loading={loadingProviders}
            onConnect={(id) => void onConnect(id)}
            onRefresh={() => void refresh()}
          />

          <section className="runtime-panel">
            <div className="side-section-head">
              <h2>Runtime</h2>
            </div>
            <dl>
              <div><dt>Agent</dt><dd>{PROVIDER_LABELS[providerId] ?? providerId}</dd></div>
              <div><dt>Sessions</dt><dd>{sessions.length}</dd></div>
              <div><dt>Mode</dt><dd>Interactive</dd></div>
              <div><dt>Transport</dt><dd>Local PTY</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default App;
