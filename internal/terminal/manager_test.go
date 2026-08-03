package terminal

import (
	"context"
	"encoding/base64"
	"strings"
	"sync"
	"testing"
	"time"

	"tree/internal/providers"
)

func TestTruncate(t *testing.T) {
	if truncate("hello", 10) != "hello" {
		t.Fatal("short string changed")
	}
	got := truncate("abcdefghijklmnopqrstuvwxyz", 10)
	if got != "abcdefghi…" {
		t.Fatalf("got %q", got)
	}
	// Degenerate widths must not slice out of range.
	if got := truncate("abc", 1); got != "…" {
		t.Fatalf("n=1 got %q", got)
	}
	if got := truncate("abc", 0); got != "…" {
		t.Fatalf("n=0 got %q", got)
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

// A session can exit while the user is still typing into it. Both paths touch
// session.running, so the read must happen under the manager mutex.
// Run with -race to catch a regression.
func TestWriteConcurrentWithExitIsRaceFree(t *testing.T) {
	data := base64.StdEncoding.EncodeToString([]byte("x"))
	for i := 0; i < 200; i++ {
		m := NewManager()
		m.mu.Lock()
		m.sessions["a"] = &session{
			id:      "a",
			running: true,
			write:   func([]byte) error { return nil },
		}
		m.mu.Unlock()

		start := make(chan struct{})
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			<-start
			_ = m.Write("a", data)
		}()
		go func() {
			defer wg.Done()
			<-start
			m.markExited("a", 0)
		}()
		close(start)
		wg.Wait()
	}
}

func TestWriteStoppedSession(t *testing.T) {
	m := NewManager()
	m.mu.Lock()
	m.sessions["a"] = &session{id: "a", running: false}
	m.mu.Unlock()

	data := base64.StdEncoding.EncodeToString([]byte("x"))
	if err := m.Write("a", data); err != ErrSessionNotRunning {
		t.Fatalf("expected ErrSessionNotRunning, got %v", err)
	}
}

// Start consumes a prepared LaunchSpec: it must not re-resolve anything, and it
// fills in default dimensions plus a prompt-derived title.
func TestStartUsesPreparedSpec(t *testing.T) {
	m := NewManager()
	defer m.Shutdown()

	exited := make(chan int, 1)
	m.SetHandlers(nil, func(ev ExitEvent) { exited <- ev.Code })

	dir := t.TempDir()
	info, err := m.Start(context.Background(), StartRequest{
		ProviderID: "claude",
		Prompt:     strings.Repeat("x", 100),
		Spec:       providers.LaunchSpec{Path: "/bin/echo", Args: []string{"hi"}, Dir: dir},
	})
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	if info.Provider != "claude" {
		t.Fatalf("provider = %q", info.Provider)
	}
	if info.Folder != dir {
		t.Fatalf("folder = %q want %q", info.Folder, dir)
	}
	if !info.Running {
		t.Fatal("expected running")
	}
	if want := strings.Repeat("x", titleMaxLen-1) + "…"; info.Title != want {
		t.Fatalf("title = %q want %q", info.Title, want)
	}

	select {
	case code := <-exited:
		if code != 0 {
			t.Fatalf("exit code = %d", code)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("timed out waiting for exit")
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
