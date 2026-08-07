import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { ResizeSession, WriteSession } from "../../wailsjs/go/main/App";
import { TerminalExitEvent, TerminalOutputEvent } from "../types";

interface Props {
  sessionId: string;
  active: boolean;
  onExited?: (id: string, code: number) => void;
}

function decodeBase64(data: string): string {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeBase64(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function TerminalSession({ sessionId, active, onExited }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      scrollback: 5000,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: 12,
      lineHeight: 1.28,
      theme: {
        background: "#fdfdfb",
        foreground: "#353532",
        cursor: "#4c96dd",
        selectionBackground: "#62a9ed44",
        black: "#30302d",
        red: "#b35f58",
        green: "#4f8c66",
        yellow: "#a57b2e",
        blue: "#3f82c4",
        magenta: "#8b6695",
        cyan: "#4c8989",
        white: "#e7e6e1",
        brightBlack: "#8d8b83",
        brightRed: "#c97870",
        brightGreen: "#68a47d",
        brightYellow: "#bd9348",
        brightBlue: "#62a9ed",
        brightMagenta: "#a77eae",
        brightCyan: "#65a0a0",
        brightWhite: "#ffffff",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;
    fitRef.current = fit;

    const syncSize = () => {
      if (!fitRef.current || !termRef.current || !hostRef.current) return;
      const { clientWidth, clientHeight } = hostRef.current;
      if (clientWidth < 40 || clientHeight < 40) return;
      try {
        fitRef.current.fit();
      } catch {
        return;
      }
      const cols = termRef.current.cols;
      const rows = termRef.current.rows;
      if (cols > 0 && rows > 0) {
        void ResizeSession(sessionId, cols, rows);
      }
    };

    const onData = term.onData((data) => {
      void WriteSession(sessionId, encodeBase64(data));
    });

    const unsubOutput = EventsOn("terminal:output", (ev: TerminalOutputEvent) => {
      if (ev.sessionId !== sessionId || !termRef.current) return;
      try {
        termRef.current.write(decodeBase64(ev.data));
      } catch {
        // ignore decode glitches
      }
    });

    const unsubExit = EventsOn("terminal:exit", (ev: TerminalExitEvent) => {
      if (ev.sessionId !== sessionId) return;
      if (termRef.current) {
        termRef.current.writeln(`\r\n\x1b[90m[process exited with code ${ev.code}]\x1b[0m`);
      }
      onExitedRef.current?.(sessionId, ev.code);
    });

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncSize);
    });
    ro.observe(hostRef.current);

    // Fit after layout settles — first paint often has a tiny host height.
    requestAnimationFrame(syncSize);
    const t1 = window.setTimeout(syncSize, 50);
    const t2 = window.setTimeout(syncSize, 200);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      onData.dispose();
      unsubOutput();
      unsubExit();
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!active) return;
    const sync = () => {
      if (!fitRef.current || !termRef.current || !hostRef.current) return;
      if (hostRef.current.clientHeight < 40) return;
      try {
        fitRef.current.fit();
      } catch {
        return;
      }
      void ResizeSession(sessionId, termRef.current.cols, termRef.current.rows);
      termRef.current.focus();
    };
    requestAnimationFrame(sync);
    const t = window.setTimeout(sync, 80);
    return () => window.clearTimeout(t);
  }, [active, sessionId]);

  return (
    <div
      className={`terminal-host ${active ? "active" : "hidden"}`}
      ref={hostRef}
      data-session={sessionId}
    />
  );
}
