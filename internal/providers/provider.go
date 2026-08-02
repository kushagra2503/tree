package providers

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ID identifies a supported coding CLI.
type ID string

const (
	Claude ID = "claude"
	Codex  ID = "codex"
	Cursor ID = "cursor"
)

// Status describes detection and auth state for a provider.
type Status struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Installed     bool   `json:"installed"`
	Path          string `json:"path"`
	Version       string `json:"version"`
	Authenticated bool   `json:"authenticated"`
	Message       string `json:"message"`
	InstallHint   string `json:"installHint"`
}

// LaunchSpec is a safe argv launch description (no shell interpolation).
type LaunchSpec struct {
	Path string
	Args []string
	Dir  string
	Env  []string
}

// Provider abstracts a local coding CLI.
type Provider interface {
	ID() ID
	Name() string
	BinaryNames() []string
	InstallHint() string
	CheckAuth(ctx context.Context, binaryPath string) (bool, string)
	Version(ctx context.Context, binaryPath string) string
	LoginCommand(binaryPath string) (string, []string)
	BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error)
}

var registry = []Provider{
	&claudeProvider{},
	&codexProvider{},
	&cursorProvider{},
}

// All returns the built-in providers in display order.
func All() []Provider {
	out := make([]Provider, len(registry))
	copy(out, registry)
	return out
}

// ByID looks up a provider by id.
func ByID(id string) (Provider, error) {
	for _, p := range registry {
		if string(p.ID()) == id {
			return p, nil
		}
	}
	return nil, fmt.Errorf("unknown provider %q", id)
}

// ProbeStatus resolves a binary and reports install/auth status.
func ProbeStatus(ctx context.Context, p Provider, pathEnv string) Status {
	status := Status{
		ID:          string(p.ID()),
		Name:        p.Name(),
		InstallHint: p.InstallHint(),
		Message:     "Not installed",
	}

	path, err := ResolveBinary(p.BinaryNames(), pathEnv)
	if err != nil || path == "" {
		return status
	}

	status.Installed = true
	status.Path = path
	status.Version = p.Version(ctx, path)

	authCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	ok, msg := p.CheckAuth(authCtx, path)
	status.Authenticated = ok
	if msg != "" {
		status.Message = msg
	} else if ok {
		status.Message = "Connected"
	} else {
		status.Message = "Installed — sign in to connect"
	}
	return status
}

// ProbeAll returns status for every registered provider.
func ProbeAll(ctx context.Context) []Status {
	pathEnv := LoginShellPATH()
	out := make([]Status, 0, len(registry))
	for _, p := range registry {
		out = append(out, ProbeStatus(ctx, p, pathEnv))
	}
	return out
}

func runQuiet(ctx context.Context, path string, args ...string) (string, int, error) {
	cmd := exec.CommandContext(ctx, path, args...)
	cmd.Env = os.Environ()
	out, err := cmd.CombinedOutput()
	code := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			code = exitErr.ExitCode()
		} else {
			return strings.TrimSpace(string(out)), -1, err
		}
	}
	return strings.TrimSpace(string(out)), code, nil
}

func firstNonEmptyLine(s string) string {
	for _, line := range strings.Split(s, "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			return line
		}
	}
	return ""
}

// looksAuthenticated heuristically interprets CLI status output.
func looksAuthenticated(raw, lower string) bool {
	if lower == "" {
		lower = strings.ToLower(raw)
	}
	if strings.Contains(lower, `"authenticated":false`) ||
		strings.Contains(lower, "not authenticated") ||
		strings.Contains(lower, "not logged") ||
		strings.Contains(lower, "logged out") {
		return false
	}
	if strings.Contains(lower, `"authenticated":true`) ||
		strings.Contains(lower, "logged in") ||
		strings.Contains(lower, `"logged_in":true`) {
		return true
	}
	return false
}
