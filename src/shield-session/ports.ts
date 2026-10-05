export type UpstreamEndpoint = {
  host: string;
  sshUser: string;
  operatorKeyPath: string;
  sshPort: number;
};

export type LocalProxyAddress = {
  host: string;
  port: number;
};

export type SessionStatus = "disarmed" | "armed" | "proxy_outage";

export type ArmResult =
  | { ok: true }
  | { ok: false; reason: "incomplete_endpoint" | "tunnel_failed" };

export type OutageChoice = "keep_fail_closed" | "release_binding";

export type ProxySettings = LocalProxyAddress;

export interface TunnelDriver {
  start(endpoint: UpstreamEndpoint): Promise<LocalProxyAddress>;
  stop(): Promise<void>;
  onUnexpectedExit(handler: () => void | Promise<void>): void;
}

export interface SystemProxyBinding {
  apply(proxy: LocalProxyAddress): Promise<void>;
  release(): Promise<void>;
  read(): Promise<ProxySettings | null>;
}

export interface OperatorPrompt {
  promptOutage(): Promise<OutageChoice>;
  notify(message: string): Promise<void>;
}
