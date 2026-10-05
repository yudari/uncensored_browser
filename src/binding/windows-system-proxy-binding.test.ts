import { describe, expect, it } from "vitest";
import {
  formatSocksProxyServer,
  parseSocksProxyServer,
} from "./proxy-server-format.js";
import { WindowsSystemProxyBinding } from "./windows-system-proxy-binding.js";
import type {
  WindowsProxySettingsPort,
  WindowsProxySnapshot,
} from "./windows-proxy-settings-port.js";

class FakeWindowsProxyPort implements WindowsProxySettingsPort {
  snapshot: WindowsProxySnapshot = {
    enabled: false,
    server: null,
    autoConfigUrl: null,
    proxyOverride: null,
  };
  writes: WindowsProxySnapshot[] = [];

  async read(): Promise<WindowsProxySnapshot> {
    return { ...this.snapshot };
  }

  async write(snapshot: WindowsProxySnapshot): Promise<void> {
    this.writes.push({ ...snapshot });
    this.snapshot = { ...snapshot };
  }
}

describe("proxy-server-format", () => {
  it("formats a SOCKS ProxyServer value for Windows Internet Settings", () => {
    expect(formatSocksProxyServer({ host: "127.0.0.1", port: 1080 })).toBe(
      "socks=127.0.0.1:1080",
    );
  });

  it("parses socks= and socks5:// ProxyServer values when enabled", () => {
    expect(parseSocksProxyServer("socks=127.0.0.1:1080", true)).toEqual({
      host: "127.0.0.1",
      port: 1080,
    });
    expect(parseSocksProxyServer("socks5://127.0.0.1:1080", true)).toEqual({
      host: "127.0.0.1",
      port: 1080,
    });
    expect(parseSocksProxyServer("socks=127.0.0.1:1080", false)).toBeNull();
    expect(parseSocksProxyServer("http=127.0.0.1:8080", true)).toBeNull();
  });
});

describe("WindowsSystemProxyBinding", () => {
  it("applies SOCKS Binding and clears PAC plus ProxyOverride", async () => {
    const port = new FakeWindowsProxyPort();
    port.snapshot = {
      enabled: true,
      server: "http=10.0.0.1:8080",
      autoConfigUrl: "http://pac.example/proxy.pac",
      proxyOverride: "<local>;*.intranet",
    };
    const binding = new WindowsSystemProxyBinding(port);

    await binding.apply({ host: "127.0.0.1", port: 1080 });

    expect(port.snapshot).toEqual({
      enabled: true,
      server: "socks=127.0.0.1:1080",
      autoConfigUrl: null,
      proxyOverride: null,
    });
    expect(await binding.read()).toEqual({ host: "127.0.0.1", port: 1080 });
  });

  it("restores the previous Windows proxy snapshot on release", async () => {
    const port = new FakeWindowsProxyPort();
    port.snapshot = {
      enabled: true,
      server: "http=10.0.0.1:8080",
      autoConfigUrl: "http://pac.example/proxy.pac",
      proxyOverride: "<local>",
    };
    const binding = new WindowsSystemProxyBinding(port);

    await binding.apply({ host: "127.0.0.1", port: 1080 });
    await binding.release();

    expect(port.snapshot).toEqual({
      enabled: true,
      server: "http=10.0.0.1:8080",
      autoConfigUrl: "http://pac.example/proxy.pac",
      proxyOverride: "<local>",
    });
    expect(await binding.read()).toBeNull();
  });

  it("disables proxy on release when there was no previous proxy", async () => {
    const port = new FakeWindowsProxyPort();
    const binding = new WindowsSystemProxyBinding(port);

    await binding.apply({ host: "127.0.0.1", port: 1080 });
    await binding.release();

    expect(port.snapshot).toEqual({
      enabled: false,
      server: null,
      autoConfigUrl: null,
      proxyOverride: null,
    });
  });

  it("re-applying while already bound refreshes SOCKS without losing restore state", async () => {
    const port = new FakeWindowsProxyPort();
    const binding = new WindowsSystemProxyBinding(port);

    await binding.apply({ host: "127.0.0.1", port: 1080 });
    await binding.apply({ host: "127.0.0.1", port: 1080 });
    await binding.release();

    expect(port.snapshot).toEqual({
      enabled: false,
      server: null,
      autoConfigUrl: null,
      proxyOverride: null,
    });
  });
});
