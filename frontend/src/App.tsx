import { useCallback, useEffect, useMemo, useState } from "react";
import { ProviderCards } from "./components/ProviderCards";
import { PromptComposer } from "./components/PromptComposer";
import { TerminalTabs } from "./components/TerminalTabs";
import { placeholderProviders, type LocalSession, type ProviderStatus } from "./types";
import { errorMessage } from "./lib/errors";
import { DEFAULT_COLS, DEFAULT_ROWS } from "./lib/events";
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

const FALLBACK_PROVIDERS = placeholderProviders();

/**
 * The backend re-probes automatically once a login flow exits, but that flow is
 * detached — poll once more after a beat in case it outlived the CLI process.
 */
const CONNECT_REFRESH_DELAY_MS = 2500;

/** Clears the running flag on the matching session, leaving others untouched. */
function markStopped(session: LocalSession, id: string): LocalSession {
  return session.id === id ? { ...session, running: false } : session;
}

function App() {
  const [providers, setProviders] = useState<ProviderStatus[]>(FALLBACK_PROVIDERS);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [providerId, setProviderId] = useState("claude");
  const [folder, setFolder] = useState("");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<LocalSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Both the initial probe and an explicit refresh share this flow; they differ
  // only in which backend call produces the list.
  const loadProviders = useCallback(async (fetchProviders: () => Promise<ProviderStatus[]>) => {
    setLoadingProviders(true);
    try {
      const list = await fetchProviders();
      setProviders(list?.length ? list : FALLBACK_PROVIDERS);
      // Keep the current selection while it is still installed, otherwise fall
      // back to the first provider that is.
      setProviderId((current) => {
        if (list?.some((p) => p.id === current && p.installed)) return current;
        return list?.find((p) => p.installed)?.id ?? current;
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoadingProviders(false);
    }
  }, []);

  const refresh = useCallback(() => loadProviders(RefreshProviders), [loadProviders]);

  useEffect(() => {
    void loadProviders(GetProviders);
  }, [loadProviders]);

  const onConnect = async (id: string) => {
    setError("");
    try {
      await ConnectProvider(id);
      window.setTimeout(() => {
        void refresh();
      }, CONNECT_REFRESH_DELAY_MS);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onFolderPick = async () => {
    setError("");
    try {
      const path = await SelectFolder();
      if (path) setFolder(path);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const onRun = async () => {
    setError("");
    setBusy(true);
    try {
      const info = await StartSession(providerId, prompt, folder, DEFAULT_COLS, DEFAULT_ROWS);
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
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onStop = async (id: string) => {
    try {
      await StopSession(id);
      setSessions((prev) => prev.map((s) => markStopped(s, id)));
    } catch (err) {
      setError(errorMessage(err));
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
    setSessions((prev) => prev.map((s) => markStopped(s, id)));
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
