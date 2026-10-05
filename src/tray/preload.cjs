const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trayApi", {
  saveEndpoint: (endpoint) => ipcRenderer.invoke("tray:save-endpoint", endpoint),
});
