import { spawn as defaultSpawn } from "node:child_process";
import { EventEmitter } from "node:events";
import net from "node:net";
import type {
  LocalProxyAddress,
  TunnelDriver,
  UpstreamEndpoint,
} from "../shield-session/ports.js";

export type ChildProcessLike = EventEmitter & {
  killed: boolean;
  exitCode: number | null;
  stderr: EventEmitter | null;
  kill: (signal?: NodeJS.Signals | number) => boolean;
};

export type SpawnFn = (
  command: string,
  args: readonly string[],
  options: {
    stdio: ["ignore", "ignore", "pipe"];
    windowsHide: boolean;
  },
) => ChildProcessLike;

export type LocalProxyProbe = (address: LocalProxyAddress) => Promise<boolean>;

const DEFAULT_LOCAL_PROXY: LocalProxyAddress = {
  host: "127.0.0.1",
  port: 1080,
};

export function buildSshArgs(
  endpoint: UpstreamEndpoint,
  localProxy: LocalProxyAddress,
): string[] {
  return [
    "-D",
    `${localProxy.host}:${localProxy.port}`,
    "-N",
    "-p",
    String(endpoint.sshPort),
    "-i",
    endpoint.operatorKeyPath,
    "-o",
    "BatchMode=yes",
    "-o",
    "ExitOnForwardFailure=yes",
    "-o",
    "StrictHostKeyChecking=accept-new",
    `${endpoint.sshUser}@${endpoint.host}`,
  ];
}

export async function probeTcpLocalProxy(
  address: LocalProxyAddress,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect(
      { host: address.host, port: address.port },
      () => {
        socket.destroy();
        resolve(true);
      },
    );
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function nodeSpawnAdapter(
  command: string,
  args: readonly string[],
  options: {
    stdio: ["ignore", "ignore", "pipe"];
    windowsHide: boolean;
  },
): ChildProcessLike {
  const child = defaultSpawn(command, [...args], {
    stdio: options.stdio,
    windowsHide: options.windowsHide,
  });
  return child as unknown as ChildProcessLike;
}

export type SshTunnelDriverOptions = {
  spawn?: SpawnFn;
  localProxy?: LocalProxyAddress;
  sshCommand?: string;
  readyTimeoutMs?: number;
  probeLocalProxy?: LocalProxyProbe;
  probeIntervalMs?: number;
};

export class SshTunnelDriver implements TunnelDriver {
  private readonly spawn: SpawnFn;
  private readonly localProxy: LocalProxyAddress;
  private readonly sshCommand: string;
  private readonly readyTimeoutMs: number;
  private readonly probeLocalProxy: LocalProxyProbe;
  private readonly probeIntervalMs: number;
  private child: ChildProcessLike | null = null;
  private exitHandler: (() => void | Promise<void>) | null = null;
  private stopping = false;
  private stderrBuffer = "";

  constructor(options: SshTunnelDriverOptions = {}) {
    this.spawn = options.spawn ?? nodeSpawnAdapter;
    this.localProxy = options.localProxy ?? { ...DEFAULT_LOCAL_PROXY };
    this.sshCommand = options.sshCommand ?? "ssh";
    this.readyTimeoutMs = options.readyTimeoutMs ?? 15_000;
    this.probeLocalProxy = options.probeLocalProxy ?? probeTcpLocalProxy;
    this.probeIntervalMs = options.probeIntervalMs ?? 100;
  }

  onUnexpectedExit(handler: () => void | Promise<void>): void {
    this.exitHandler = handler;
  }

  async start(endpoint: UpstreamEndpoint): Promise<LocalProxyAddress> {
    if (this.child) {
      throw new Error("Tunnel is already running");
    }

    this.stopping = false;
    this.stderrBuffer = "";
    const args = buildSshArgs(endpoint, this.localProxy);

    let child: ChildProcessLike;
    try {
      child = this.spawn(this.sshCommand, args, {
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      throw this.mapSpawnError(error);
    }

    this.child = child;
    child.stderr?.on("data", (chunk: Buffer | string) => {
      this.stderrBuffer += chunk.toString();
    });

    const earlyExit: {
      current: { code: number | null; signal: NodeJS.Signals | null } | null;
    } = { current: null };

    const onError = (error: Error) => {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        this.stderrBuffer = error.message;
      } else {
        this.stderrBuffer ||= error.message;
      }
      earlyExit.current = { code: null, signal: null };
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      earlyExit.current = { code, signal };
    };
    child.once("error", onError);
    child.once("exit", onExit);

    try {
      await this.waitUntilReady(child, () => earlyExit.current);
    } catch (error) {
      this.child = null;
      child.off("error", onError);
      child.off("exit", onExit);
      if (!child.killed) {
        child.kill();
      }
      if (earlyExit.current) {
        throw this.mapExitError(
          earlyExit.current.code,
          earlyExit.current.signal,
        );
      }
      throw error;
    }

    child.off("error", onError);
    child.off("exit", onExit);

    child.once("exit", () => {
      this.child = null;
      if (!this.stopping) {
        void this.exitHandler?.();
      }
    });
    child.once("error", (error: Error) => {
      this.stderrBuffer ||= error.message;
      if (this.child === child) {
        this.child = null;
        if (!this.stopping) {
          void this.exitHandler?.();
        }
      }
    });

    return { ...this.localProxy };
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    this.child = null;

    await new Promise<void>((resolve) => {
      const done = () => resolve();
      child.once("exit", done);
      if (!child.killed) {
        child.kill();
      }
      setTimeout(done, 1000);
    });
  }

  private async waitUntilReady(
    child: ChildProcessLike,
    getEarlyExit: () => {
      code: number | null;
      signal: NodeJS.Signals | null;
    } | null,
  ): Promise<void> {
    const deadline = Date.now() + this.readyTimeoutMs;

    while (Date.now() < deadline) {
      const exited = getEarlyExit();
      if (exited) {
        throw this.mapExitError(exited.code, exited.signal);
      }
      if (await this.probeLocalProxy(this.localProxy)) {
        return;
      }
      await sleep(this.probeIntervalMs);
    }

    throw new Error(
      "Timed out waiting for Local Proxy (ssh -D) to accept connections. Check OpenSSH client, Operator Key, and Dev Upstream / Upstream reachability.",
    );
  }

  private mapSpawnError(error: unknown): Error {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return new Error(
        "OpenSSH client (ssh) was not found. Install the Windows OpenSSH Client optional feature.",
      );
    }
    return error instanceof Error
      ? error
      : new Error("Failed to start OpenSSH Tunnel");
  }

  private mapExitError(
    code: number | null,
    signal: NodeJS.Signals | null,
  ): Error {
    const detail = this.stderrBuffer.trim();
    const suffix = detail ? ` ${detail}` : "";
    if (
      /connection refused|no route to host|timed out|permission denied|could not resolve/i.test(
        detail,
      )
    ) {
      return new Error(
        `Could not reach Dev Upstream / Upstream over SSH.${suffix}`,
      );
    }
    if (/ENOENT|not found/i.test(detail)) {
      return new Error(
        "OpenSSH client (ssh) was not found. Install the Windows OpenSSH Client optional feature.",
      );
    }
    return new Error(
      `ssh exited before the Tunnel was ready (code=${code ?? "none"}, signal=${signal ?? "none"}).${suffix}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
