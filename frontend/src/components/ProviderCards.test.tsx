import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProviderCards } from "./ProviderCards";
import type { ProviderStatus } from "../types";

const providers: ProviderStatus[] = [
  {
    id: "claude",
    name: "Claude Code",
    installed: false,
    path: "",
    version: "",
    authenticated: false,
    message: "Not installed",
    installHint: "Install Claude Code CLI",
  },
  {
    id: "codex",
    name: "Codex",
    installed: true,
    path: "/bin/codex",
    version: "0.1",
    authenticated: false,
    message: "Installed — sign in to connect",
    installHint: "",
  },
  {
    id: "cursor",
    name: "Cursor",
    installed: true,
    path: "/bin/agent",
    version: "1.0",
    authenticated: true,
    message: "Connected",
    installHint: "",
  },
];

describe("ProviderCards", () => {
  it("renders install guidance and connect actions", async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    const onRefresh = vi.fn();
    render(
      <ProviderCards
        providers={providers}
        loading={false}
        onConnect={onConnect}
        onRefresh={onRefresh}
      />,
    );

    expect(screen.getByText("Install Claude Code CLI")).toBeInTheDocument();
    expect(screen.getByText("Ready · 1.0")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(onConnect).toHaveBeenCalledWith("codex");
  });
});
