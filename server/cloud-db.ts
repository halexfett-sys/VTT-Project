import { SupabaseTransport } from "./supabase";
import { CloudCampaigns } from "./cloud-campaigns";
import type { Campaign } from "../shared/types";
export class CloudStore extends CloudCampaigns {
  constructor(public transport: SupabaseTransport) {
    super(transport);
  }
  async rows(table: string, query = "") {
    return (await this.transport.call(`/rest/v1/${table}?${query}`)).json();
  }
  async write(
    table: string,
    body: unknown,
    query = "",
    method = "POST",
    ignore = false,
  ) {
    await this.transport.call(`/rest/v1/${table}?${query}`, {
      method,
      headers: {
        "content-type": "application/json",
        Prefer: ignore
          ? "resolution=ignore-duplicates,return=minimal"
          : "return=minimal",
      },
      body: JSON.stringify(body),
    });
  }
  async guest(id: string, name: string) {
    await this.write("vtt_guests", { id, name });
  }
  async session(token: string) {
    const rows = await this.rows(
      "vtt_sessions",
      `token_hash=eq.${token}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=guest_id,vtt_guests(id,name)`,
    );
    const guest = rows[0]?.vtt_guests;
    return guest ? { id: guest.id, username: guest.name } : undefined;
  }
  async invite(code: string) {
    return (
      await this.rows(
        "vtt_campaigns",
        `invite=eq.${encodeURIComponent(code)}&select=id`,
      )
    )[0];
  }
  async member(room: string, user: string) {
    const c = await this.get(room);
    if (!c.members.some((m) => m.userId === user))
      throw new Error("Campaign access denied");
    return c;
  }
  async save(
    c: Campaign,
    expected: number | null = c.revision === 0 ? null : c.revision,
  ) {
    return super.save(c, expected);
  }
  // Compatibility boundary for the portable-save workflow; all statements are fixed internal strings.
  db = {
    prepare: (sql: string) => ({
      run: async (...p: any[]) => {
        if (sql.startsWith("INSERT INTO users")) return this.guest(p[0], p[3]);
        if (
          sql.startsWith("INSERT INTO assets") ||
          sql.startsWith("DELETE FROM memberships")
        )
          return;
        if (sql.startsWith("INSERT") && sql.includes("save_keys"))
          return this.write(
            "vtt_save_keys",
            { campaign_id: p[0], guest_id: p[1], key_hash: p[2] },
            "",
            "POST",
            sql.includes("IGNORE"),
          );
        if (sql.startsWith("UPDATE save_keys"))
          return this.write(
            "vtt_save_keys",
            { guest_id: p[0] },
            `campaign_id=eq.${p[1]}&guest_id=eq.${p[2]}`,
            "PATCH",
          );
        throw new Error("Unsupported cloud statement");
      },
      get: async (...p: any[]) => {
        if (sql.includes("FROM campaigns")) return this.invite(p[0]);
        if (sql.includes("FROM save_keys")) {
          const r = await this.rows(
            "vtt_save_keys",
            `campaign_id=eq.${p[0]}&key_hash=eq.${p[1]}`,
          );
          return r[0] ? { user_id: r[0].guest_id } : undefined;
        }
        throw new Error("Unsupported cloud query");
      },
      all: async (...p: any[]) => {
        if (sql.includes("FROM save_keys"))
          return (
            await this.rows("vtt_save_keys", `campaign_id=eq.${p[0]}`)
          ).map((r: any) => ({ memberId: r.guest_id, hash: r.key_hash }));
        throw new Error("Unsupported cloud query");
      },
    }),
  };
}
