import { describe, expect, it } from "vitest";
import {
  FakeOperatorPrompt,
  FakeSystemProxyBinding,
  FakeTunnelDriver,
  RestorableFakeBinding,
  validEndpoint,
} from "./fakes.js";
import { ShieldSessionController } from "./controller.js";
import type {
  OperatorPrompt,
  SystemProxyBinding,
  TunnelDriver,
} from "./ports.js";

function createHarness() {
  const tunnel = new FakeTunnelDriver();
  const binding = new FakeSystemProxyBinding();
  const prompt = new FakeOperatorPrompt();
  const controller = new ShieldSessionController({ tunnel, binding, prompt });
  return { tunnel, binding, prompt, controller };
}

function createController(deps: {
  tunnel: TunnelDriver;
  binding: SystemProxyBinding;
  prompt?: OperatorPrompt;
}) {
  const prompt = deps.prompt ?? new FakeOperatorPrompt();
  return {
    tunnel: deps.tunnel,
    binding: deps.binding,
    prompt,
    controller: new ShieldSessionController({
      tunnel: deps.tunnel,
      binding: deps.binding,
      prompt,
    }),
  };
}

describe("ShieldSessionController", () => {
  it("arms by starting the Tunnel before applying System Proxy Binding", async () => {
    const events: string[] = [];
    const tunnel = new FakeTunnelDriver();
    const binding = new FakeSystemProxyBinding();
    const orderedTunnel: TunnelDriver = {
      start: async (endpoint) => {
        events.push("tunnel:start");
        return tunnel.start(endpoint);
      },
      stop: async () => tunnel.stop(),
      onUnexpectedExit: (handler) => tunnel.onUnexpectedExit(handler),
    };
    const orderedBinding: SystemProxyBinding = {
      apply: async (proxy) => {
        events.push("binding:apply");
        return binding.apply(proxy);
      },
      release: async () => binding.release(),
      read: async () => binding.read(),
    };
    const { controller } = createController({
      tunnel: orderedTunnel,
      binding: orderedBinding,
    });
    controller.configure(validEndpoint());

    const result = await controller.arm();

    expect(result).toEqual({ ok: true });
    expect(controller.status()).toBe("armed");
    expect(events).toEqual(["tunnel:start", "binding:apply"]);
  });

  it("rejects Arm when Upstream Endpoint is incomplete", async () => {
    const { tunnel, binding, controller } = createHarness();
    controller.configure({
      host: "",
      sshUser: "operator",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    const result = await controller.arm();

    expect(result).toEqual({ ok: false, reason: "incomplete_endpoint" });
    expect(controller.status()).toBe("disarmed");
    expect(tunnel.starts).toHaveLength(0);
    expect(binding.applied).toHaveLength(0);
  });

  it("rejects Arm when no Upstream Endpoint was configured", async () => {
    const { tunnel, binding, controller } = createHarness();

    const result = await controller.arm();

    expect(result).toEqual({ ok: false, reason: "incomplete_endpoint" });
    expect(tunnel.starts).toHaveLength(0);
    expect(binding.applied).toHaveLength(0);
  });

  it("does not apply System Proxy Binding when Tunnel start fails", async () => {
    const { tunnel, binding, controller } = createHarness();
    tunnel.failNextStart = new Error("ssh missing");
    controller.configure(validEndpoint());

    const result = await controller.arm();

    expect(result).toEqual({ ok: false, reason: "tunnel_failed" });
    expect(controller.status()).toBe("disarmed");
    expect(binding.applied).toHaveLength(0);
  });

  it("disarms by releasing System Proxy Binding before stopping the Tunnel", async () => {
    const events: string[] = [];
    const tunnel = new FakeTunnelDriver();
    const binding = new FakeSystemProxyBinding();
    const orderedTunnel: TunnelDriver = {
      start: async (endpoint) => tunnel.start(endpoint),
      stop: async () => {
        events.push("tunnel:stop");
        return tunnel.stop();
      },
      onUnexpectedExit: (handler) => tunnel.onUnexpectedExit(handler),
    };
    const orderedBinding: SystemProxyBinding = {
      apply: async (proxy) => binding.apply(proxy),
      release: async () => {
        events.push("binding:release");
        return binding.release();
      },
      read: async () => binding.read(),
    };
    const { controller } = createController({
      tunnel: orderedTunnel,
      binding: orderedBinding,
    });
    controller.configure(validEndpoint());
    await controller.arm();

    await controller.disarm();

    expect(controller.status()).toBe("disarmed");
    expect(events).toEqual(["binding:release", "tunnel:stop"]);
  });

  it("still releases System Proxy Binding when Tunnel stop fails during Disarm", async () => {
    const tunnel = new FakeTunnelDriver();
    const binding = new FakeSystemProxyBinding();
    const flakyTunnel: TunnelDriver = {
      start: async (endpoint) => tunnel.start(endpoint),
      stop: async () => {
        throw new Error("stop failed");
      },
      onUnexpectedExit: (handler) => tunnel.onUnexpectedExit(handler),
    };
    const { controller } = createController({ tunnel: flakyTunnel, binding });
    controller.configure(validEndpoint());
    await controller.arm();

    await expect(controller.disarm()).resolves.toBeUndefined();
    expect(binding.current).toBeNull();
    expect(controller.status()).toBe("disarmed");
  });

  it("treats unexpected Tunnel exit as Proxy Outage and prompts the Operator", async () => {
    const tunnel = new FakeTunnelDriver();
    const prompt = new FakeOperatorPrompt();
    prompt.nextOutageChoice = "keep_fail_closed";
    const binding = new FakeSystemProxyBinding();
    const { controller } = createController({ tunnel, binding, prompt });
    controller.configure(validEndpoint());
    await controller.arm();

    await tunnel.simulateExit();

    expect(controller.status()).toBe("proxy_outage");
    expect(prompt.outagePrompts).toHaveLength(1);
    expect(binding.current).toEqual({ host: "127.0.0.1", port: 1080 });
  });

  it("ends the Shield Session when Operator releases Binding on Proxy Outage", async () => {
    const tunnel = new FakeTunnelDriver();
    const prompt = new FakeOperatorPrompt();
    prompt.nextOutageChoice = "release_binding";
    const binding = new FakeSystemProxyBinding();
    const { controller } = createController({ tunnel, binding, prompt });
    controller.configure(validEndpoint());
    await controller.arm();

    await tunnel.simulateExit();

    expect(controller.status()).toBe("disarmed");
    expect(binding.current).toBeNull();
  });

  it("restores System Proxy Binding when Binding Guard detects drift", async () => {
    const binding = new FakeSystemProxyBinding();
    const { controller } = createController({
      tunnel: new FakeTunnelDriver(),
      binding,
    });
    controller.configure(validEndpoint());
    await controller.arm();
    binding.drift();

    await controller.checkBinding();

    expect(binding.current).toEqual({ host: "127.0.0.1", port: 1080 });
    expect(controller.status()).toBe("armed");
  });

  it("Disarms and notifies when Binding Guard cannot restore Binding", async () => {
    const binding = new RestorableFakeBinding();
    const prompt = new FakeOperatorPrompt();
    const { controller } = createController({
      tunnel: new FakeTunnelDriver(),
      binding,
      prompt,
    });
    controller.configure(validEndpoint());
    await controller.arm();
    binding.failNextRestores(1);
    binding.drift();

    await controller.checkBinding();

    expect(controller.status()).toBe("disarmed");
    expect(binding.current).toBeNull();
    expect(prompt.notifications).toHaveLength(1);
  });

  it("restarts the Tunnel when Arming from Proxy Outage", async () => {
    const tunnel = new FakeTunnelDriver();
    const prompt = new FakeOperatorPrompt();
    prompt.nextOutageChoice = "keep_fail_closed";
    const binding = new FakeSystemProxyBinding();
    const { controller } = createController({ tunnel, binding, prompt });
    controller.configure(validEndpoint());
    await controller.arm();
    await tunnel.simulateExit();
    expect(controller.status()).toBe("proxy_outage");
    const startsBefore = tunnel.starts.length;

    const result = await controller.arm();

    expect(result).toEqual({ ok: true });
    expect(controller.status()).toBe("armed");
    expect(tunnel.starts.length).toBe(startsBefore + 1);
    expect(binding.current).toEqual({ host: "127.0.0.1", port: 1080 });
  });

  it("Disarms when shutting down while armed", async () => {
    const { binding, tunnel, controller } = createHarness();
    controller.configure(validEndpoint());
    await controller.arm();

    await controller.shutdown();

    expect(controller.status()).toBe("disarmed");
    expect(binding.current).toBeNull();
    expect(tunnel.stops).toHaveLength(1);
  });
});
