import { describe, expect, it } from "vitest";
import {
  DEV_UPSTREAM_LIMITATIONS,
  formatOperatorLimitations,
} from "./operator-notes.js";

describe("operator-notes", () => {
  it("states Dev Upstream does not claim the Unblock Milestone", () => {
    const text = formatOperatorLimitations();
    expect(text).toMatch(/Dev Upstream/i);
    expect(text).toMatch(/Unblock Milestone/i);
    expect(text).toMatch(/does not defeat ISP Blocks/i);
  });

  it("documents WebRTC and non-browser proxy follow as known limits", () => {
    expect(DEV_UPSTREAM_LIMITATIONS.join("\n")).toMatch(/WebRTC/i);
    expect(DEV_UPSTREAM_LIMITATIONS.join("\n")).toMatch(/non-browser/i);
  });
});
