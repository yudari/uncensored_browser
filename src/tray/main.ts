import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ShieldSessionController } from "../shield-session/controller.js";
import type { UpstreamEndpoint } from "../shield-session/ports.js";
import { SshTunnelDriver } from "../tunnel/ssh-tunnel-driver.js";
import { ElectronOperatorPrompt } from "./electron-prompt.js";
import { EndpointStore } from "./endpoint-store.js";
import { createJsonFilePort } from "./json-file-port.js";
import { StubSystemProxyBinding } from "./stub-drivers.js";
import { TraySession } from "./tray-session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let tray: Tray | null = null;
let configWindow: BrowserWindow | null = null;
let session!: TraySession;
let prompt!: ElectronOperatorPrompt;
let bindingGuardTimer: NodeJS.Timeout | null = null;
let isQuitting = false;

function createSession(): TraySession {
  const storePath = path.join(app.getPath("userData"), "upstream-endpoint.json");
  const store = new EndpointStore(createJsonFilePort(storePath));
  const tunnel = new SshTunnelDriver();
  const binding = new StubSystemProxyBinding();
  prompt = new ElectronOperatorPrompt();
  const controller = new ShieldSessionController({ tunnel, binding, prompt });
  return new TraySession({ controller, store });
}

function stopBindingGuard(): void {
  if (!bindingGuardTimer) return;
  clearInterval(bindingGuardTimer);
  bindingGuardTimer = null;
}

function startBindingGuard(): void {
  stopBindingGuard();
  bindingGuardTimer = setInterval(() => {
    void session.checkBinding().then(() => refreshMenu());
  }, 5000);
}

function refreshMenu(): void {
  if (!tray) return;
  const items: Electron.MenuItemConstructorOptions[] = [
    { label: session.statusLabel(), enabled: false },
    { label: session.endpointSummary(), enabled: false },
    { type: "separator" },
    {
      label: "Arm Shield Session",
      click: () => {
        void onArm();
      },
    },
    {
      label: "Disarm Shield Session",
      click: () => {
        void onDisarm();
      },
    },
    {
      label: "Configure Upstream Endpoint…",
      click: () => openConfigWindow(),
    },
  ];

  if (session.canSimulateTunnelOutage()) {
    items.push({
      label: "Simulate Tunnel exit (stub)",
      click: () => {
        void (async () => {
          await session.simulateTunnelOutage();
          refreshMenu();
        })();
      },
    });
  }

  items.push(
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        void quitApp();
      },
    },
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
  tray.setToolTip(`Uncensored Browser — ${session.statusLabel()}`);
}

async function onArm(): Promise<void> {
  const result = await session.arm();
  if (!result.ok) {
    await prompt.notify(
      result.reason === "incomplete_endpoint"
        ? "Configure an Upstream Endpoint before Arming."
        : (result.message ??
            "Tunnel failed to start. Check OpenSSH client and Dev Upstream / Upstream reachability."),
    );
  } else {
    startBindingGuard();
  }
  refreshMenu();
}

async function onDisarm(): Promise<void> {
  await session.disarm();
  stopBindingGuard();
  refreshMenu();
}

async function quitApp(): Promise<void> {
  if (isQuitting) return;
  isQuitting = true;
  stopBindingGuard();
  await session.shutdown();
  app.quit();
}

function openConfigWindow(): void {
  if (!session.canConfigure()) {
    void prompt.notify("Disarm the Shield Session before changing Upstream Endpoint.");
    return;
  }

  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 480,
    height: 440,
    title: "Upstream Endpoint",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void configWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      buildConfigHtml(session.currentEndpoint()),
    )}`,
  );

  configWindow.on("closed", () => {
    configWindow = null;
  });
}

function buildConfigHtml(endpoint: UpstreamEndpoint | null): string {
  const host = endpoint?.host ?? "127.0.0.1";
  const sshUser = endpoint?.sshUser ?? "";
  const operatorKeyPath = endpoint?.operatorKeyPath ?? "";
  const sshPort = endpoint?.sshPort ?? 22;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Upstream Endpoint</title>
  <style>
    body { font-family: Segoe UI, sans-serif; margin: 24px; background: #f6f7f9; color: #1a1a1a; }
    label { display: block; font-size: 12px; margin-top: 12px; }
    input { width: 100%; box-sizing: border-box; padding: 8px; margin-top: 4px; }
    button { margin-top: 20px; padding: 10px 16px; }
    .note { font-size: 12px; color: #555; margin-top: 16px; line-height: 1.4; }
  </style>
</head>
<body>
  <h1>Upstream Endpoint</h1>
  <p class="note">Uses OpenSSH <code>ssh -D</code> to the Upstream Endpoint (ADR 0003). Binding is still stubbed until ticket 4. Loopback hosts show as Dev Upstream. Dev Upstream does not defeat ISP Blocks.</p>
  <label>Host <input id="host" value="${escapeHtml(host)}" /></label>
  <label>SSH user <input id="sshUser" value="${escapeHtml(sshUser)}" /></label>
  <label>Operator Key path <input id="operatorKeyPath" value="${escapeHtml(operatorKeyPath)}" /></label>
  <label>SSH port <input id="sshPort" type="number" value="${sshPort}" /></label>
  <button id="save">Save</button>
  <script>
    document.getElementById('save').onclick = async () => {
      await window.trayApi.saveEndpoint({
        host: document.getElementById('host').value,
        sshUser: document.getElementById('sshUser').value,
        operatorKeyPath: document.getElementById('operatorKeyPath').value,
        sshPort: Number(document.getElementById('sshPort').value) || 22,
      });
      window.close();
    };
  </script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createTrayIcon(): Electron.NativeImage {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGD4z0ABYBzVMKoBBgZGRkYGRgbG/wwwGjBqAAPDqAGjBgwGgwkAAf0B/zQWnQYAAAAASUVORK5CYII=",
    "base64",
  );
  return nativeImage.createFromBuffer(png);
}

app.whenReady().then(async () => {
  if (process.platform === "win32") {
    app.setAppUserModelId("com.yudari.uncensored-browser");
  }

  session = createSession();
  await session.hydrate();

  tray = new Tray(createTrayIcon());
  refreshMenu();

  ipcMain.handle(
    "tray:save-endpoint",
    async (_event, endpoint: UpstreamEndpoint) => {
      await session.saveEndpoint(endpoint);
      refreshMenu();
    },
  );
});

app.on("window-all-closed", () => {
  // Keep the Tray Client running when the config window closes.
});
