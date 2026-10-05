import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EndpointFilePort } from "./endpoint-store.js";

export function createJsonFilePort(filePath: string): EndpointFilePort {
  return {
    async read() {
      try {
        return await readFile(filePath, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async write(contents: string) {
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, contents, "utf8");
    },
  };
}
