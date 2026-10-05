export const DEV_UPSTREAM_LIMITATIONS: string[] = [
  "Dev Upstream (loopback OpenSSH/WSL) validates Tunnel, Arm/Disarm, and System Proxy Binding only. It does not defeat ISP Blocks.",
  "Unblock Milestone requires a real Upstream outside your ISP (for example a VPS). Do not claim unblock while only Dev Upstream is configured.",
  "Chrome/Edge follow System Proxy Binding; some non-browser apps may also follow it while a Shield Session is armed.",
  "WebRTC and some Chromium paths can bypass the system proxy. That leak is an accepted v1 limitation.",
  "Login auto-start launches the Tray Client disarmed. You must Arm manually after Upstream is ready.",
  "Quit always Disarms first so System Proxy Binding is not left pointing at a dead Local Proxy.",
];

export function formatOperatorLimitations(): string {
  return ["Limitations (Dev Upstream phase)", "", ...DEV_UPSTREAM_LIMITATIONS.map((line) => `• ${line}`)].join(
    "\n",
  );
}
