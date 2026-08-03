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

// Status messages surfaced to the UI. Kept here so every provider reports the
// same wording for the same state.
const (
	msgConnected    = "Connected"
	msgNotInstalled = "Not installed"
	msgSignIn       = "Installed — sign in to connect"
	msgAuthUnknown  = "Could not check auth status"
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
		Message:     msgNotInstalled,
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
		status.Message = msgConnected
	} else {
		status.Message = msgSignIn
	}
	return status
}

// ProbeAll returns status for every registered provider. An empty pathEnv falls
// back to probing the login-shell PATH.
func ProbeAll(ctx context.Context, pathEnv string) []Status {
	if pathEnv == "" {
		pathEnv = LoginShellPATH()
	}
	out := make([]Status, 0, len(registry))
	for _, p := range registry {
		out = append(out, ProbeStatus(ctx, p, pathEnv))
	}
	return out
}

// buildLaunch validates the inputs shared by every provider and returns an
// argv spec that passes the prompt as a single positional argument. Using argv
// directly (never a shell string) is what keeps prompts from being interpolated.
func buildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return LaunchSpec{}, errEmptyPrompt
	}
	if strings.TrimSpace(dir) == "" {
		return LaunchSpec{}, errEmptyDir
	}
	return LaunchSpec{
		Path: binaryPath,
		Args: []string{prompt},
		Dir:  dir,
	}, nil
}

// versionFromFlag reports the CLI version via the conventional --version flag.
func versionFromFlag(ctx context.Context, binaryPath string) string {
	out, _, _ := runQuiet(ctx, binaryPath, "--version")
	return firstNonEmptyLine(out)
}

// checkAuthViaStatus interprets a status subcommand that exits zero when the
// user is signed in. Providers whose output needs richer parsing (see cursor)
// implement CheckAuth themselves.
func checkAuthViaStatus(ctx context.Context, binaryPath string, args ...string) (bool, string) {
	out, code, err := runQuiet(ctx, binaryPath, args...)
	if err != nil && code < 0 {
		return false, msgAuthUnknown
	}
	if code == 0 {
		return true, msgConnected
	}
	if looksUnauthenticated(strings.ToLower(out)) {
		return false, msgSignIn
	}
	if out != "" {
		return false, firstNonEmptyLine(out)
	}
	return false, msgSignIn
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

// looksUnauthenticated reports an explicit signed-out signal in CLI output.
// lower must already be lower-cased.
func looksUnauthenticated(lower string) bool {
	return strings.Contains(lower, `"authenticated":false`) ||
		strings.Contains(lower, "not authenticated") ||
		strings.Contains(lower, "not logged") ||
		strings.Contains(lower, "logged out")
}

// looksAuthenticated reports an explicit signed-in signal in CLI output.
// An explicit signed-out signal always wins over a signed-in one.
func looksAuthenticated(out string) bool {
	lower := strings.ToLower(out)
	if looksUnauthenticated(lower) {
		return false
	}
	return strings.Contains(lower, `"authenticated":true`) ||
		strings.Contains(lower, "logged in") ||
		strings.Contains(lower, `"logged_in":true`)
}
