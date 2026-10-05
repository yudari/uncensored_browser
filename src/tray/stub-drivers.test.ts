import { describe, expect, it } from "vitest";
import { StubSystemProxyBinding, StubTunnelDriver } from "./stub-drivers.js";
import { validEndpoint } from "../shield-session/fakes.js";

describe("StubTunnelDriver", () => {
  it("starts a Local Proxy address without contacting a real Upstream", async () => {
    const tunnel = new StubTunnelDriver();
    const address = await tunnel.start(validEndpoint());
    expect(address).toEqual({ host: "127.0.0.1", port: 1080 });
  });

  it("notifies on simulated unexpected exit", async () => {
    const tunnel = new StubTunnelDriver();
    let exited = false;
    tunnel.onUnexpectedExit(() => {
      exited = true;
    });
    await tunnel.start(validEndpoint());
    await tunnel.simulateExit();
    expect(exited).toBe(true);
  });
});

describe("StubSystemProxyBinding", () => {
  it("applies and releases an in-memory Binding", async () => {
    const binding = new StubSystemProxyBinding();
    await binding.apply({ host: "127.0.0.1", port: 1080 });
    expect(await binding.read()).toEqual({ host: "127.0.0.1", port: 1080 });
    await binding.release();
    expect(await binding.read()).toBeNull();
  });
});
