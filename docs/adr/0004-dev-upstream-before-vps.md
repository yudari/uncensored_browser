# Dev Upstream on the Workstation before renting a VPS

The Operator wants to test on Windows first without owning a VPS. We allow a Dev Upstream: real OpenSSH on the same Workstation (or WSL), still driven by `ssh -D` (ADR 0003). That validates Tray Client orchestration, Shield Session, Binding Guard, and Outage Prompt. It does not provide ISP unblock. Claiming Unblock Milestone still requires a real Upstream outside the ISP; Dev Upstream must stay explicitly labeled so local success is not mistaken for bypass.
