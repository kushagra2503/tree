import { PROVIDER_LABELS, ProviderStatus } from "../types";

interface Props {
  providers: ProviderStatus[];
  providerId: string;
  folder: string;
  prompt: string;
  busy?: boolean;
  error?: string;
  onProviderChange: (id: string) => void;
  onPromptChange: (value: string) => void;
  onFolderPick: () => void;
  onRun: () => void;
}

export function PromptComposer({
  providers,
  providerId,
  folder,
  prompt,
  busy,
  error,
  onProviderChange,
  onPromptChange,
  onFolderPick,
  onRun,
}: Props) {
  const selected = providers.find((p) => p.id === providerId);
  const canRun =
    !busy &&
    !!selected?.installed &&
    prompt.trim().length > 0 &&
    folder.trim().length > 0;

  return (
    <section className="command-composer" aria-label="Prompt composer">
      <div className="composer-controls">
        <label className="agent-select">
          <span className="sr-only">App</span>
          <span className={`provider-mark provider-mark-${providerId}`} aria-hidden="true">
            {providerId === "claude" ? "A" : providerId === "codex" ? "O" : "C"}
          </span>
          <select
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
            aria-label="App"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.installed}>
                {PROVIDER_LABELS[p.id] ?? p.name}
                {!p.installed ? " (missing)" : ""}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m5 6 3 3 3-3" />
          </svg>
        </label>

        <button
          type="button"
          className="folder-picker"
          onClick={onFolderPick}
          aria-label="Browse"
          title={folder || "Choose a project folder"}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M2.8 5.6h5l1.5 1.7h7.9v8.2H2.8z" />
          </svg>
          <span className="folder-picker-path">{folder || "Choose project"}</span>
          <span className="folder-picker-action">Browse</span>
        </button>
      </div>

      <div className="command-input">
        <span className="prompt-sigil" aria-hidden="true">›</span>
        <label className="prompt-field">
          <span className="sr-only">Prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
            aria-label="Prompt"
            placeholder="What do you want to build?"
            rows={2}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canRun) {
              e.preventDefault();
              onRun();
            }
          }}
        />
        </label>
        <button
          type="button"
          className="send-button"
          disabled={!canRun}
          onClick={onRun}
          aria-label="Run"
          title="Run prompt (⌘↵)"
        >
          {busy ? (
            <span className="send-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="m5.5 10 4.5-4.5 4.5 4.5M10 5.8v8.7" />
            </svg>
          )}
        </button>
      </div>
      <div className="composer-footnote">
        {error ? <span className="error-text">{error}</span> : <span>⌘ Enter to run</span>}
        <span>Interactive permissions stay in the terminal</span>
      </div>
    </section>
  );
}
