// Server-only transport. Never import this module from client/.
export class SupabaseTransport {
  constructor(
    private url: string,
    private secret: string,
    private request = fetch,
  ) {
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url))
      throw new Error("Invalid SUPABASE_URL");
    if (!secret) throw new Error("SUPABASE_SECRET_KEY is required");
  }
  async call(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("apikey", this.secret);
    // Legacy service-role JWTs require Authorization; new secret keys are not JWTs.
    if (this.secret.startsWith("eyJ"))
      headers.set("Authorization", `Bearer ${this.secret}`);
    const response = await this.request(`${this.url}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw new Error(`Cloud storage request failed (HTTP ${response.status})`);
    return response;
  }
}
