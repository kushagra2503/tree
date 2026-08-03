package providers

import "context"

type codexProvider struct{}

func (p *codexProvider) ID() ID { return Codex }

func (p *codexProvider) Name() string { return "Codex" }

func (p *codexProvider) BinaryNames() []string { return []string{"codex"} }

func (p *codexProvider) InstallHint() string {
	return "Install with npm i -g @openai/codex, then restart Tree."
}

func (p *codexProvider) Version(ctx context.Context, binaryPath string) string {
	return versionFromFlag(ctx, binaryPath)
}

func (p *codexProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	return checkAuthViaStatus(ctx, binaryPath, "login", "status")
}

func (p *codexProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"login"}
}

func (p *codexProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
	return buildLaunch(binaryPath, prompt, dir)
}
