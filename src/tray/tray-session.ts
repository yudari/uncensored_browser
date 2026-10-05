import type { ShieldSessionController } from "../shield-session/controller.js";
import type { ArmResult, UpstreamEndpoint } from "../shield-session/ports.js";
import { EndpointStore, isDevUpstreamHost } from "./endpoint-store.js";

export type TraySessionDeps = {
  controller: ShieldSessionController;
  store: EndpointStore;
  simulateTunnelExit?: () => Promise<void>;
};

export class TraySession {
  private endpoint: UpstreamEndpoint | null = null;

  constructor(private readonly deps: TraySessionDeps) {}

  async hydrate(): Promise<void> {
    const loaded = await this.deps.store.load();
    if (!loaded) return;
    this.endpoint = loaded;
    if (this.deps.controller.status() === "disarmed") {
      this.deps.controller.configure(loaded);
    }
  }

  async saveEndpoint(endpoint: UpstreamEndpoint): Promise<void> {
    if (this.deps.controller.status() !== "disarmed") {
      throw new Error("configure only while disarmed");
    }
    await this.deps.store.save(endpoint);
    this.endpoint = endpoint;
    this.deps.controller.configure(endpoint);
  }

  async arm(): Promise<ArmResult> {
    return this.deps.controller.arm();
  }

  async disarm(): Promise<void> {
    await this.deps.controller.disarm();
  }

  async shutdown(): Promise<void> {
    await this.deps.controller.shutdown();
  }

  async checkBinding(): Promise<void> {
    await this.deps.controller.checkBinding();
  }

  canSimulateTunnelOutage(): boolean {
    return typeof this.deps.simulateTunnelExit === "function";
  }

  async simulateTunnelOutage(): Promise<void> {
    if (!this.deps.simulateTunnelExit) {
      throw new Error("Tunnel outage simulation is unavailable for this Tunnel Driver");
    }
    await this.deps.simulateTunnelExit();
  }

  statusLabel(): string {
    switch (this.deps.controller.status()) {
      case "armed":
        return "Shield Session armed";
      case "proxy_outage":
        return "Proxy Outage";
      default:
        return "Disarmed";
    }
  }

  endpointSummary(): string {
    if (!this.endpoint) return "No Upstream Endpoint configured";
    const kind = isDevUpstreamHost(this.endpoint.host)
      ? "Dev Upstream"
      : "Upstream";
    return `${kind}: ${this.endpoint.sshUser}@${this.endpoint.host}:${this.endpoint.sshPort}`;
  }

  currentEndpoint(): UpstreamEndpoint | null {
    return this.endpoint ? { ...this.endpoint } : null;
  }

  canConfigure(): boolean {
    return this.deps.controller.status() === "disarmed";
  }
}
