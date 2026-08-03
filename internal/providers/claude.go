package providers

import "context"

type claudeProvider struct{}

func (p *claudeProvider) ID() ID { return Claude }

func (p *claudeProvider) Name() string { return "Claude Code" }

func (p *claudeProvider) BinaryNames() []string { return []string{"claude"} }

func (p *claudeProvider) InstallHint() string {
	return "Install Claude Code CLI, then restart Tree. Docs: https://code.claude.com/docs"
}

func (p *claudeProvider) Version(ctx context.Context, binaryPath string) string {
	return versionFromFlag(ctx, binaryPath)
}

func (p *claudeProvider) CheckAuth(ctx context.Context, binaryPath string) (bool, string) {
	return checkAuthViaStatus(ctx, binaryPath, "auth", "status")
}

func (p *claudeProvider) LoginCommand(binaryPath string) (string, []string) {
	return binaryPath, []string{"auth", "login"}
}

func (p *claudeProvider) BuildLaunch(binaryPath, prompt, dir string) (LaunchSpec, error) {
	return buildLaunch(binaryPath, prompt, dir)
}
