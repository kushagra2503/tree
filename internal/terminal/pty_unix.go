//go:build darwin || linux

package terminal

import (
	"context"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/creack/pty"

	"tree/internal/providers"
)

func startPTY(
	ctx context.Context,
	spec providers.LaunchSpec,
	cols, rows uint16,
	onData func([]byte),
	onExit func(int),
) (writeFn func([]byte) error, resizeFn func(cols, rows uint16) error, killFn func() error, err error) {
	cmd := exec.CommandContext(ctx, spec.Path, spec.Args...)
	cmd.Dir = spec.Dir
	env := os.Environ()
	if len(spec.Env) > 0 {
		env = append(env, spec.Env...)
	}
	env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor")
	cmd.Env = env

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Cols: cols, Rows: rows})
	if err != nil {
		return nil, nil, nil, err
	}

	var once sync.Once
	closePTY := func() {
		once.Do(func() {
			_ = ptmx.Close()
		})
	}

	go func() {
		buf := make([]byte, 32*1024)
		var pending []byte
		flush := func() {
			if len(pending) == 0 {
				return
			}
			chunk := append([]byte(nil), pending...)
			pending = pending[:0]
			onData(chunk)
		}
		ticker := time.NewTicker(16 * time.Millisecond)
		defer ticker.Stop()

		readDone := make(chan struct{})
		go func() {
			defer close(readDone)
			for {
				n, readErr := ptmx.Read(buf)
				if n > 0 {
					pending = append(pending, buf[:n]...)
					if len(pending) >= 8*1024 {
						flush()
					}
				}
				if readErr != nil {
					flush()
					return
				}
			}
		}()

		for {
			select {
			case <-ticker.C:
				flush()
			case <-readDone:
				flush()
				return
			case <-ctx.Done():
				flush()
				return
			}
		}
	}()

	go func() {
		waitErr := cmd.Wait()
		code := 0
		if waitErr != nil {
			if exitErr, ok := waitErr.(*exec.ExitError); ok {
				code = exitErr.ExitCode()
			} else {
				code = 1
			}
		}
		closePTY()
		onExit(code)
	}()

	writeFn = func(b []byte) error {
		_, werr := ptmx.Write(b)
		return werr
	}
	resizeFn = func(c, r uint16) error {
		return pty.Setsize(ptmx, &pty.Winsize{Cols: c, Rows: r})
	}
	killFn = func() error {
		closePTY()
		if cmd.Process != nil {
			_ = cmd.Process.Signal(os.Interrupt)
			time.AfterFunc(800*time.Millisecond, func() {
				if cmd.ProcessState == nil {
					_ = cmd.Process.Kill()
				}
			})
		}
		return nil
	}

	return writeFn, resizeFn, killFn, nil
}
