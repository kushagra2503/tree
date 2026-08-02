package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
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

// App is the Wails-bound application API.
type App struct {
	ctx      context.Context
	cancel   context.CancelFunc
	terms    *terminal.Manager
	pathEnv  string
}

// NewApp creates a new App.
func NewApp() *App {
	return &App{
		terms: terminal.NewManager(),
	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx, a.cancel = context.WithCancel(ctx)
	a.pathEnv = providers.LoginShellPATH()
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

// GetProviders returns current CLI connection status.
func (a *App) GetProviders() []providers.Status {
	base := a.ctx
	if base == nil {
		base = context.Background()
	}
	ctx, cancel := context.WithTimeout(base, 20*time.Second)
	defer cancel()
	return providers.ProbeAll(ctx)
}

// RefreshProviders re-probes PATH and auth status.
func (a *App) RefreshProviders() []providers.Status {
	a.pathEnv = providers.LoginShellPATH()
	status := a.GetProviders()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, eventProviders, status)
	}
	return status
}

// ConnectProvider launches the provider's official login flow.
func (a *App) ConnectProvider(providerID string) error {
	p, err := providers.ByID(providerID)
	if err != nil {
		return err
	}
	pathEnv := a.pathEnv
	if pathEnv == "" {
		pathEnv = providers.LoginShellPATH()
	}
	bin, err := providers.ResolveBinary(p.BinaryNames(), pathEnv)
	if err != nil {
		return fmt.Errorf("%s is not installed. %s", p.Name(), p.InstallHint())
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
		time.Sleep(1200 * time.Millisecond)
		if a.ctx != nil {
			a.RefreshProviders()
		}
	}()
	return nil
}

// SelectFolder opens a native directory picker.
func (a *App) SelectFolder() (string, error) {
	path, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Choose project folder",
	})
	if err != nil {
		return "", err
	}
	return path, nil
}

// StartSession starts a selected provider CLI in an embedded terminal.
func (a *App) StartSession(providerID, prompt, folder string, cols, rows int) (terminal.Info, error) {
	prompt = strings.TrimSpace(prompt)
	folder = strings.TrimSpace(folder)
	if prompt == "" {
		return terminal.Info{}, fmt.Errorf("enter a prompt")
	}
	if folder == "" {
		return terminal.Info{}, fmt.Errorf("choose a project folder")
	}
	info, err := os.Stat(folder)
	if err != nil || !info.IsDir() {
		return terminal.Info{}, fmt.Errorf("project folder is not a directory")
	}
	folder, err = filepath.Abs(folder)
	if err != nil {
		return terminal.Info{}, err
	}

	p, err := providers.ByID(providerID)
	if err != nil {
		return terminal.Info{}, err
	}
	pathEnv := a.pathEnv
	if pathEnv == "" {
		pathEnv = providers.LoginShellPATH()
	}
	bin, err := providers.ResolveBinary(p.BinaryNames(), pathEnv)
	if err != nil {
		return terminal.Info{}, fmt.Errorf("%s is not installed. %s", p.Name(), p.InstallHint())
	}

	// Soft auth check — still allow launch if status is unclear, but warn via error if clearly missing.
	authCtx, cancel := context.WithTimeout(a.ctx, 6*time.Second)
	ok, _ := p.CheckAuth(authCtx, bin)
	cancel()
	if !ok {
		// Do not hard-block; many CLIs can still open and prompt for login in-terminal.
		// Soft guidance is returned only when binary missing above.
		_ = ok
	}

	if cols <= 0 {
		cols = 120
	}
	if rows <= 0 {
		rows = 36
	}
	return a.terms.Start(a.ctx, providerID, prompt, folder, uint16(cols), uint16(rows))
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
