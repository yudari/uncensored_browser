# Tray Client is Electron despite a thin UI

The Operator-facing surface is mostly tray status, arm/disarm, Outage Prompt, and a small config form (Upstream host, SSH user, Operator Key path). We still chose Electron so the Workstation client stays in the React/Node ecosystem the Operator already uses. Cost: larger binary and more moving parts than a single Go/Rust tray binary or a PowerShell+ssh prototype. Local Proxy must remain swappable behind the Tunnel Driver interface from ADR 0001, not buried inside React UI code.
