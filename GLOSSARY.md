# Uncensored Browser Access

Personal Windows tooling that lets browsers reach sites an ISP would otherwise block.

## Language

**Operator**:
The single person who installs and runs this tooling for their own machine.
_Avoid_: User, customer, client

**Local Proxy**:
A process on the Operator's Windows machine that browsers send traffic through.
_Avoid_: VPN, app, service (unless meaning a Windows Service specifically), gateway

**Browser Traffic**:
HTTP/HTTPS requests originating from web browsers on the Operator's machine.
_Avoid_: All device traffic, system traffic, app traffic

**Block**:
An ISP action that prevents a browser from successfully loading a site, with symptoms that may vary by site (DNS failure, block page, timeout, reset).
_Avoid_: Censorship (too broad), ban, takedown

**Upstream**:
The Operator-owned remote server, outside the ISP's network, that receives forwarded Browser Traffic and fetches sites on the Operator's behalf.
_Avoid_: VPS, exit node, server, gateway

**Tunnel**:
The encrypted path between the Local Proxy and the Upstream.
_Avoid_: VPN, connection, wire

**Tray Client**:
The Windows system-tray program the Operator uses to start/stop the Local Proxy and see whether the Tunnel is up.
_Avoid_: App, GUI, service

**System Proxy Binding**:
The Windows proxy settings the Tray Client applies so Chromium browsers send Browser Traffic to the Local Proxy.
_Avoid_: PAC file, browser extension, manual proxy

**CONNECT Relay**:
Local Proxy behavior that forwards Browser Traffic to the Upstream without decrypting TLS.
_Avoid_: MITM, TLS inspection, HTTPS sniffing, content filter

**Proxy Outage**:
A state where the Tunnel or Upstream is unavailable while the Operator still expects browsing to work.
_Avoid_: Downtime, disconnect (too vague)

**Outage Prompt**:
The Tray Client question shown on Proxy Outage: keep fail-closed, or release System Proxy Binding so browsers go direct via the ISP.
_Avoid_: Error dialog, notification (too generic)

**Tunnel Driver**:
A concrete implementation of the Tunnel (first: SSH; later possibly WireGuard or an HTTPS-looking protocol) behind one Local Proxy interface.
_Avoid_: VPN mode, protocol (too vague), transport

**Upstream Resolution**:
DNS and connection setup for site hostnames performed on the Upstream, not on the Operator's Windows machine / ISP DNS.
_Avoid_: Local DNS, DoH-only, system resolver

**Operator Key**:
The SSH keypair (or later protocol keys) that prove this Tray Client may use the Upstream.
_Avoid_: Password, token, API key (unless a future driver needs one)

**Workstation**:
The single Windows PC where the Tray Client, Local Proxy, and System Proxy Binding run for v1.
_Avoid_: Device, node, endpoint, client machine

**Shield Session**:
The period when the Tunnel is up and System Proxy Binding is applied, so Browser Traffic is sent through the Local Proxy toward the Upstream.
_Avoid_: Connected, armed-only, VPN session, browsing session

**Arm**:
The Operator action that starts a Shield Session: bring the Tunnel up, then apply System Proxy Binding.
_Avoid_: Connect, enable, start proxy

**Disarm**:
The Operator action that ends a Shield Session: release System Proxy Binding, then tear down the Tunnel.
_Avoid_: Disconnect, disable, stop

**Upstream Endpoint**:
The minimum Upstream connection settings the Operator configures: host, SSH user, Operator Key path, and SSH port (default 22).
_Avoid_: Server config, connection string, profile

**Dev Upstream**:
An SSH endpoint on the Workstation itself (Windows OpenSSH or WSL) used to exercise Tunnel, Arm/Disarm, and System Proxy Binding without a remote VPS. It does not defeat ISP Blocks.
_Avoid_: Mock Tunnel, fake proxy, local-only mode (too vague)

**Unblock Milestone**:
The separate goal of pointing the same Tray Client at a real Upstream outside the ISP and verifying Blocked sites load. Not claimed while only Dev Upstream is in use.
_Avoid_: v1 done, production, launch

**Binding Guard**:
The Tray Client behavior that periodically checks System Proxy Binding during a Shield Session and either restores it or Disarms and notifies the Operator if it was changed externally.
_Avoid_: Watchdog, proxy monitor, health check
