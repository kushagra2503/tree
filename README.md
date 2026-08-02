# Tree

Tree is a minimal macOS desktop app for launching local coding CLIs from one calm window.

Supported providers in this release:

- Claude Code (`claude`)
- OpenAI Codex (`codex`)
- Cursor CLI (`agent`)

Tree does not store API keys. It detects your installed CLIs, helps you run their official login flows, and opens each prompt in an embedded terminal.

## Prerequisites

- macOS
- Go 1.21+ (Go 1.23.3+ recommended on newer macOS)
- Node.js 18+ and npm
- [Wails v2 CLI](https://wails.io/docs/gettingstarted/installation)
- Xcode Command Line Tools

Install Wails:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

Install the CLIs you want to use, then authenticate each one with its own login command:

```bash
# Claude Code
claude auth login
claude auth status

# Codex
codex login
codex login status

# Cursor
agent login
agent status
```

## Develop

From the repo root:

```bash
wails dev
```

This starts the Go backend and Vite frontend with live reload.

## Test

```bash
# Go unit tests
go test ./...

# Frontend tests
cd frontend && npm test
```

## Build

```bash
wails build
```

The macOS app binary is written to `build/bin/Tree.app` (or `build/bin/Tree` depending on packaging).

## How it works

1. Tree probes your login-shell `PATH` for `claude`, `codex`, and `agent`.
2. Connect runs the provider’s official login command (`claude auth login`, `codex login`, or `agent login`).
3. Choose a project folder and a provider, enter a prompt, and click Run.
4. Tree starts that CLI interactively in an embedded xterm.js terminal:
   - `claude "<prompt>"`
   - `codex "<prompt>"`
   - `agent "<prompt>"`
5. Permission prompts stay interactive inside the terminal. Stop or Close ends the session.

## Project layout

- `app.go` / `main.go` — Wails app bindings and window setup
- `internal/providers` — CLI discovery, auth status, and safe launch args
- `internal/terminal` — PTY session lifecycle
- `frontend/src` — minimal React UI
