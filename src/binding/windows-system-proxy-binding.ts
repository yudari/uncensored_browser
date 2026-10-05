import type {
  LocalProxyAddress,
  ProxySettings,
  SystemProxyBinding,
} from "../shield-session/ports.js";
import {
  formatSocksProxyServer,
  parseSocksProxyServer,
} from "./proxy-server-format.js";
import type {
  WindowsProxySettingsPort,
  WindowsProxySnapshot,
} from "./windows-proxy-settings-port.js";

const DISABLED_SNAPSHOT: WindowsProxySnapshot = {
  enabled: false,
  server: null,
  autoConfigUrl: null,
  proxyOverride: null,
};

export class WindowsSystemProxyBinding implements SystemProxyBinding {
  private previousSnapshot: WindowsProxySnapshot | null = null;

  constructor(private readonly settings: WindowsProxySettingsPort) {}

  async apply(proxy: LocalProxyAddress): Promise<void> {
    if (!this.previousSnapshot) {
      this.previousSnapshot = await this.settings.read();
    }
    await this.settings.write({
      enabled: true,
      server: formatSocksProxyServer(proxy),
      // Force Chromium onto the SOCKS Local Proxy (no PAC / no bypass list).
      autoConfigUrl: null,
      proxyOverride: null,
    });
  }

  async release(): Promise<void> {
    const restore = this.previousSnapshot ?? DISABLED_SNAPSHOT;
    this.previousSnapshot = null;
    await this.settings.write(restore);
  }

  async read(): Promise<ProxySettings | null> {
    const snapshot = await this.settings.read();
    return parseSocksProxyServer(snapshot.server, snapshot.enabled);
  }
}
