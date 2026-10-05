export type WindowsProxySnapshot = {
  enabled: boolean;
  server: string | null;
  autoConfigUrl: string | null;
  proxyOverride: string | null;
};

export interface WindowsProxySettingsPort {
  read(): Promise<WindowsProxySnapshot>;
  write(snapshot: WindowsProxySnapshot): Promise<void>;
}
