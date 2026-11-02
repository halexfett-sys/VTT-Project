import { createCloudApp } from "../server/cloud-app.js";
import { createServer } from "node:http";
// Export the HTTP server so Vercel can serve HTTP and WebSocket upgrades.
let server;
try {
  server = createCloudApp().http;
} catch {
  server = createServer((_req, res) => {
    res.writeHead(503, {
      "content-type": "application/json",
      "cache-control": "no-store",
    });
    res.end(
      JSON.stringify({
        error:
          "Backend configuration missing. Set SUPABASE_URL and SUPABASE_SECRET_KEY in Vercel, then redeploy.",
      }),
    );
  });
}
export default server;
