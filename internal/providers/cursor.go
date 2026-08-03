package providers

import (
	"context"
	"strings"
)

type cursorProvider struct{}

func (p *cursorProvider) ID() ID { return Cursor }

func (p *cursorProvider) Name() string { return "Cursor" }

func (p *cursorProvider) BinaryNames() []string { return []string{"agent", "cursor-agent"} }

func (p *cursorProvider) InstallHint() string {
	return "Install the Cursor CLI (agent), then restart Tree. Docs: https://cursor.com/docs/cli"
}

func (p *cursorProvider) Version(ctx context.Context, binaryPath string) string {
	if v := versionFromFlag(ctx, binaryPath); v != "" {
		return v
	}
	out, _, _ := runQuiet(ctx, binaryPath, "about")
	return firstNonEmptyLine(out)
}

// CheckAuth is bespoke because the Cursor CLI reports status as JSON and can
// exit zero while signed out, so exit code alone is not conclusive.
func (p *cursorProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	out, code, err := runQuiet(ctx, binaryPath, "status", "--format", "json")
	if err != nil && code < 0 {
		out, code, err = runQuiet(ctx, binaryPath, "status")
	}
	if err != nil && code < 0 {
		return false, msgAuthUnknown
	}

	if looksAuthenticated(out) {
		return true, msgConnected
	}
	if looksUnauthenticated(strings.ToLower(out)) {
		return false, msgSignIn
	}
	if code == 0 && out != "" {
		// status succeeded without a clear negative signal
		return true, msgConnected
	}
	if out != "" {
		return false, firstNonEmptyLine(out)
	}
	return false, msgSignIn
}

func (p *cursorProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"login"}
}

func (p *cursorProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
	return buildLaunch(binaryPath, prompt, dir)
}
