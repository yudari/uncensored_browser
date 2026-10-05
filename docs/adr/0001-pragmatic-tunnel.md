# Pragmatic Tunnel: SSH first behind a swappable interface

Personal unblock needs an encrypted path to Operator-owned Upstream, but ISP Blocks vary and may later kill a specific protocol. We will expose a Tunnel interface in the Local Proxy, ship SSH dynamic SOCKS as the first driver, and swap to WireGuard or an HTTPS-looking driver only if that Tunnel itself gets Blocked — without rewriting the Tray Client.
