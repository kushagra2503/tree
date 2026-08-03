import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("uses the message of a real Error", () => {
    expect(errorMessage(new Error("claude is not installed"))).toBe("claude is not installed");
  });

  it("stringifies non-Error rejections", () => {
    // Wails surfaces backend failures as plain strings.
    expect(errorMessage("choose a project folder")).toBe("choose a project folder");
    expect(errorMessage(undefined)).toBe("undefined");
  });
});
