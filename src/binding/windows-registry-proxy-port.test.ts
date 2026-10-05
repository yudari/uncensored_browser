import { describe, expect, it, vi } from "vitest";
import { createWindowsRegistryProxyPort } from "./windows-registry-proxy-port.js";

describe("createWindowsRegistryProxyPort", () => {
  it("reads ProxyEnable, ProxyServer, AutoConfigURL, and ProxyOverride", async () => {
    const runPowerShell = vi.fn(async (_script: string) =>
      JSON.stringify({
        enabled: true,
        server: "socks=127.0.0.1:1080",
        autoConfigUrl: null,
        proxyOverride: null,
      }),
    );
    const port = createWindowsRegistryProxyPort(runPowerShell);

    await expect(port.read()).resolves.toEqual({
      enabled: true,
      server: "socks=127.0.0.1:1080",
      autoConfigUrl: null,
      proxyOverride: null,
    });
    expect(runPowerShell).toHaveBeenCalledOnce();
  });

  it("writes SOCKS settings, clears PAC fields, and refreshes WinINet", async () => {
    const runPowerShell = vi.fn(async (_script: string) => "");
    const port = createWindowsRegistryProxyPort(runPowerShell);

    await port.write({
      enabled: true,
      server: "socks=127.0.0.1:1080",
      autoConfigUrl: null,
      proxyOverride: null,
    });

    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("ProxyEnable -Value 1"),
    );
    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("socks=127.0.0.1:1080"),
    );
    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("AutoConfigURL"),
    );
    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("ProxyOverride"),
    );
    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("InternetSetOption"),
    );
  });

  it("clears ProxyServer when writing a disabled snapshot", async () => {
    const runPowerShell = vi.fn(async (_script: string) => "");
    const port = createWindowsRegistryProxyPort(runPowerShell);

    await port.write({
      enabled: false,
      server: null,
      autoConfigUrl: null,
      proxyOverride: null,
    });

    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("ProxyEnable -Value 0"),
    );
    expect(runPowerShell).toHaveBeenCalledWith(
      expect.stringContaining("Remove-ItemProperty"),
    );
  });
});
