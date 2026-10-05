import { describe, expect, it } from "vitest";
import { EndpointStore, isDevUpstreamHost } from "./endpoint-store.js";
import type { UpstreamEndpoint } from "../shield-session/ports.js";

const sample = (): UpstreamEndpoint => ({
  host: "127.0.0.1",
  sshUser: "operator",
  operatorKeyPath: "C:\\Users\\op\\.ssh\\id_ed25519",
  sshPort: 22,
});

describe("isDevUpstreamHost", () => {
  it("labels loopback hosts as Dev Upstream", () => {
    expect(isDevUpstreamHost("127.0.0.1")).toBe(true);
    expect(isDevUpstreamHost("localhost")).toBe(true);
    expect(isDevUpstreamHost("::1")).toBe(true);
  });

  it("does not label remote hosts as Dev Upstream", () => {
    expect(isDevUpstreamHost("vps.example.com")).toBe(false);
    expect(isDevUpstreamHost("203.0.113.10")).toBe(false);
  });
});

describe("EndpointStore", () => {
  it("returns null when no Upstream Endpoint has been saved", async () => {
    const store = new EndpointStore({
      read: async () => null,
      write: async () => undefined,
    });

    expect(await store.load()).toBeNull();
  });

  it("round-trips a saved Upstream Endpoint", async () => {
    let file: string | null = null;
    const store = new EndpointStore({
      read: async () => file,
      write: async (contents) => {
        file = contents;
      },
    });

    await store.save(sample());

    expect(await store.load()).toEqual(sample());
  });

  it("defaults sshPort to 22 when missing from stored JSON", async () => {
    const store = new EndpointStore({
      read: async () =>
        JSON.stringify({
          host: "127.0.0.1",
          sshUser: "op",
          operatorKeyPath: "C:\\key",
        }),
      write: async () => undefined,
    });

    expect(await store.load()).toEqual({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });
  });
});
