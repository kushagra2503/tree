package providers

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func TestBuildLaunchArgs(t *testing.T) {
	cases := []struct {
		name string
		p    Provider
	}{
		{"claude", &claudeProvider{}},
		{"codex", &codexProvider{}},
		{"cursor", &cursorProvider{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			spec, err := tc.p.BuildLaunch("/bin/tool", "fix the tests", "/tmp/project")
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if spec.Path != "/bin/tool" {
				t.Fatalf("path = %q", spec.Path)
			}
			if len(spec.Args) != 1 || spec.Args[0] != "fix the tests" {
				t.Fatalf("args = %#v", spec.Args)
			}
			if spec.Dir != "/tmp/project" {
				t.Fatalf("dir = %q", spec.Dir)
			}
		})
	}
}

func TestBuildLaunchValidation(t *testing.T) {
	p := &claudeProvider{}
	if _, err := p.BuildLaunch("/bin/tool", "  ", "/tmp"); err == nil {
		t.Fatal("expected empty prompt error")
	}
	if _, err := p.BuildLaunch("/bin/tool", "hi", "  "); err == nil {
		t.Fatal("expected empty dir error")
	}
}

func TestByID(t *testing.T) {
	p, err := ByID("codex")
	if err != nil || p.ID() != Codex {
		t.Fatalf("ByID(codex) failed: %v %#v", err, p)
	}
	if _, err := ByID("nope"); err == nil {
		t.Fatal("expected unknown provider error")
	}
}

func TestResolveBinary(t *testing.T) {
	dir := t.TempDir()
	name := "fake-cli"
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte("#!/bin/sh\necho ok\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	got, err := ResolveBinary([]string{name}, dir)
	if err != nil {
		t.Fatal(err)
	}
	if got != path {
		t.Fatalf("got %q want %q", got, path)
	}
}

func TestLoginCommands(t *testing.T) {
	path := "/usr/local/bin/tool"
	if p, a := (&claudeProvider{}).LoginCommand(path); p != path || len(a) != 2 || a[0] != "auth" || a[1] != "login" {
		t.Fatalf("claude login: %s %#v", p, a)
	}
	if p, a := (&codexProvider{}).LoginCommand(path); p != path || len(a) != 1 || a[0] != "login" {
		t.Fatalf("codex login: %s %#v", p, a)
	}
	if p, a := (&cursorProvider{}).LoginCommand(path); p != path || len(a) != 1 || a[0] != "login" {
		t.Fatalf("cursor login: %s %#v", p, a)
	}
}

func TestLooksAuthenticated(t *testing.T) {
	raw := `{"authenticated":true,"email":"a@b.com"}`
	if !looksAuthenticated(raw, raw) {
		t.Fatal("expected authenticated json")
	}
	raw = `Not authenticated`
	if looksAuthenticated(raw, "not authenticated") {
		t.Fatal("expected unauthenticated")
	}
}

func TestProbeStatusMissing(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix path probe")
	}
	status := ProbeStatus(context.Background(), &claudeProvider{}, t.TempDir())
	if status.Installed {
		t.Fatal("expected not installed")
	}
	if status.InstallHint == "" {
		t.Fatal("expected install hint")
	}
}
