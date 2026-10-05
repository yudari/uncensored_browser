export type LoginAutoStartPreferenceFile = {
  read(): Promise<string | null>;
  write(contents: string): Promise<void>;
};

export type StoredLoginAutoStart = {
  enabled: boolean;
};

/** Default ON so the Tray Client meets login auto-start; never implies auto-Arm. */
export function resolveLoginAutoStartEnabled(
  stored: StoredLoginAutoStart | null,
): boolean {
  if (!stored) return true;
  return stored.enabled;
}

export class LoginAutoStartPreference {
  constructor(private readonly file: LoginAutoStartPreferenceFile) {}

  async loadEnabled(): Promise<boolean> {
    const contents = await this.file.read();
    if (!contents) return resolveLoginAutoStartEnabled(null);
    try {
      const parsed = JSON.parse(contents) as StoredLoginAutoStart;
      if (typeof parsed.enabled !== "boolean") {
        return resolveLoginAutoStartEnabled(null);
      }
      return resolveLoginAutoStartEnabled(parsed);
    } catch {
      return resolveLoginAutoStartEnabled(null);
    }
  }

  async saveEnabled(enabled: boolean): Promise<void> {
    await this.file.write(JSON.stringify({ enabled }, null, 2));
  }
}
