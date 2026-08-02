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
	out, _, _ := runQuiet(ctx, binaryPath, "--version")
	if v := firstNonEmptyLine(out); v != "" {
		return v
	}
	out, _, _ = runQuiet(ctx, binaryPath, "about")
	return firstNonEmptyLine(out)
}

func (p *cursorProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	out, code, err := runQuiet(ctx, binaryPath, "status", "--format", "json")
	if err != nil && code < 0 {
		out, code, err = runQuiet(ctx, binaryPath, "status")
	}
	if err != nil && code < 0 {
		return false, "Could not check auth status"
	}

	lower := strings.ToLower(out)
	if looksAuthenticated(out, lower) {
		return true, "Connected"
	}
	if strings.Contains(lower, "not authenticated") ||
		strings.Contains(lower, "not logged") ||
		strings.Contains(lower, `"authenticated":false`) {
		return false, "Installed — sign in to connect"
	}
	if code == 0 && out != "" {
		// status succeeded without a clear negative signal
		return true, "Connected"
	}
	if out != "" {
		return false, firstNonEmptyLine(out)
	}
	return false, "Installed — sign in to connect"
}

func (p *cursorProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"login"}
}

func (p *cursorProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
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
