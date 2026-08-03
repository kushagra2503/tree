package providers

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// loginShellTimeout bounds the login-shell probe so a slow or interactive rc
// file cannot stall startup.
const loginShellTimeout = 3 * time.Second

// fallbackPATH is a last resort when neither the login shell nor the process
// environment yields a usable PATH.
const fallbackPATH = "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin"

// LoginShellPATH returns PATH as seen by a login shell on macOS/Linux.
// Falls back to the process environment when the shell probe fails.
func LoginShellPATH() string {
	ctx, cancel := context.WithTimeout(context.Background(), loginShellTimeout)
	defer cancel()

	// CommandContext kills the shell if it outlives the timeout.
	out, err := exec.CommandContext(ctx, loginShell(), "-lc", "printf '%s' \"$PATH\"").Output()
	if err == nil {
		if path := strings.TrimSpace(string(out)); path != "" {
			return path
		}
	}
	if path := os.Getenv("PATH"); path != "" {
		return path
	}
	return fallbackPATH
}

func loginShell() string {
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	if runtime.GOOS == "darwin" {
		return "/bin/zsh"
	}
	return "/bin/bash"
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
		if path := searchPath(name, pathEnv); path != "" {
			return path, nil
		}
	}
	return "", fmt.Errorf("none of %v found on PATH", names)
}

// searchPath walks pathEnv looking for an executable named name.
//
// It deliberately does not use exec.LookPath, which can only read PATH from the
// process environment: pointing it at pathEnv meant swapping the global PATH in
// and out, which raced with every other goroutine spawning a command.
func searchPath(name, pathEnv string) string {
	exts := executableExts()
	for _, dir := range filepath.SplitList(pathEnv) {
		if dir == "" {
			continue
		}
		for _, ext := range exts {
			if candidate := filepath.Join(dir, name+ext); isExecutable(candidate) {
				return candidate
			}
		}
	}
	return ""
}

// executableExts lists the suffixes an executable may carry. Unix binaries need
// none; Windows resolves them through PATHEXT.
func executableExts() []string {
	if runtime.GOOS != "windows" {
		return []string{""}
	}
	exts := []string{""}
	for _, ext := range filepath.SplitList(os.Getenv("PATHEXT")) {
		if ext = strings.TrimSpace(ext); ext != "" {
			exts = append(exts, strings.ToLower(ext))
		}
	}
	if len(exts) == 1 {
		exts = append(exts, ".com", ".exe", ".bat", ".cmd")
	}
	return exts
}

// isExecutable reports whether path is a runnable file. Windows files carry no
// Unix execute bits, so there the PATHEXT match in searchPath is the real test.
func isExecutable(path string) bool {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return false
	}
	if runtime.GOOS == "windows" {
		return true
	}
	return info.Mode()&0o111 != 0
}
