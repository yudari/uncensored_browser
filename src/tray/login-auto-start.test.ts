import { describe, expect, it } from "vitest";
import { LoginAutoStart } from "./login-auto-start.js";

describe("LoginAutoStart", () => {
  it("reports and toggles open-at-login without Arming", () => {
    let enabled = false;
    const autoStart = new LoginAutoStart({
      isEnabled: () => enabled,
      setEnabled: (next) => {
        enabled = next;
      },
    });

    expect(autoStart.isEnabled()).toBe(false);
    autoStart.setEnabled(true);
    expect(enabled).toBe(true);
    expect(autoStart.isEnabled()).toBe(true);
    autoStart.setEnabled(false);
    expect(enabled).toBe(false);
  });
});
