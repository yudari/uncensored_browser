import type { UpstreamEndpoint } from "../shield-session/ports.js";

export type EndpointFilePort = {
  read(): Promise<string | null>;
  write(contents: string): Promise<void>;
};

export function isDevUpstreamHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1"
  );
}

function parseEndpoint(raw: unknown): UpstreamEndpoint | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.host !== "string" ||
    typeof value.sshUser !== "string" ||
    typeof value.operatorKeyPath !== "string"
  ) {
    return null;
  }
  const sshPort =
    typeof value.sshPort === "number" && value.sshPort > 0 ? value.sshPort : 22;
  return {
    host: value.host,
    sshUser: value.sshUser,
    operatorKeyPath: value.operatorKeyPath,
    sshPort,
  };
}

export class EndpointStore {
  constructor(private readonly file: EndpointFilePort) {}

  async load(): Promise<UpstreamEndpoint | null> {
    const contents = await this.file.read();
    if (!contents) return null;
    try {
      return parseEndpoint(JSON.parse(contents));
    } catch {
      return null;
    }
  }

  async save(endpoint: UpstreamEndpoint): Promise<void> {
    await this.file.write(JSON.stringify(endpoint, null, 2));
  }
}
