package providers

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// LoginShellPATH returns PATH as seen by a login shell on macOS/Linux.
// Falls back to the process environment when the shell probe fails.
func LoginShellPATH() string {
	shell := os.Getenv("SHELL")
	if shell == "" {
		if runtime.GOOS == "darwin" {
			shell = "/bin/zsh"
		} else {
			shell = "/bin/bash"
		}
	}

	ctxTimeout := 3 * time.Second
	cmd := exec.Command(shell, "-lc", "printf '%s' \"$PATH\"")
	done := make(chan struct{})
	var out []byte
	var err error
	go func() {
		out, err = cmd.Output()
		close(done)
	}()

	select {
	case <-done:
		if err == nil {
			path := strings.TrimSpace(string(out))
			if path != "" {
				return path
			}
		}
	case <-time.After(ctxTimeout):
		_ = cmd.Process.Kill()
	}

	if path := os.Getenv("PATH"); path != "" {
		return path
	}
	return "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin"
}

// ResolveBinary finds the first matching executable on pathEnv.
func ResolveBinary(names []string, pathEnv string) (string, error) {
	if pathEnv == "" {
		pathEnv = LoginShellPATH()
	}
	for _, name := range names {
		if filepath.IsAbs(name) {
			if isExecutable(name) {
				return name, nil
			}
			continue
		}
		for _, dir := range filepath.SplitList(pathEnv) {
			if dir == "" {
				continue
			}
			candidate := filepath.Join(dir, name)
			if isExecutable(candidate) {
				return candidate, nil
			}
		}
		// Also try LookPath with augmented PATH for relative fallbacks.
		old := os.Getenv("PATH")
		_ = os.Setenv("PATH", pathEnv)
		path, err := exec.LookPath(name)
		_ = os.Setenv("PATH", old)
		if err == nil && path != "" {
			return path, nil
		}
	}
	return "", fmt.Errorf("none of %v found on PATH", names)
}

func isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	mode := info.Mode()
	return mode&0o111 != 0
}
