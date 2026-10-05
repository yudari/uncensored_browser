import { dialog, Notification } from "electron";
import type { OperatorPrompt, OutageChoice } from "../shield-session/ports.js";

export class ElectronOperatorPrompt implements OperatorPrompt {
  async promptOutage(): Promise<OutageChoice> {
    const result = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Keep fail-closed", "Release System Proxy Binding"],
      defaultId: 0,
      cancelId: 0,
      title: "Proxy Outage",
      message: "The Tunnel or Upstream is unavailable.",
      detail:
        "Default is fail-closed: browsers keep using the Local Proxy until you choose otherwise.",
      noLink: true,
    });
    return result.response === 1 ? "release_binding" : "keep_fail_closed";
  }

  async notify(message: string): Promise<void> {
    if (Notification.isSupported()) {
      new Notification({ title: "Uncensored Browser", body: message }).show();
      return;
    }
    await dialog.showMessageBox({
      type: "info",
      message,
      buttons: ["OK"],
    });
  }
}
