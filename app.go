package main

import (
	"context"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"tree/internal/providers"
	"tree/internal/terminal"
)

const (
	eventTerminalOutput = "terminal:output"
	eventTerminalExit   = "terminal:exit"
	eventProviders      = "providers:updated"
)

const (
	// providerProbeTimeout bounds a full sweep of provider version/auth checks.
	providerProbeTimeout = 20 * time.Second
	// loginSettleDelay lets a provider persist credentials before re-probing.
	loginSettleDelay = 1200 * time.Millisecond
)

// App is the Wails-bound application API.
type App struct {
	ctx    context.Context
	cancel context.CancelFunc
	terms  *terminal.Manager

	// mu guards pathEnv, which Wails may touch from several binding goroutines.
	mu      sync.Mutex
	pathEnv string
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{
		terms: terminal.NewManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx, a.cancel = context.WithCancel(ctx)
	a.refreshShellPATH()
	a.terms.SetHandlers(
		func(ev terminal.OutputEvent) {
			runtime.EventsEmit(a.ctx, eventTerminalOutput, ev)
		},
		func(ev terminal.ExitEvent) {
			runtime.EventsEmit(a.ctx, eventTerminalExit, ev)
		},
	)
}

func (a *App) shutdown(ctx context.Context) {
	if a.cancel != nil {
		a.cancel()
	}
	a.terms.Shutdown()
}

// shellPATH returns the cached login-shell PATH, probing once on first use.
func (a *App) shellPATH() string {
	a.mu.Lock()
	cached := a.pathEnv
	a.mu.Unlock()
	if cached != "" {
		return cached
	}
	return a.refreshShellPATH()
}

// refreshShellPATH re-probes the login-shell PATH and caches it. The probe runs
// outside the lock because it spawns a shell.
func (a *App) refreshShellPATH() string {
	path := providers.LoginShellPATH()
	a.mu.Lock()
	a.pathEnv = path
	a.mu.Unlock()
	return path
}

// baseCtx returns the app context, falling back to Background before startup.
func (a *App) baseCtx() context.Context {
	if a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}

// GetProviders returns current CLI connection status.
func (a *App) GetProviders() []providers.Status {
	ctx, cancel := context.WithTimeout(a.baseCtx(), providerProbeTimeout)
	defer cancel()
	return providers.ProbeAll(ctx, a.shellPATH())
}

// RefreshProviders re-probes PATH and auth status.
func (a *App) RefreshProviders() []providers.Status {
	a.refreshShellPATH()
	status := a.GetProviders()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, eventProviders, status)
	}
	return status
}

// resolveProvider looks up a provider and its executable, reporting the
// provider's install hint when the binary cannot be found.
func (a *App) resolveProvider(providerID string) (providers.Provider, string, error) {
	p, err := providers.ByID(providerID)
	if err != nil {
		return nil, "", err
	}
	bin, err := providers.ResolveBinary(p.BinaryNames(), a.shellPATH())
	if err != nil {
		return nil, "", fmt.Errorf("%s is not installed. %s", p.Name(), p.InstallHint())
	}
	return p, bin, nil
}

// ConnectProvider launches the provider's official login flow.
func (a *App) ConnectProvider(providerID string) error {
	p, bin, err := a.resolveProvider(providerID)
	if err != nil {
		return err
	}
	path, args := p.LoginCommand(bin)
	cmd := exec.Command(path, args...)
	cmd.Env = os.Environ()
	// Detach login so the browser/OAuth flow can complete independently.
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start login for %s: %w", p.Name(), err)
	}
	go func() {
		_ = cmd.Wait()
		// Give credentials a moment to settle, then refresh.
		time.Sleep(loginSettleDelay)
		if a.ctx != nil {
			a.RefreshProviders()
		}
	}()
	return nil
}

// SelectFolder opens a native directory picker.
func (a *App) SelectFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose project folder",
	})
}

// StartSession starts a selected provider CLI in an embedded terminal.
func (a *App) StartSession(providerID, prompt, folder string, cols, rows int) (terminal.Info, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return terminal.Info{}, fmt.Errorf("enter a prompt")
	}
	folder, err := absProjectDir(folder)
	if err != nil {
		return terminal.Info{}, err
	}

	p, bin, err := a.resolveProvider(providerID)
	if err != nil {
		return terminal.Info{}, err
	}
	spec, err := p.BuildLaunch(bin, prompt, folder)
	if err != nil {
		return terminal.Info{}, err
	}

	return a.terms.Start(a.ctx, terminal.StartRequest{
		ProviderID: providerID,
		Prompt:     prompt,
		Spec:       spec,
		Cols:       clampDimension(cols),
		Rows:       clampDimension(rows),
	})
}

// WriteSession writes base64-encoded terminal input.
func (a *App) WriteSession(sessionID, dataB64 string) error {
	return a.terms.Write(sessionID, dataB64)
}

// ResizeSession resizes a session PTY.
func (a *App) ResizeSession(sessionID string, cols, rows int) error {
	return a.terms.Resize(sessionID, cols, rows)
}

// StopSession stops a running session.
func (a *App) StopSession(sessionID string) error {
	return a.terms.Stop(sessionID)
}

// CloseSession stops and removes a session.
func (a *App) CloseSession(sessionID string) error {
	return a.terms.Close(sessionID)
}

// ListSessions returns current terminal sessions.
func (a *App) ListSessions() []terminal.Info {
	return a.terms.List()
}

// absProjectDir validates that folder is an existing directory and returns its
// absolute path.
func absProjectDir(folder string) (string, error) {
	folder = strings.TrimSpace(folder)
	if folder == "" {
		return "", fmt.Errorf("choose a project folder")
	}
	info, err := os.Stat(folder)
	if err != nil || !info.IsDir() {
		return "", fmt.Errorf("project folder is not a directory")
	}
	return filepath.Abs(folder)
}

// clampDimension narrows a UI-supplied PTY dimension into uint16. Zero means
// "use the terminal package default".
func clampDimension(v int) uint16 {
	if v <= 0 {
		return 0
	}
	if v > math.MaxUint16 {
		return math.MaxUint16
	}
	return uint16(v)
}
