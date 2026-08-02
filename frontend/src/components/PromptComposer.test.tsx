import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptComposer } from "./PromptComposer";
import type { ProviderStatus } from "../types";

const providers: ProviderStatus[] = [
  {
    id: "claude",
    name: "Claude Code",
    installed: true,
    path: "/bin/claude",
    version: "1.0",
    authenticated: true,
    message: "Connected",
    installHint: "",
  },
  {
    id: "codex",
    name: "Codex",
    installed: true,
    path: "/bin/codex",
    version: "1.0",
    authenticated: false,
    message: "Sign in",
    installHint: "",
  },
];

describe("PromptComposer", () => {
  it("disables Run when prompt or folder is empty", () => {
    render(
      <PromptComposer
        providers={providers}
        providerId="claude"
        folder=""
        prompt=""
        error=""
        busy={false}
        onProviderChange={vi.fn()}
        onFolderPick={vi.fn()}
        onPromptChange={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
  });

  it("allows selecting an installed provider and running", async () => {
    const user = userEvent.setup();
    const onProviderChange = vi.fn();
    const onRun = vi.fn();
    render(
      <PromptComposer
        providers={providers}
        providerId="claude"
        folder="/tmp/project"
        prompt="fix tests"
        error=""
        busy={false}
        onProviderChange={onProviderChange}
        onFolderPick={vi.fn()}
        onPromptChange={vi.fn()}
        onRun={onRun}
      />
    );

    await user.selectOptions(screen.getByRole("combobox", { name: "App" }), "codex");
    expect(onProviderChange).toHaveBeenCalledWith("codex");

    const run = screen.getByRole("button", { name: "Run" });
    expect(run).toBeEnabled();
    await user.click(run);
    expect(onRun).toHaveBeenCalled();
  });

  it("shows error text", () => {
    render(
      <PromptComposer
        providers={providers}
        providerId="claude"
        folder="/tmp"
        prompt="hi"
        error="choose a project folder"
        busy={false}
        onProviderChange={vi.fn()}
        onFolderPick={vi.fn()}
        onPromptChange={vi.fn()}
        onRun={vi.fn()}
      />
    );
    expect(screen.getByText("choose a project folder")).toBeInTheDocument();
  });
});
