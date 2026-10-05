import { describe, expect, it } from "vitest";
import { ShieldSessionController } from "../shield-session/controller.js";
import { FakeOperatorPrompt } from "../shield-session/fakes.js";
import { EndpointStore } from "./endpoint-store.js";
import { StubSystemProxyBinding, StubTunnelDriver } from "./stub-drivers.js";
import { TraySession } from "./tray-session.js";

function createTraySession() {
  let file: string | null = null;
  const store = new EndpointStore({
    read: async () => file,
    write: async (contents) => {
      file = contents;
    },
  });
  const tunnel = new StubTunnelDriver();
  const binding = new StubSystemProxyBinding();
  const prompt = new FakeOperatorPrompt();
  const controller = new ShieldSessionController({ tunnel, binding, prompt });
  const session = new TraySession({ controller, store, tunnel });
  return { session, tunnel, binding, prompt, store };
}

describe("TraySession", () => {
  it("saves Upstream Endpoint and configures the Shield Session while disarmed", async () => {
    const { session } = createTraySession();
    await session.saveEndpoint({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    expect(session.endpointSummary()).toContain("127.0.0.1");
    expect(session.endpointSummary()).toContain("Dev Upstream");
    expect(session.statusLabel()).toBe("Disarmed");
  });

  it("Arms and Disarms through the ShieldSessionController with stub drivers", async () => {
    const { session, binding } = createTraySession();
    await session.saveEndpoint({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    const armed = await session.arm();
    expect(armed).toEqual({ ok: true });
    expect(session.statusLabel()).toBe("Shield Session armed");
    expect(await binding.read()).toEqual({ host: "127.0.0.1", port: 1080 });

    await session.disarm();
    expect(session.statusLabel()).toBe("Disarmed");
    expect(await binding.read()).toBeNull();
  });

  it("surfaces Proxy Outage after a stub Tunnel exit", async () => {
    const { session, tunnel, prompt } = createTraySession();
    prompt.nextOutageChoice = "keep_fail_closed";
    await session.saveEndpoint({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });
    await session.arm();

    await tunnel.simulateExit();

    expect(session.statusLabel()).toBe("Proxy Outage");
  });

  it("rejects Arm when Upstream Endpoint is missing", async () => {
    const { session } = createTraySession();
    expect(await session.arm()).toEqual({
      ok: false,
      reason: "incomplete_endpoint",
    });
  });

  it("rejects saving Upstream Endpoint while a Shield Session is armed", async () => {
    const { session } = createTraySession();
    await session.saveEndpoint({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });
    await session.arm();

    await expect(
      session.saveEndpoint({
        host: "10.0.0.1",
        sshUser: "op",
        operatorKeyPath: "C:\\key",
        sshPort: 22,
      }),
    ).rejects.toThrow(/disarmed/);
    expect(session.endpointSummary()).toContain("127.0.0.1");
  });
});
