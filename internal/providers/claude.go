package providers

import (
	"context"
	"strings"
)

type claudeProvider struct{}

func (p *claudeProvider) ID() ID { return Claude }

func (p *claudeProvider) Name() string { return "Claude Code" }

func (p *claudeProvider) BinaryNames() []string { return []string{"claude"} }

func (p *claudeProvider) InstallHint() string {
	return "Install Claude Code CLI, then restart Tree. Docs: https://code.claude.com/docs"
}

func (p *claudeProvider) Version(ctx context.Context, binaryPath string) string {
	out, _, _ := runQuiet(ctx, binaryPath, "--version")
	return firstNonEmptyLine(out)
}

func (p *claudeProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	out, code, err := runQuiet(ctx, binaryPath, "auth", "status")
	if err != nil && code < 0 {
		return false, "Could not check auth status"
	}
	if code == 0 {
		return true, "Connected"
	}
	lower := strings.ToLower(out)
	if strings.Contains(lower, "not logged") || strings.Contains(lower, "logged out") {
		return false, "Installed — sign in to connect"
	}
	if out != "" {
		return false, firstNonEmptyLine(out)
	}
	return false, "Installed — sign in to connect"
}

func (p *claudeProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"auth", "login"}
}

func (p *claudeProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
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
