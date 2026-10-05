import type {
  LocalProxyAddress,
  OperatorPrompt,
  OutageChoice,
  ProxySettings,
  SystemProxyBinding,
  TunnelDriver,
  UpstreamEndpoint,
} from "./ports.js";

export class FakeTunnelDriver implements TunnelDriver {
  readonly starts: UpstreamEndpoint[] = [];
  readonly stops: number[] = [];
  failNextStart: Error | null = null;
  private exitHandler: (() => void | Promise<void>) | null = null;
  private running = false;
  address: LocalProxyAddress = { host: "127.0.0.1", port: 1080 };

  async start(endpoint: UpstreamEndpoint): Promise<LocalProxyAddress> {
    this.starts.push(endpoint);
    if (this.failNextStart) {
      const error = this.failNextStart;
      this.failNextStart = null;
      throw error;
    }
    this.running = true;
    return this.address;
  }

  async stop(): Promise<void> {
    this.stops.push(this.stops.length + 1);
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

export class FakeSystemProxyBinding implements SystemProxyBinding {
  readonly applied: LocalProxyAddress[] = [];
  readonly released: number[] = [];
  current: ProxySettings | null = null;
  failNextApply = false;

  async apply(proxy: LocalProxyAddress): Promise<void> {
    if (this.failNextApply) {
      this.failNextApply = false;
      throw new Error("apply failed");
    }
    this.applied.push(proxy);
    this.current = { ...proxy };
  }

  async release(): Promise<void> {
    this.released.push(this.released.length + 1);
    this.current = null;
  }

  async read(): Promise<ProxySettings | null> {
    return this.current ? { ...this.current } : null;
  }

  drift(): void {
    this.current = { host: "9.9.9.9", port: 9999 };
  }
}

/** Binding double that can fail restore independently of apply used at Arm. */
export class RestorableFakeBinding implements SystemProxyBinding {
  readonly applied: LocalProxyAddress[] = [];
  readonly released: number[] = [];
  current: ProxySettings | null = null;
  private restoreFailuresLeft = 0;

  failNextRestores(count: number): void {
    this.restoreFailuresLeft = count;
  }

  async apply(proxy: LocalProxyAddress): Promise<void> {
    if (this.restoreFailuresLeft > 0 && this.current !== null) {
      this.restoreFailuresLeft -= 1;
      throw new Error("restore failed");
    }
    this.applied.push(proxy);
    this.current = { ...proxy };
  }

  async release(): Promise<void> {
    this.released.push(this.released.length + 1);
    this.current = null;
  }

  async read(): Promise<ProxySettings | null> {
    return this.current ? { ...this.current } : null;
  }

  drift(): void {
    this.current = { host: "9.9.9.9", port: 9999 };
  }
}

export class FakeOperatorPrompt implements OperatorPrompt {
  readonly outagePrompts: number[] = [];
  readonly notifications: string[] = [];
  nextOutageChoice: OutageChoice = "keep_fail_closed";

  async promptOutage(): Promise<OutageChoice> {
    this.outagePrompts.push(this.outagePrompts.length + 1);
    return this.nextOutageChoice;
  }

  async notify(message: string): Promise<void> {
    this.notifications.push(message);
  }
}

export const validEndpoint = (): UpstreamEndpoint => ({
  host: "127.0.0.1",
  sshUser: "operator",
  operatorKeyPath: "C:\\Users\\op\\.ssh\\id_ed25519",
  sshPort: 22,
});
