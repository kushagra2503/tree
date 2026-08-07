import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

const mocks = vi.hoisted(() => ({
  GetProviders: vi.fn(),
  RefreshProviders: vi.fn(),
  ConnectProvider: vi.fn(),
  SelectFolder: vi.fn(),
  StartSession: vi.fn(),
  StopSession: vi.fn(),
  CloseSession: vi.fn(),
}));

vi.mock("../wailsjs/go/main/App", () => mocks);

vi.mock("./components/TerminalSession", () => ({
  TerminalSession: () => <div data-testid="terminal-session" />,
}));

describe("App", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.GetProviders.mockResolvedValue([
      {
        id: "claude",
        name: "Claude Code",
        installed: true,
        path: "/bin/claude",
        version: "1",
        authenticated: true,
        message: "Connected",
        installHint: "",
      },
      {
        id: "codex",
        name: "Codex",
        installed: false,
        path: "",
        version: "",
        authenticated: false,
        message: "Not installed",
        installHint: "Install Codex",
      },
      {
        id: "cursor",
        name: "Cursor",
        installed: false,
        path: "",
        version: "",
        authenticated: false,
        message: "Not installed",
        installHint: "Install Cursor",
      },
    ]);
    mocks.RefreshProviders.mockImplementation(mocks.GetProviders);
  });

  it("loads providers and creates a session on run", async () => {
    const user = userEvent.setup();
    mocks.SelectFolder.mockResolvedValue("/tmp/project");
    mocks.StartSession.mockResolvedValue({
      id: "sess-1",
      provider: "claude",
      title: "fix lint",
      folder: "/tmp/project",
      running: true,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("1 app connected")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Browse" }));
    await waitFor(() => {
      expect(screen.getAllByText("/tmp/project").length).toBeGreaterThan(0);
    });

    await user.type(screen.getByLabelText("Prompt"), "fix lint");
    await user.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(mocks.StartSession).toHaveBeenCalledWith(
        "claude",
        "fix lint",
        "/tmp/project",
        120,
        36,
      );
    });
    expect((await screen.findAllByRole("button", { name: "fix lint" })).length).toBeGreaterThan(0);
  });

  it("keeps a compact shell with Tree branding", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Tree", level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(mocks.GetProviders).toHaveBeenCalled());
    expect(document.querySelector(".app-shell")).toBeTruthy();
    expect(document.querySelector(".paper-grid")).toBeTruthy();
    expect(document.querySelector(".provider-list")).toBeTruthy();
  });
});
