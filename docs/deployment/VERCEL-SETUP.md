# Deploy Archive VTT on Vercel + Supabase

The repository now includes a Vercel backend (`api/server.ts`). Vercel serves the React frontend and forwards `/api/*` to the backend. Supabase stores guest sessions, campaign state, recovery keys and private images. No local SQLite or local upload directory is used by the cloud backend.

## 1. Prepare the Supabase database (once)

1. Open your Supabase project `omcgriysqpamqlndesvy`.
2. Click **SQL Editor**, then **New query**.
3. Open `supabase/migrations/001_vtt.sql` from this project, copy its entire contents into the editor, and click **Run**.
4. Create another query. Paste the entire contents of `supabase/migrations/002_transfers.sql` and click **Run**.
5. In **Storage**, confirm that `vtt-assets` and `vtt-transfers` exist and are **private**. Do not make either bucket public. If a bucket with either name already existed, verify its configuration matches the SQL; the migration intentionally does not overwrite existing buckets.

These scripts create tables prefixed `vtt_`, private buckets, and restricted server-only functions. They do not erase existing project tables or local campaigns. The browser never receives the Supabase secret key. Application routes enforce guest membership and GM permissions before reading images or exposing state.

## 2. Set Vercel environment variables

Open Vercel → your Archive VTT project → Settings → Environment Variables. Add each name/value for **Production**. For testing branch deployments, also select **Preview** only if you intend them to share this database.

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | `https://omcgriysqpamqlndesvy.supabase.co` |
| `SUPABASE_SECRET_KEY` | Secret key from Supabase Settings → API Keys (`sb_secret_…`) |
| `STORAGE_BUCKET` | `vtt-assets` |
| `APP_ORIGIN` | `https://archivevtt.vercel.app` |
| `COOKIE_SECURE` | `true` |

Do not use a `VITE_` prefix for these names. Do not put the secret in GitHub. No database password or `DATABASE_URL` is needed: this implementation uses Supabase's server-side REST API.

## 3. Deploy the updated source

1. Back up your local campaign using **Save / export → Export full campaign**. Players should export their files first if their recovery keys should be included.
2. Update your GitHub repository with the contents of the new `VTT-source.zip`. Extract the ZIP first; upload the files and folders, not the ZIP itself. Keep `package.json`, `vercel.json`, `api/`, `server/`, `client/`, and `supabase/` at the repository root.
3. Vercel should build automatically after the commit. Use Node **24.x**, build command **npm run build**, output directory **dist**, and leave the root directory at the repository root. Do not configure a frontend-only deployment that excludes `api/`.
4. Ensure **Fluid compute** is enabled in Vercel's function settings; WebSocket support requires it. `vercel.json` sets the function maximum duration to 300 seconds.
5. If you added environment variables after deploying, open **Deployments**, select the newest deployment, and choose **Redeploy**.

## 4. Verify the public deployment

- Open `https://archivevtt.vercel.app/api/config`: expect JSON containing `"cloud":true`.
- Open `https://archivevtt.vercel.app/api/health`: expect `"ok":true`. An error here usually means the SQL scripts, secret, or project URL need checking.
- Open `https://archivevtt.vercel.app/api/me`: expect `null` before entering as a guest, or a guest object afterwards. A 404 still means the new API source/configuration was not deployed.
- Enter a display name, create a room, and join its invite from a second browser profile. Move tokens and check both views. Test a player trying a GM-only operation.
- Upload a map; export the campaign; restore it from the lobby. Local browser sessions do not migrate automatically. The saved campaign imports as a new campaign with a new invite.

## Runtime behavior and limits

- Socket.IO uses WebSocket-only transport at `/api/server/socket.io`, with `addTrailingSlash: false` on both client and server. The slash-free path avoids the deployed trailing-slash 404. The client reconnects and rejoins after Vercel ends a function connection.
- Actions validate permissions on the server. Campaign writes use PostgreSQL compare-and-swap revisions. A conflicting action returns an error instead of overwriting another user's update; retry after the latest snapshot arrives.
- Clients on the same instance receive immediate broadcasts. Across instances, each connected socket checks durable state once per second. This is a simple small-group implementation, not a high-scale pub/sub adapter. It consumes database reads and active-function time; monitor both providers' free usage limits. Token movement across instances can lag by about a second.
- Images up to 20 MB and save files up to 128 MB upload in 2 MB chunks. Ownership is verified for every chunk and import. Chunk records expire after one hour; successfully consumed chunks are deleted. Failed/abandoned uploads can leave private chunks: remove expired transfer folders from the `vtt-transfers` bucket periodically. Do not delete `vtt-assets` when cleaning temporary transfers.
- Downloads are streamed, including large saves and server-masked maps. Large libraries still use function memory/CPU; imports must finish within the function duration. Saves retain the existing image-count and decoded-size limits.
- Private assets are fetched through authorized API routes. Player map exports and views use server-composited fog, and filtered snapshots remove GM secrets and other players' private sheets.
- Supabase free projects can pause after inactivity. Resume the project in Supabase if health checks fail after a long idle period. Free quotas are finite; portable save files remain recommended backups.

## Verification status

Local tests exercise two cloud server instances against a simulated Supabase REST/storage implementation, including shared guest sessions, permissions, chunked uploads, image/save round trips, player recovery and revision conflicts. They do not replace applying the SQL on real PostgreSQL or a deployed Vercel/Supabase smoke test. No live schema changes or deployment have been performed by the coding agent.

## Local hosting remains available

`npm run dev` and `npm start` retain the SQLite/local-disk server. They do not automatically switch to cloud storage when these variables are present. The cloud function entry point is separate, so local data stays intact.

References: https://vercel.com/docs/functions/websockets · https://vercel.com/docs/functions/streaming-functions · https://supabase.com/docs/guides/getting-started/api-keys
