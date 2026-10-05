# Operator guide — Dev Upstream phase

Personal Windows Tray Client for a Shield Session: OpenSSH `ssh -D` Tunnel + Windows System Proxy Binding so Chrome/Edge send Browser Traffic through a Local Proxy.

## What this phase proves

- Configure Upstream Endpoint
- Arm / Disarm ordering
- Outage Prompt (default fail-closed)
- Binding Guard
- Dev Upstream labeling for loopback hosts

This phase does **not** claim the **Unblock Milestone**. A Dev Upstream on the same Workstation still exits via your ISP.

## Prerequisites

1. **OpenSSH Client** (Windows optional feature) — provides `ssh`.
2. **Dev Upstream SSH server** on this Workstation:
   - Windows OpenSSH Server, or
   - SSH inside WSL reachable from Windows
3. An **Operator Key** (ed25519 recommended) authorized on that server.
4. Chrome or Edge installed (system proxy consumers).

### Quick Dev Upstream (Windows OpenSSH Server)

```powershell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

Authorize your public key for the Windows user that will accept SSH, then point the Tray Client at:

- Host: `127.0.0.1` or `localhost` (shows as **Dev Upstream**)
- SSH user: your Windows username
- Operator Key path: e.g. `C:\Users\<you>\.ssh\id_ed25519`
- SSH port: `22` (default)

## Run

```bash
npm start
```

Tray menu:

1. **Configure Upstream Endpoint…**
2. **Arm Shield Session** — Tunnel up, then System Proxy Binding
3. Browse with Chrome/Edge (manual check that traffic uses the Local Proxy)
4. **Disarm** or **Quit** (Quit always Disarms first)

Optional: **Start Tray Client at Windows login** (default **on**, can be unchecked) — launches the tray **disarmed** (never auto-Arms).

## Limitations

See also the in-app **Limitations…** tray item.

- Dev Upstream ≠ ISP unblock
- Non-browser apps may follow system proxy while armed
- WebRTC / some Chromium bypasses are accepted in v1
- Unblock Milestone = later, with a remote Upstream outside the ISP
