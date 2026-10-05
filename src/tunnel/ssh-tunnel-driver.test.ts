import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  SshTunnelDriver,
  buildSshArgs,
  type ChildProcessLike,
} from "./ssh-tunnel-driver.js";

function fakeChild(options?: {
  exitCode?: number | null;
  exitSignal?: NodeJS.Signals | null;
  emitError?: Error;
  autoExitMs?: number;
}): ChildProcessLike {
  const child = new EventEmitter() as ChildProcessLike;
  child.killed = false;
  child.exitCode = null;
  child.stderr = new EventEmitter() as ChildProcessLike["stderr"];
  child.kill = vi.fn(() => {
    child.killed = true;
    queueMicrotask(() => child.emit("exit", 0, null));
    return true;
  });

  if (options?.emitError) {
    queueMicrotask(() => child.emit("error", options.emitError));
  } else if (options?.autoExitMs !== undefined) {
    setTimeout(() => {
      child.stderr?.emit(
        "data",
        Buffer.from(
          "ssh: connect to host 127.0.0.1 port 22: Connection refused",
        ),
      );
      child.exitCode = options.exitCode ?? 255;
      child.emit("exit", options.exitCode ?? 255, options.exitSignal ?? null);
    }, options.autoExitMs);
  }

  return child;
}

describe("buildSshArgs", () => {
  it("builds ssh -D args for the Upstream Endpoint", () => {
    expect(
      buildSshArgs(
        {
          host: "127.0.0.1",
          sshUser: "op",
          operatorKeyPath: "C:\\Users\\op\\.ssh\\id_ed25519",
          sshPort: 22,
        },
        { host: "127.0.0.1", port: 1080 },
      ),
    ).toEqual([
      "-D",
      "127.0.0.1:1080",
      "-N",
      "-p",
      "22",
      "-i",
      "C:\\Users\\op\\.ssh\\id_ed25519",
      "-o",
      "BatchMode=yes",
      "-o",
      "ExitOnForwardFailure=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "op@127.0.0.1",
    ]);
  });
});

describe("SshTunnelDriver", () => {
  it("starts ssh -D and returns the Local Proxy address once the Local Proxy accepts connections", async () => {
    const child = fakeChild();
    const spawn = vi.fn(() => child);
    const probeLocalProxy = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const tunnel = new SshTunnelDriver({
      spawn,
      probeLocalProxy,
      probeIntervalMs: 5,
      readyTimeoutMs: 500,
    });

    const address = await tunnel.start({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    expect(address).toEqual({ host: "127.0.0.1", port: 1080 });
    expect(spawn).toHaveBeenCalledWith(
      "ssh",
      expect.arrayContaining(["-D", "127.0.0.1:1080", "op@127.0.0.1"]),
      expect.objectContaining({ stdio: ["ignore", "ignore", "pipe"] }),
    );
    expect(probeLocalProxy).toHaveBeenCalled();
  });

  it("fails clearly when the OpenSSH client is missing", async () => {
    const child = fakeChild({
      emitError: Object.assign(new Error("spawn ssh ENOENT"), {
        code: "ENOENT",
      }),
    });
    const tunnel = new SshTunnelDriver({
      spawn: () => child,
      probeLocalProxy: async () => false,
      probeIntervalMs: 5,
      readyTimeoutMs: 200,
    });

    await expect(
      tunnel.start({
        host: "127.0.0.1",
        sshUser: "op",
        operatorKeyPath: "C:\\key",
        sshPort: 22,
      }),
    ).rejects.toThrow(/OpenSSH client \(ssh\) was not found/i);
  });

  it("fails clearly when the process exits before the Local Proxy is ready", async () => {
    const child = fakeChild({ autoExitMs: 5, exitCode: 255 });
    const tunnel = new SshTunnelDriver({
      spawn: () => child,
      probeLocalProxy: async () => false,
      probeIntervalMs: 5,
      readyTimeoutMs: 300,
    });

    await expect(
      tunnel.start({
        host: "127.0.0.1",
        sshUser: "op",
        operatorKeyPath: "C:\\key",
        sshPort: 22,
      }),
    ).rejects.toThrow(/Dev Upstream|Upstream|Connection refused|ssh exited/i);
  });

  it("fails when the Local Proxy never accepts connections before timeout", async () => {
    const child = fakeChild();
    const tunnel = new SshTunnelDriver({
      spawn: () => child,
      probeLocalProxy: async () => false,
      probeIntervalMs: 5,
      readyTimeoutMs: 40,
    });

    await expect(
      tunnel.start({
        host: "127.0.0.1",
        sshUser: "op",
        operatorKeyPath: "C:\\key",
        sshPort: 22,
      }),
    ).rejects.toThrow(/Timed out waiting for Local Proxy/i);
    expect(child.kill).toHaveBeenCalled();
  });

  it("notifies on unexpected ssh process exit after start", async () => {
    const child = fakeChild();
    const tunnel = new SshTunnelDriver({
      spawn: () => child,
      probeLocalProxy: async () => true,
      readyTimeoutMs: 200,
    });
    let exited = false;
    tunnel.onUnexpectedExit(() => {
      exited = true;
    });

    await tunnel.start({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    child.emit("exit", 1, null);
    await Promise.resolve();

    expect(exited).toBe(true);
  });

  it("stops by killing the ssh child process", async () => {
    const child = fakeChild();
    const tunnel = new SshTunnelDriver({
      spawn: () => child,
      probeLocalProxy: async () => true,
      readyTimeoutMs: 200,
    });
    await tunnel.start({
      host: "127.0.0.1",
      sshUser: "op",
      operatorKeyPath: "C:\\key",
      sshPort: 22,
    });

    await tunnel.stop();

    expect(child.kill).toHaveBeenCalled();
  });
});
