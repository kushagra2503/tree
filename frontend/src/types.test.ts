import { describe, expect, it } from "vitest";
import { PROVIDER_IDS, placeholderProviders, providerLabel } from "./types";

describe("providerLabel", () => {
  it("maps known ids to display names", () => {
    expect(providerLabel("claude")).toBe("Claude Code");
    expect(providerLabel("codex")).toBe("Codex");
    expect(providerLabel("cursor")).toBe("Cursor");
  });

  it("prefers the backend name for unknown ids", () => {
    expect(providerLabel("aider", "Aider")).toBe("Aider");
  });

  it("falls back to the id when no name is supplied", () => {
    expect(providerLabel("aider")).toBe("aider");
  });

  it("ignores an empty backend name for a known id", () => {
    expect(providerLabel("claude", "")).toBe("Claude Code");
  });
});

describe("placeholderProviders", () => {
  it("covers every provider in registry order", () => {
    expect(placeholderProviders().map((p) => p.id)).toEqual([...PROVIDER_IDS]);
  });

  it("renders as not installed while probing", () => {
    for (const p of placeholderProviders()) {
      expect(p.installed).toBe(false);
      expect(p.authenticated).toBe(false);
      expect(p.message).toBe("Checking…");
      expect(p.name).toBe(providerLabel(p.id));
    }
  });

  it("returns a fresh array each call so state stays isolated", () => {
    expect(placeholderProviders()).not.toBe(placeholderProviders());
  });
});
