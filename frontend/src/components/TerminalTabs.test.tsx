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
        onSelect={vi.fn()}
        onStop={vi.fn()}
        onClose={vi.fn()}
        onExited={vi.fn()}
      />
    );
    expect(screen.getByText(/Choose an app/i)).toBeInTheDocument();
  });

  it("routes tab selection and cleanup actions", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onStop = vi.fn();
    const onClose = vi.fn();
    render(
      <TerminalTabs
        sessions={sessions}
        activeId="s1"
        onSelect={onSelect}
        onStop={onStop}
        onClose={onClose}
        onExited={vi.fn()}
      />
    );

    expect(screen.getByTestId("term-s1")).toHaveAttribute("data-active", "1");
    await user.click(screen.getByRole("button", { name: "codex · two" }));
    expect(onSelect).toHaveBeenCalledWith("s2");
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledWith("s1");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledWith("s1");
  });
});
