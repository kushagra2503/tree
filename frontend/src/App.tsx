import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderCards } from "./components/ProviderCards";
import { PromptComposer } from "./components/PromptComposer";
import { TerminalTabs } from "./components/TerminalTabs";
import type { LocalSession, ProviderStatus } from "./types";
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

  return (
    <div className={`app-shell${sessions.length > 0 ? " has-session" : ""}`}>
      <header className="app-header">
        <div>
          <h1 className="wordmark">Tree</h1>
          <p className="tagline">{subtitle}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn ghost" onClick={() => void refresh()} disabled={loadingProviders}>
            {loadingProviders ? "Checking…" : "Refresh apps"}
          </button>
        </div>
      </header>

      {sessions.length === 0 && (
        <ProviderCards
          providers={providers}
          loading={loadingProviders}
          onConnect={(id) => void onConnect(id)}
          onRefresh={() => void refresh()}
        />
      )}

      <div className="workspace">
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
        <TerminalTabs
          sessions={sessions}
          activeId={activeId}
          onSelect={setActiveId}
          onStop={(id) => void onStop(id)}
          onClose={(id) => void onClose(id)}
          onExited={onExited}
        />
      </div>
    </div>
  );
}

export default App;
