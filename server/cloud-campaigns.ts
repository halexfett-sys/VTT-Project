import type { Campaign } from "../shared/types.js";
import { SupabaseTransport } from "./supabase.js";
export class RevisionConflict extends Error {
  constructor() {
    super(
      "The table changed during this action. Reload state before retrying.",
    );
  }
}
/** Compare-and-swap commits prevent different function instances losing updates. */
export class CloudCampaigns {
  constructor(public transport: SupabaseTransport) {}
  async get(id: string): Promise<Campaign> {
    const response = await this.transport.call(
      `/rest/v1/vtt_campaigns?id=eq.${encodeURIComponent(id)}&select=state`,
    );
    const rows = await response.json();
    if (!rows.length) throw new Error("Campaign not found");
    return rows[0].state;
  }
  async save(campaign: Campaign, expectedRevision: number | null) {
    const next = structuredClone(campaign);
    next.revision = (expectedRevision ?? 0) + 1;
    const response = await this.transport.call(
      "/rest/v1/rpc/vtt_commit_campaign",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          p_id: next.id,
          p_expected: expectedRevision,
          p_state: next,
        }),
      },
    );
    if (!(await response.json())) throw new RevisionConflict();
    campaign.revision = next.revision;
  }
}
