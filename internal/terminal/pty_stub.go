//go:build !darwin && !linux

package terminal

import (
	"context"
	"fmt"

	"tree/internal/providers"
)

func startPTY(
	ctx context.Context,
	spec providers.LaunchSpec,
	cols, rows uint16,
	onData func([]byte),
	onExit func(int),
) (writeFn func([]byte) error, resizeFn func(cols, rows uint16) error, killFn func() error, err error) {
	return nil, nil, nil, fmt.Errorf("embedded terminals are not supported on this platform yet")
}
