import type {
  LocalProxyAddress,
  ProxySettings,
  SystemProxyBinding,
  TunnelDriver,
  UpstreamEndpoint,
} from "../shield-session/ports.js";

const DEFAULT_LOCAL_PROXY: LocalProxyAddress = {
  host: "127.0.0.1",
  port: 1080,
};

export class StubTunnelDriver implements TunnelDriver {
  private exitHandler: (() => void | Promise<void>) | null = null;
  private running = false;

  async start(_endpoint: UpstreamEndpoint): Promise<LocalProxyAddress> {
    this.running = true;
    return { ...DEFAULT_LOCAL_PROXY };
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  onUnexpectedExit(handler: () => void | Promise<void>): void {
    this.exitHandler = handler;
  }

  async simulateExit(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    await this.exitHandler?.();
  }
}

export class StubSystemProxyBinding implements SystemProxyBinding {
  private current: ProxySettings | null = null;

  async apply(proxy: LocalProxyAddress): Promise<void> {
    this.current = { ...proxy };
  }

  async release(): Promise<void> {
    this.current = null;
  }

  async read(): Promise<ProxySettings | null> {
    return this.current ? { ...this.current } : null;
  }
}
