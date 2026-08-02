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
	ErrSessionNotFound = errors.New("session not found")
	ErrInvalidSize     = errors.New("invalid terminal size")
)

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

// Start launches a provider CLI inside a PTY.
func (m *Manager) Start(ctx context.Context, providerID, prompt, folder string, cols, rows uint16) (Info, error) {
	p, err := providers.ByID(providerID)
	if err != nil {
		return Info{}, err
	}
	pathEnv := providers.LoginShellPATH()
	bin, err := providers.ResolveBinary(p.BinaryNames(), pathEnv)
	if err != nil {
		return Info{}, fmt.Errorf("%s CLI not found: %w", p.Name(), err)
	}
	spec, err := p.BuildLaunch(bin, prompt, folder)
	if err != nil {
		return Info{}, err
	}
	if cols == 0 || rows == 0 {
		cols, rows = 120, 36
	}

	id := uuid.NewString()
	title := truncate(prompt, 48)
	sessCtx, cancel := context.WithCancel(ctx)

	writeFn, resizeFn, killFn, err := startPTY(sessCtx, spec, cols, rows, func(b []byte) {
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
		provider: providerID,
		title:    title,
		folder:   folder,
		running:  true,
		cancel:   cancel,
		write:    writeFn,
		resize:   resizeFn,
		kill:     killFn,
	}

	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	return Info{
		ID:       id,
		Provider: providerID,
		Title:    title,
		Folder:   folder,
		Running:  true,
	}, nil
}

// Write sends decoded base64 input to a session.
func (m *Manager) Write(sessionID, dataB64 string) error {
	raw, err := base64.StdEncoding.DecodeString(dataB64)
	if err != nil {
		return fmt.Errorf("invalid input encoding: %w", err)
	}
	m.mu.Lock()
	s, ok := m.sessions[sessionID]
	m.mu.Unlock()
	if !ok {
		return ErrSessionNotFound
	}
	if !s.running {
		return fmt.Errorf("session is not running")
	}
	return s.write(raw)
}

// Resize updates the PTY window size.
func (m *Manager) Resize(sessionID string, cols, rows int) error {
	if cols <= 0 || rows <= 0 || cols > 1000 || rows > 1000 {
		return ErrInvalidSize
	}
	m.mu.Lock()
	s, ok := m.sessions[sessionID]
	m.mu.Unlock()
	if !ok {
		return ErrSessionNotFound
	}
	if !s.running {
		return nil
	}
	return s.resize(uint16(cols), uint16(rows))
}

// Stop terminates a running session process.
func (m *Manager) Stop(sessionID string) error {
	m.mu.Lock()
	s, ok := m.sessions[sessionID]
	m.mu.Unlock()
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

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n-1]) + "…"
}
