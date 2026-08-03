package providers

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"strings"
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

	// The first name that resolves wins.
	got, err = ResolveBinary([]string{"absent-cli", name}, dir)
	if err != nil || got != path {
		t.Fatalf("fallback name: got %q err %v", got, err)
	}

	if _, err := ResolveBinary([]string{"absent-cli"}, dir); err == nil {
		t.Fatal("expected error for missing binary")
	}
}

// Resolution must never swap the process-wide PATH: doing so raced with any
// other goroutine spawning a command.
func TestResolveBinaryDoesNotMutateGlobalPATH(t *testing.T) {
	before, had := os.LookupEnv("PATH")
	_, _ = ResolveBinary([]string{"absent-cli"}, t.TempDir())
	after, stillHad := os.LookupEnv("PATH")
	if had != stillHad || before != after {
		t.Fatalf("PATH mutated: %q -> %q", before, after)
	}
}

func TestResolveBinarySkipsNonExecutable(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix permission bits")
	}
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "not-exec"), []byte("data"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := ResolveBinary([]string{"not-exec"}, dir); err == nil {
		t.Fatal("expected non-executable file to be skipped")
	}
}

func TestResolveBinaryAbsolutePath(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix permission bits")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "abs-cli")
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	// An absolute name bypasses the PATH walk entirely.
	got, err := ResolveBinary([]string{path}, t.TempDir())
	if err != nil || got != path {
		t.Fatalf("got %q err %v", got, err)
	}
}

func TestCheckAuthViaStatus(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("shell script fixtures")
	}
	dir := t.TempDir()
	script := func(name, body string) string {
		path := filepath.Join(dir, name)
		if err := os.WriteFile(path, []byte(body), 0o755); err != nil {
			t.Fatal(err)
		}
		return path
	}

	cases := []struct {
		name    string
		body    string
		wantOK  bool
		wantMsg string
	}{
		{"exit zero is connected", "#!/bin/sh\nexit 0\n", true, msgConnected},
		{"explicit signed out", "#!/bin/sh\necho 'not logged in'\nexit 1\n", false, msgSignIn},
		{"opaque failure echoes output", "#!/bin/sh\necho 'boom: weird failure'\nexit 3\n", false, "boom: weird failure"},
		{"silent failure", "#!/bin/sh\nexit 1\n", false, msgSignIn},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			ok, msg := checkAuthViaStatus(context.Background(), script(tc.name, tc.body))
			if ok != tc.wantOK || msg != tc.wantMsg {
				t.Fatalf("got (%v, %q) want (%v, %q)", ok, msg, tc.wantOK, tc.wantMsg)
			}
		})
	}

	// A binary that cannot be executed at all is reported as unknown.
	ok, msg := checkAuthViaStatus(context.Background(), filepath.Join(dir, "does-not-exist"))
	if ok || msg != msgAuthUnknown {
		t.Fatalf("missing binary: got (%v, %q)", ok, msg)
	}
}

func TestLoginShellPATHAlwaysReturnsSomething(t *testing.T) {
	if got := LoginShellPATH(); got == "" {
		t.Fatal("expected a non-empty PATH")
	}
	// A bogus SHELL must fall back rather than hang or panic.
	t.Setenv("SHELL", filepath.Join(t.TempDir(), "no-such-shell"))
	if got := LoginShellPATH(); got == "" {
		t.Fatal("expected fallback PATH when shell probe fails")
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
	if !looksAuthenticated(`{"authenticated":true,"email":"a@b.com"}`) {
		t.Fatal("expected authenticated json")
	}
	if looksAuthenticated(`Not authenticated`) {
		t.Fatal("expected unauthenticated")
	}
	// An explicit signed-out signal must win even alongside a positive one.
	if looksAuthenticated(`logged in: no, logged out`) {
		t.Fatal("negative signal should win")
	}
	if looksAuthenticated(`status unknown`) {
		t.Fatal("ambiguous output is not authenticated")
	}
}

func TestLooksUnauthenticated(t *testing.T) {
	for _, out := range []string{
		`{"authenticated":false}`,
		"Not authenticated",
		"not logged in",
		"you are logged out",
	} {
		if !looksUnauthenticated(strings.ToLower(out)) {
			t.Fatalf("expected signed-out signal for %q", out)
		}
	}
	if looksUnauthenticated("logged in as a@b.com") {
		t.Fatal("did not expect signed-out signal")
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
