import type { UpstreamEndpoint } from "../shield-session/ports.js";

export {};

declare global {
  interface Window {
    trayApi: {
      saveEndpoint: (endpoint: UpstreamEndpoint) => Promise<void>;
    };
  }
}
