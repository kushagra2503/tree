package terminal

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"

	"tree/internal/providers"
)

var (
	ErrSessionNotFound   = errors.New("session not found")
	ErrSessionNotRunning = errors.New("session is not running")
	ErrInvalidSize       = errors.New("invalid terminal size")
)

// Default PTY dimensions, applied when a caller passes zero.
const (
	DefaultCols uint16 = 120
	DefaultRows uint16 = 36
)

// titleMaxLen bounds the prompt-derived session title shown in a tab.
const titleMaxLen = 48

// maxDimension is the largest PTY width/height accepted from the UI.
const maxDimension = 1000

// OutputEvent is emitted when a session produces terminal bytes.
type OutputEvent struct {
	SessionID string `json:"sessionId"`
	Data      string `json:"data"` // base64
}

// ExitEvent is emitted when a session process exits.
type ExitEvent struct {
	SessionID string `json:"sessionId"`
	Code      int    `json:"code"`
}

// Info describes a live or recently finished session for the UI.
type Info struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
	Title    string `json:"title"`
	Folder   string `json:"folder"`
	Running  bool   `json:"running"`
}

type session struct {
	id       string
	provider string
	title    string
	folder   string
	running  bool
	cancel   context.CancelFunc
	write    func([]byte) error
	resize   func(cols, rows uint16) error
	kill     func() error
}

// Manager owns embedded PTY sessions.
type Manager struct {
	mu       sync.Mutex
	sessions map[string]*session
	onOutput func(OutputEvent)
	onExit   func(ExitEvent)
}

// NewManager creates an empty session manager.
func NewManager() *Manager {
	return &Manager{sessions: make(map[string]*session)}
}

// SetHandlers configures event callbacks.
func (m *Manager) SetHandlers(onOutput func(OutputEvent), onExit func(ExitEvent)) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onOutput = onOutput
	m.onExit = onExit
}

// StartRequest describes a session to launch.
//
// The caller resolves the provider binary and builds Spec, so the manager never
// re-probes the login-shell PATH — that probe spawns a shell and is already done
// once at startup.
type StartRequest struct {
	ProviderID string
	Prompt     string // titles the session
	Spec       providers.LaunchSpec
	Cols, Rows uint16
}

// Start launches a prepared command inside a PTY.
func (m *Manager) Start(ctx context.Context, req StartRequest) (Info, error) {
	cols, rows := req.Cols, req.Rows
	if cols == 0 {
		cols = DefaultCols
	}
	if rows == 0 {
		rows = DefaultRows
	}

	id := uuid.NewString()
	info := Info{
		ID:       id,
		Provider: req.ProviderID,
		Title:    truncate(req.Prompt, titleMaxLen),
		Folder:   req.Spec.Dir,
		Running:  true,
	}
	sessCtx, cancel := context.WithCancel(ctx)

	writeFn, resizeFn, killFn, err := startPTY(sessCtx, req.Spec, cols, rows, func(b []byte) {
		m.emitOutput(id, b)
	}, func(code int) {
		m.markExited(id, code)
	})
	if err != nil {
		cancel()
		return Info{}, err
	}

	s := &session{
		id:       id,
		provider: info.Provider,
		title:    info.Title,
		folder:   info.Folder,
		running:  true,
		cancel:   cancel,
		write:    writeFn,
		resize:   resizeFn,
		kill:     killFn,
	}

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	return info, nil
}

// lookup returns a session along with a snapshot of its running flag. Both
// reads happen under the mutex that markExited holds when clearing that flag.
func (m *Manager) lookup(sessionID string) (s *session, running, found bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, found = m.sessions[sessionID]
	if !found {
		return nil, false, false
	}
	return s, s.running, true
}

// Write sends decoded base64 input to a session.
func (m *Manager) Write(sessionID, dataB64 string) error {
	raw, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return fmt.Errorf("invalid input encoding: %w", err)
	}
	s, running, ok := m.lookup(sessionID)
	if !ok {
		return ErrSessionNotFound
	}
	if !running {
		return ErrSessionNotRunning
	}
	return s.write(raw)
}

// Resize updates the PTY window size.
func (m *Manager) Resize(sessionID string, cols, rows int) error {
	if cols <= 0 || rows <= 0 || cols > maxDimension || rows > maxDimension {
		return ErrInvalidSize
	}
	s, running, ok := m.lookup(sessionID)
	if !ok {
		return ErrSessionNotFound
	}
	if !running {
		return nil
	}
	return s.resize(uint16(cols), uint16(rows))
}

// Stop terminates a running session process.
func (m *Manager) Stop(sessionID string) error {
	s, _, ok := m.lookup(sessionID)
	if !ok {
		return ErrSessionNotFound
	}
	if s.kill != nil {
		_ = s.kill()
	}
	if s.cancel != nil {
		s.cancel()
	}
	return nil
}

// Close removes a session from the manager, stopping it first if needed.
func (m *Manager) Close(sessionID string) error {
	_ = m.Stop(sessionID)
	m.mu.Lock()
	delete(m.sessions, sessionID)
	m.mu.Unlock()
	return nil
}

// List returns current sessions.
func (m *Manager) List() []Info {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Info, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, Info{
			ID:       s.id,
			Provider: s.provider,
			Title:    s.title,
			Folder:   s.folder,
			Running:  s.running,
		})
	}
	return out
}

// Shutdown stops every session.
func (m *Manager) Shutdown() {
	m.mu.Lock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.Unlock()
	for _, id := range ids {
		_ = m.Close(id)
	}
	// Brief grace for child cleanup.
	time.Sleep(50 * time.Millisecond)
}

func (m *Manager) emitOutput(sessionID string, data []byte) {
	m.mu.Lock()
	handler := m.onOutput
	m.mu.Unlock()
	if handler == nil || len(data) == 0 {
		return
	}
	handler(OutputEvent{
		SessionID: sessionID,
		Data:      base64.StdEncoding.EncodeToString(data),
	})
}

func (m *Manager) markExited(sessionID string, code int) {
	m.mu.Lock()
	if s, ok := m.sessions[sessionID]; ok {
		s.running = false
	}
	handler := m.onExit
	m.mu.Unlock()
	if handler != nil {
		handler(ExitEvent{SessionID: sessionID, Code: code})
	}
}

// truncate shortens s to at most n runes, marking elision with an ellipsis.
func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	if n <= 1 {
		return "…"
	}
	return string(r[:n-1]) + "…"
}
