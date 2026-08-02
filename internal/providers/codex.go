package providers

import (
	"context"
	"strings"
)

type codexProvider struct{}

func (p *codexProvider) ID() ID { return Codex }

func (p *codexProvider) Name() string { return "Codex" }

func (p *codexProvider) BinaryNames() []string { return []string{"codex"} }

func (p *codexProvider) InstallHint() string {
	return "Install with npm i -g @openai/codex, then restart Tree."
}

func (p *codexProvider) Version(ctx context.Context, binaryPath string) string {
	out, _, _ := runQuiet(ctx, binaryPath, "--version")
	return firstNonEmptyLine(out)
}

func (p *codexProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	out, code, err := runQuiet(ctx, binaryPath, "login", "status")
	if err != nil && code < 0 {
		return false, "Could not check auth status"
	}
	if code == 0 {
		return true, "Connected"
	}
	if out != "" {
		return false, firstNonEmptyLine(out)
	}
	return false, "Installed — sign in to connect"
}

func (p *codexProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"login"}
}

func (p *codexProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
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
