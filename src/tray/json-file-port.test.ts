import { describe, expect, it } from "vitest";
import { createJsonFilePort } from "./json-file-port.js";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("createJsonFilePort", () => {
  it("round-trips file contents on disk", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "ub-endpoint-"));
    const filePath = path.join(dir, "endpoint.json");
    const port = createJsonFilePort(filePath);

    expect(await port.read()).toBeNull();
    await port.write('{"host":"127.0.0.1"}');
    expect(await port.read()).toBe('{"host":"127.0.0.1"}');

    await rm(dir, { recursive: true, force: true });
  });
});
