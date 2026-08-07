import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TerminalTabs } from "./TerminalTabs";
import type { LocalSession } from "../types";

vi.mock("./TerminalSession", () => ({
  TerminalSession: ({ sessionId, active }: { sessionId: string; active: boolean }) => (
    <div data-testid={`term-${sessionId}`} data-active={active ? "1" : "0"} />
  ),
}));

const sessions: LocalSession[] = [
  {
    id: "s1",
    provider: "claude",
    title: "claude · one",
    folder: "/tmp/a",
    running: true,
    prompt: "one",
  },
  {
    id: "s2",
    provider: "codex",
    title: "codex · two",
    folder: "/tmp/b",
    running: false,
    prompt: "two",
  },
];

describe("TerminalTabs", () => {
  it("shows empty state when there are no sessions", () => {
    render(
      <TerminalTabs
        sessions={[]}
        activeId={null}
        folder=""
        onStop={vi.fn()}
        onClose={vi.fn()}
        onExited={vi.fn()}
      />
    );
    expect(screen.getByLabelText("New session canvas")).toBeInTheDocument();
  });

  it("routes active-session stop and cleanup actions", async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    const onClose = vi.fn();
    const { rerender } = render(
      <TerminalTabs
        sessions={sessions}
        activeId="s1"
        folder="/tmp/a"
        onStop={onStop}
        onClose={onClose}
        onExited={vi.fn()}
      />
    );

    expect(screen.getByTestId("term-s1")).toHaveAttribute("data-active", "1");
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledWith("s1");

    rerender(
      <TerminalTabs
        sessions={sessions}
        activeId="s2"
        folder="/tmp/b"
        onStop={onStop}
        onClose={onClose}
        onExited={vi.fn()}
      />,
    );
    expect(screen.getByTestId("term-s2")).toHaveAttribute("data-active", "1");
    await user.click(screen.getByRole("button", { name: "Close session" }));
    expect(onClose).toHaveBeenCalledWith("s2");
  });
});
