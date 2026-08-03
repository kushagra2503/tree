import { useCallback, useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { ResizeSession, WriteSession } from "../../wailsjs/go/main/App";
import type { TerminalExitEvent, TerminalOutputEvent } from "../types";
import { decodeBase64, encodeBase64 } from "../lib/base64";
import { TERMINAL_EXIT_EVENT, TERMINAL_OUTPUT_EVENT } from "../lib/events";
import { terminalOptions } from "../lib/terminalTheme";

interface Props {
  sessionId: string;
  active: boolean;
  onExited?: (id: string, code: number) => void;
}

/** Below this size the host is still collapsed and fitting yields junk values. */
const MIN_FIT_PX = 40;

/** Layout can settle a frame or two after mount, so re-fit on a short ramp. */
const SETTLE_DELAYS_MS = [50, 200];

/** Delay before re-fitting a tab that has just become visible. */
const ACTIVATE_DELAY_MS = 80;

export function TerminalSession({ sessionId, active, onExited }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  // Fits the terminal to its host and pushes the new size to the PTY.
  const refit = useCallback(
    (focus = false) => {
      const host = hostRef.current;
      const term = termRef.current;
      const fit = fitRef.current;
      if (!host || !term || !fit) return;
      if (host.clientWidth < MIN_FIT_PX || host.clientHeight < MIN_FIT_PX) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      if (term.cols > 0 && term.rows > 0) {
        void ResizeSession(sessionId, term.cols, term.rows);
      }
      if (focus) term.focus();
    },
    [sessionId],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const term = new Terminal(terminalOptions);
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    termRef.current = term;
    fitRef.current = fit;

    const onData = term.onData((data) => {
      void WriteSession(sessionId, encodeBase64(data));
    });

    const unsubOutput = EventsOn(TERMINAL_OUTPUT_EVENT, (ev: TerminalOutputEvent) => {
      if (ev.sessionId !== sessionId || !termRef.current) return;
      try {
        termRef.current.write(decodeBase64(ev.data));
      } catch {
        // ignore decode glitches
      }
    });

    const unsubExit = EventsOn(TERMINAL_EXIT_EVENT, (ev: TerminalExitEvent) => {
      if (ev.sessionId !== sessionId) return;
      termRef.current?.writeln(`\r\n\x1b[90m[process exited with code ${ev.code}]\x1b[0m`);
      onExitedRef.current?.(sessionId, ev.code);
    });

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => refit());
    });
    observer.observe(host);

    // Fit after layout settles — first paint often has a tiny host height.
    requestAnimationFrame(() => refit());
    const timers = SETTLE_DELAYS_MS.map((ms) => window.setTimeout(() => refit(), ms));

    return () => {
      timers.forEach(window.clearTimeout);
      onData.dispose();
      unsubOutput();
      unsubExit();
      observer.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId, refit]);

  // A hidden tab has no usable dimensions, so re-fit and focus on activation.
  useEffect(() => {
    if (!active) return;
    requestAnimationFrame(() => refit(true));
    const timer = window.setTimeout(() => refit(true), ACTIVATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, refit]);

  return (
    <div
      className={`terminal-host ${active ? "active" : "hidden"}`}
      ref={hostRef}
      data-session={sessionId}
    />
  );
}
