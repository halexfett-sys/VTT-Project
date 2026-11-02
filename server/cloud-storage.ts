import type { Storage } from "./storage";
import { SupabaseTransport } from "./supabase";
export class CloudStorage implements Storage {
  constructor(
    private transport: SupabaseTransport,
    private bucket = "vtt-assets",
  ) {
    if (!/^[a-z0-9-]+$/.test(bucket)) throw new Error("Invalid storage bucket");
  }
  private path(key: string) {
    if (!/^[a-zA-Z0-9-]+\.webp$/.test(key))
      throw new Error("Invalid asset key");
    return `/storage/v1/object/${this.bucket}/${key}`;
  }
  async put(key: string, data: Buffer) {
    await this.transport.call(this.path(key), {
      method: "POST",
      headers: { "content-type": "image/webp", "x-upsert": "false" },
      body: new Uint8Array(data),
    });
  }
  async get(key: string) {
    const response = await this.transport.call(this.path(key));
    return Buffer.from(await response.arrayBuffer());
  }
}
