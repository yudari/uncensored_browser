# Uncensored Browser

Personal Windows **Tray Client** that starts a **Shield Session**: OpenSSH `ssh -D` Tunnel + Windows **System Proxy Binding**, so Chrome/Edge send **Browser Traffic** through a **Local Proxy** toward an **Upstream** you control.

> **Current phase: Dev Upstream.** You can validate Arm/Disarm, Outage Prompt, and Binding on one Workstation (loopback SSH). This does **not** defeat ISP Blocks. A real **Unblock Milestone** needs an Upstream outside your ISP (for example a VPS). Packaging a `.exe` installer is **not** set up yet.

## Requirements

- Windows 10/11
- Node.js 22+ (for development)
- OpenSSH Client (`ssh`)
- For local testing: OpenSSH Server or WSL SSH (**Dev Upstream**)
- Chrome or Edge

## Quick start (development)

```bash
npm install
npm start
```

There is **no main window**. Look for the **blue tray icon** near the clock (open the `^` overflow if needed). Right-click to configure, Arm, Disarm, or Quit. The terminal staying open is normal.

| Command               | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `npm start`           | TypeScript build, then Electron          |
| `npm run start:quick` | Electron only (after a successful build) |
| `npm test`            | Vitest suite                             |
| `npm run typecheck`   | `tsc --noEmit`                           |
| `npm run build`       | Compile to `dist/`                       |

Full Operator steps (OpenSSH Server, key path, limitations): **[docs/OPERATOR.md](docs/OPERATOR.md)**.

## Domain docs

- Glossary: [GLOSSARY.md](GLOSSARY.md)
- Architecture decisions: [docs/adr/](docs/adr/)
- Spec (Dev Upstream phase): [GitHub issue #1](https://github.com/yudari/uncensored_browser/issues/1)

## Status / roadmap

| Done                                   | Not yet                                   |
| -------------------------------------- | ----------------------------------------- |
| Tray Client (Electron)                 | Windows `.exe` / installer packaging      |
| `ssh -D` Tunnel Driver                 | Unblock Milestone (remote Upstream / VPS) |
| Windows SOCKS System Proxy Binding     | Auto-update, code signing                 |
| Dev Upstream labeling & Operator notes |                                           |

## License

Private project — see repository visibility on GitHub.
