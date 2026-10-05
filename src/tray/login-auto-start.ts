export type LoginAutoStartPort = {
  isEnabled(): boolean;
  setEnabled(enabled: boolean): void;
};

/**
 * Controls whether the Tray Client launches at Windows login.
 * Enabling this must never Arm a Shield Session — Operator Arms manually.
 */
export class LoginAutoStart {
  constructor(private readonly port: LoginAutoStartPort) {}

  isEnabled(): boolean {
    return this.port.isEnabled();
  }

  setEnabled(enabled: boolean): void {
    this.port.setEnabled(enabled);
  }
}

export function createElectronLoginAutoStartPort(app: {
  getLoginItemSettings: () => { openAtLogin: boolean };
  setLoginItemSettings: (settings: {
    openAtLogin: boolean;
    openAsHidden?: boolean;
  }) => void;
}): LoginAutoStartPort {
  return {
    isEnabled: () => app.getLoginItemSettings().openAtLogin,
    setEnabled: (enabled) => {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: true,
      });
    },
  };
}
