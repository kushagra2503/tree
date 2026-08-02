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
    <section className="composer panel" aria-label="Prompt composer">
      <div className="composer-row">
        <label className="field">
          <span>App</span>
          <select
            value={providerId}
            onChange={(e) => onProviderChange(e.target.value)}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.installed}>
                {PROVIDER_LABELS[p.id] ?? p.name}
                {!p.installed ? " (missing)" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="field folder-field">
          <span>Folder</span>
          <div className="folder-control">
            <input
              readOnly
              value={folder}
              placeholder="Choose a project folder"
              title={folder}
            />
            <button type="button" className="btn ghost" onClick={onFolderPick}>
              Browse
            </button>
          </div>
        </label>
      </div>

      <label className="field">
        <span>Prompt</span>
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Ask the selected CLI to work in this folder…"
          rows={4}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canRun) {
              e.preventDefault();
              onRun();
            }
          }}
        />
      </label>

      <div className="composer-footer">
        <div className="composer-hint">
          {error ? <span className="error-text">{error}</span> : <span>⌘↵ to run</span>}
        </div>
        <button type="button" className="btn primary" disabled={!canRun} onClick={onRun}>
          {busy ? "Starting…" : "Run"}
        </button>
      </div>
    </section>
  );
}
