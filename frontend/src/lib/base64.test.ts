import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "./base64";

describe("base64 bridge", () => {
  it("round-trips ascii", () => {
    expect(decodeBase64(encodeBase64("ls -la\r"))).toBe("ls -la\r");
  });

  it("round-trips multi-byte utf-8", () => {
    const input = "héllo ▸ 世界 🌲";
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it("round-trips ansi control sequences", () => {
    const input = "[90m[process exited][0m\r\n";
    expect(decodeBase64(encodeBase64(input))).toBe(input);
  });

  it("handles the empty string", () => {
    expect(encodeBase64("")).toBe("");
    expect(decodeBase64("")).toBe("");
  });
});
