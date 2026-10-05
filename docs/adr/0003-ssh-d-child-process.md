# Local Proxy v1 is OpenSSH `ssh -D` as a child process

The Electron Tray Client orchestrates System Proxy Binding, Outage Prompt, Binding Guard, and config for the Upstream Endpoint. The first Tunnel Driver is Windows OpenSSH spawned as `ssh -D` (dynamic SOCKS), not an in-process JS SSH stack and not a separate sidecar binary. That keeps Tunnel Drivers swappable later (ADR 0001) and keeps protocol code out of the React UI.
