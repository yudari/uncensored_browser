import type {
  ArmResult,
  LocalProxyAddress,
  OperatorPrompt,
  SessionStatus,
  SystemProxyBinding,
  TunnelDriver,
  UpstreamEndpoint,
} from "./ports.js";

export type ShieldSessionDeps = {
  tunnel: TunnelDriver;
  binding: SystemProxyBinding;
  prompt: OperatorPrompt;
};

function isCompleteEndpoint(
  endpoint: UpstreamEndpoint | null,
): endpoint is UpstreamEndpoint {
  if (!endpoint) return false;
  return (
    endpoint.host.trim() !== "" &&
    endpoint.sshUser.trim() !== "" &&
    endpoint.operatorKeyPath.trim() !== "" &&
    Number.isFinite(endpoint.sshPort) &&
    endpoint.sshPort > 0
  );
}

export class ShieldSessionController {
  private endpoint: UpstreamEndpoint | null = null;
  private sessionStatus: SessionStatus = "disarmed";
  private expectedBinding: LocalProxyAddress | null = null;
  private arming = false;

  constructor(private readonly deps: ShieldSessionDeps) {
    this.deps.tunnel.onUnexpectedExit(() => this.handleUnexpectedTunnelExit());
  }

  configure(endpoint: UpstreamEndpoint): void {
    if (this.sessionStatus !== "disarmed") {
      throw new Error("configure only while disarmed");
    }
    this.endpoint = {
      ...endpoint,
      sshPort: endpoint.sshPort > 0 ? endpoint.sshPort : 22,
    };
  }

  status(): SessionStatus {
    return this.sessionStatus;
  }

  async arm(): Promise<ArmResult> {
    if (!isCompleteEndpoint(this.endpoint)) {
      return { ok: false, reason: "incomplete_endpoint" };
    }
    if (this.sessionStatus === "armed") {
      return { ok: true };
    }

    const recoveringFromOutage = this.sessionStatus === "proxy_outage";
    this.arming = true;
    let started = false;
    try {
      const address = await this.deps.tunnel.start(this.endpoint);
      started = true;
      this.expectedBinding = address;
      if (!recoveringFromOutage) {
        await this.deps.binding.apply(address);
      }
      this.sessionStatus = "armed";
      return { ok: true };
    } catch (error) {
      if (!recoveringFromOutage) {
        this.expectedBinding = null;
        this.sessionStatus = "disarmed";
      }
      if (started) {
        try {
          await this.deps.tunnel.stop();
        } catch {
          // Best-effort cleanup after failed Arm.
        }
      }
      return {
        ok: false,
        reason: "tunnel_failed",
        message:
          error instanceof Error ? error.message : "Tunnel failed to start",
      };
    } finally {
      this.arming = false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.sessionStatus === "disarmed") return;
    await this.disarm();
  }

  async disarm(): Promise<void> {
    try {
      await this.deps.binding.release();
    } finally {
      this.expectedBinding = null;
      this.sessionStatus = "disarmed";
      try {
        await this.deps.tunnel.stop();
      } catch {
        // Binding already released; Tunnel stop is best-effort.
      }
    }
  }

  async respondToOutage(choice: "keep_fail_closed" | "release_binding"): Promise<void> {
    if (this.sessionStatus !== "proxy_outage") return;
    if (choice === "keep_fail_closed") return;
    await this.disarm();
  }

  async checkBinding(): Promise<void> {
    if (this.sessionStatus !== "armed" || !this.expectedBinding) return;

    const current = await this.deps.binding.read();
    const expected = this.expectedBinding;
    const drifted =
      !current ||
      current.host !== expected.host ||
      current.port !== expected.port;

    if (!drifted) return;

    try {
      await this.deps.binding.apply(expected);
    } catch {
      await this.disarm();
      await this.deps.prompt.notify(
        "System Proxy Binding could not be restored; Shield Session disarmed.",
      );
    }
  }

  private async handleUnexpectedTunnelExit(): Promise<void> {
    if (this.arming) return;
    if (this.sessionStatus !== "armed") return;

    this.sessionStatus = "proxy_outage";
    const choice = await this.deps.prompt.promptOutage();
    await this.respondToOutage(choice);
  }
}
