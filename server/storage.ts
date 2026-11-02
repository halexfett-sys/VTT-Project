import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
// Replace this adapter with S3 put/get; asset authorization remains in the API.
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}
export class LocalStorage implements Storage {
  constructor(private root: string) {}
  private file(key: string) {
    if (!/^[a-zA-Z0-9-]+\.webp$/.test(key))
      throw new Error("Invalid asset key");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.file(key), data);
  }
  async get(key: string) {
    return readFile(this.file(key));
  }
}
