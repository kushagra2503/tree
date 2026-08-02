package terminal

import (
	"encoding/base64"
	"testing"
)

func TestTruncate(t *testing.T) {
	if truncate("hello", 10) != "hello" {
		t.Fatal("short string changed")
	}
	got := truncate("abcdefghijklmnopqrstuvwxyz", 10)
	if got != "abcdefghi…" {
		t.Fatalf("got %q", got)
	}
}

func TestCloseMissingSession(t *testing.T) {
	m := NewManager()
	if err := m.Close("missing"); err != nil {
		t.Fatalf("Close missing should be nil, got %v", err)
	}
}

func TestStopMissingSession(t *testing.T) {
	m := NewManager()
	if err := m.Stop("missing"); err != ErrSessionNotFound {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestWriteMissingSession(t *testing.T) {
	m := NewManager()
	data := base64.StdEncoding.EncodeToString([]byte("x"))
	if err := m.Write("missing", data); err != ErrSessionNotFound {
		t.Fatalf("expected ErrSessionNotFound, got %v", err)
	}
}

func TestResizeValidation(t *testing.T) {
	m := NewManager()
	if err := m.Resize("x", 0, 10); err != ErrInvalidSize {
		t.Fatalf("expected invalid size, got %v", err)
	}
}

func TestSessionMapCleanup(t *testing.T) {
	m := NewManager()
	m.mu.Lock()
	m.sessions["a"] = &session{id: "a", running: false}
	m.sessions["b"] = &session{id: "b", running: false}
	m.mu.Unlock()

	_ = m.Close("a")
	list := m.List()
	if len(list) != 1 || list[0].ID != "b" {
		t.Fatalf("unexpected list: %#v", list)
	}
	m.Shutdown()
	if len(m.List()) != 0 {
		t.Fatal("expected empty after shutdown")
	}
}
