import { describe, expect, it } from "vitest";
import {
  LoginAutoStartPreference,
  resolveLoginAutoStartEnabled,
} from "./login-auto-start-preference.js";

describe("resolveLoginAutoStartEnabled", () => {
  it("defaults to enabled when the Operator has never chosen", () => {
    expect(resolveLoginAutoStartEnabled(null)).toBe(true);
  });

  it("honors an explicit Operator choice", () => {
    expect(resolveLoginAutoStartEnabled({ enabled: false })).toBe(false);
    expect(resolveLoginAutoStartEnabled({ enabled: true })).toBe(true);
  });
});

describe("LoginAutoStartPreference", () => {
  it("persists the Operator choice", async () => {
    let file: string | null = null;
    const prefs = new LoginAutoStartPreference({
      read: async () => file,
      write: async (contents) => {
        file = contents;
      },
    });

    expect(await prefs.loadEnabled()).toBe(true);
    await prefs.saveEnabled(false);
    expect(await prefs.loadEnabled()).toBe(false);
    expect(file).toContain("false");
  });
});
