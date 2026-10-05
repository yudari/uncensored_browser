import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  WindowsProxySettingsPort,
  WindowsProxySnapshot,
} from "./windows-proxy-settings-port.js";

const execFileAsync = promisify(execFile);

const INTERNET_SETTINGS =
  "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";

/** WinINet: INTERNET_OPTION_SETTINGS_CHANGED / INTERNET_OPTION_REFRESH */
const INTERNET_OPTION_SETTINGS_CHANGED = 39;
const INTERNET_OPTION_REFRESH = 37;

export type RunPowerShell = (script: string) => Promise<string>;

async function defaultRunPowerShell(script: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    { windowsHide: true, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  return stdout;
}

function escapePowerShellSingleQuoted(value: string): string {
  return value.replaceAll("'", "''");
}

function setOrRemoveProperty(name: string, value: string | null): string {
  if (value === null) {
    return `Remove-ItemProperty -Path $path -Name ${name} -ErrorAction SilentlyContinue`;
  }
  return `Set-ItemProperty -Path $path -Name ${name} -Value '${escapePowerShellSingleQuoted(value)}'`;
}

export function createWindowsRegistryProxyPort(
  runPowerShell: RunPowerShell = defaultRunPowerShell,
): WindowsProxySettingsPort {
  return {
    async read(): Promise<WindowsProxySnapshot> {
      const script = `
$path = '${INTERNET_SETTINGS}'
$enable = (Get-ItemProperty -Path $path -Name ProxyEnable -ErrorAction SilentlyContinue).ProxyEnable
$server = (Get-ItemProperty -Path $path -Name ProxyServer -ErrorAction SilentlyContinue).ProxyServer
$autoConfig = (Get-ItemProperty -Path $path -Name AutoConfigURL -ErrorAction SilentlyContinue).AutoConfigURL
$override = (Get-ItemProperty -Path $path -Name ProxyOverride -ErrorAction SilentlyContinue).ProxyOverride
function NullIfEmpty([object]$value) {
  if ($null -eq $value -or [string]$value -eq '') { return $null }
  return [string]$value
}
@{
  enabled = [bool]([int]($enable -as [int]))
  server = NullIfEmpty $server
  autoConfigUrl = NullIfEmpty $autoConfig
  proxyOverride = NullIfEmpty $override
} | ConvertTo-Json -Compress
`;
      const stdout = (await runPowerShell(script)).trim();
      if (!stdout) {
        return {
          enabled: false,
          server: null,
          autoConfigUrl: null,
          proxyOverride: null,
        };
      }
      const parsed = JSON.parse(stdout) as {
        enabled?: boolean;
        server?: string | null;
        autoConfigUrl?: string | null;
        proxyOverride?: string | null;
      };
      const asNullableString = (value: unknown): string | null =>
        typeof value === "string" && value.length > 0 ? value : null;
      return {
        enabled: Boolean(parsed.enabled),
        server: asNullableString(parsed.server),
        autoConfigUrl: asNullableString(parsed.autoConfigUrl),
        proxyOverride: asNullableString(parsed.proxyOverride),
      };
    },

    async write(snapshot: WindowsProxySnapshot): Promise<void> {
      const enabled = snapshot.enabled ? 1 : 0;
      const script = `
$path = '${INTERNET_SETTINGS}'
Set-ItemProperty -Path $path -Name ProxyEnable -Value ${enabled}
${setOrRemoveProperty("ProxyServer", snapshot.server)}
${setOrRemoveProperty("AutoConfigURL", snapshot.autoConfigUrl)}
${setOrRemoveProperty("ProxyOverride", snapshot.proxyOverride)}
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class WinINetNotify {
  [DllImport("wininet.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
}
"@
[WinINetNotify]::InternetSetOption([IntPtr]::Zero, ${INTERNET_OPTION_SETTINGS_CHANGED}, [IntPtr]::Zero, 0) | Out-Null
[WinINetNotify]::InternetSetOption([IntPtr]::Zero, ${INTERNET_OPTION_REFRESH}, [IntPtr]::Zero, 0) | Out-Null
`;
      await runPowerShell(script);
    },
  };
}
