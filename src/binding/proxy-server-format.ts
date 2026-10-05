import type { LocalProxyAddress } from "../shield-session/ports.js";

export function formatSocksProxyServer(address: LocalProxyAddress): string {
  return `socks=${address.host}:${address.port}`;
}

export function parseSocksProxyServer(
  server: string | null,
  enabled: boolean,
): LocalProxyAddress | null {
  if (!enabled || !server) return null;
  const trimmed = server.trim();

  const socksEquals = /^socks(?:5)?=([^:\s]+):(\d+)\s*$/i.exec(trimmed);
  if (socksEquals) {
    const host = socksEquals[1];
    const port = Number(socksEquals[2]);
    if (!host || !Number.isFinite(port)) return null;
    return { host, port };
  }

  const socksUrl = /^socks5?:\/\/([^:/]+):(\d+)\s*$/i.exec(trimmed);
  if (socksUrl) {
    const host = socksUrl[1];
    const port = Number(socksUrl[2]);
    if (!host || !Number.isFinite(port)) return null;
    return { host, port };
  }

  return null;
}
