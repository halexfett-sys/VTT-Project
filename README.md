# Archive Virtual Tabletop

A React + TypeScript virtual tabletop for the FFG Star Wars narrative dice system (Edge of the Empire, Age of Rebellion, and Force and Destiny). Unofficial and independent. The dice and result images in `public/dice/` are supplied by the user; no map artwork, logos, fonts, or rules prose are bundled. The landing-zone schematic is original SVG geometry rendered on the server; upload your own art.

## Vercel + Supabase deployment

For the hosted version, follow [the step-by-step Vercel setup guide](docs/deployment/VERCEL-SETUP.md). It includes both SQL migrations, environment variables, GitHub upload instructions and live verification. The cloud backend is separate from the local SQLite server.

## Quick start

Requires **Node.js 24.x** (uses built-in SQLite) and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to Express on port 3001. Enter a display name, create a campaign, and use **Invite crew**. Players enter as guests, open the invite link, and choose a display name and color or upload a player save. For LAN play, use the host computer's LAN address, not `localhost`, in the link. Allow the selected port through your firewall.

For production:

```sh
npm run build
npm start
```

Open **http://localhost:3001**. Express serves the compiled frontend and Socket.IO on the same port. Do not expose the Vite development server as a production service.

### Docker

```sh
docker compose up --build -d
```

Open **http://localhost:3001**. The `vtt-data` volume preserves SQLite and uploads across container replacements. Stop with `docker compose down`; do not add `-v` unless you intend to erase campaign data.

Environment variables (the server also loads an optional local `.env` file):

| Variable        | Default                     | Purpose                                                                               |
| --------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| `PORT`          | `3001`                      | Express / Socket.IO port                                                              |
| `DATA_DIR`      | `data`                      | SQLite database and uploads directory                                                 |
| `APP_ORIGIN`    | request origin on same host | Exact public origin, e.g. `https://tabletop.example.com`, when behind a reverse proxy |
| `COOKIE_SECURE` | `false`                     | Set `true` when serving over HTTPS                                                    |

For internet play, terminate HTTPS at a reverse proxy, forward WebSocket upgrades, set `APP_ORIGIN` and `COOKIE_SECURE=true`, and retain the same origin for frontend and server. The default is a single-process server; do not start multiple replicas against the same SQLite file. Back up the entire data directory while the server is stopped, or use SQLite's backup facilities plus the upload directory for online backups. `npm start` uses the installed `tsx` development dependency, so install all dependencies in this version.

## Using the tabletop, in feature order

1. **Guests and rooms:** Enter a display name; no account, email, or password is required. Create a campaign to become its GM. Invite codes are random and shareable. Your private browser cookie remembers memberships for 30 days. Return to campaigns by clicking the upper-left brand.
2. **Maps:** In Scenes, upload PNG/JPG/WebP images up to 20 MB. The new map activates for everyone. Click another scene to switch. **Manage scenes** opens GM-only scene selection with Select all, Clear selection, and Delete selected. The confirmation lists affected scenes and token counts. Deleting the active scene switches everyone to the first remaining scene; deleting all scenes creates a replacement. Scene deletion removes placed tokens and their sheets, but keeps reusable uploaded images. Drag empty space or use Pan; wheel or pinch to zoom; Fit resets the camera. Camera pan/zoom is personal; the map and its content are shared. Set square/flat-top hex/no grid, size, offsets, color, and snapping. GM hide/reveal tools paint fog; brush size is adjustable. Players receive a server-composited masked image, never the original map file. Reveal entire map clears fog.
3. **Tokens:** Open Tokens, create a marker or upload an image to the reusable campaign library, then click the image to place it. Select a token and Inspect to upload or replace its image, choose a library image, and customize background/initials colors, outline color/thickness, circle/square shape, and cover/contain image fit with a live preview. Save appearance syncs the change; select No image to return to initials. The same inspector includes name, grid size, rotation, status, sheet fields, and notes. GM can assign its owner and hide it. Owners and GM can drag, use arrow keys to move a selected token, duplicate, delete, or reorder via right-click. Tablet users can edit, duplicate, delete and reorder through the token list and Inspect. Measure draws a local ruler in grid units.
4. **Portraits and handouts:** Profile stores a portrait and extra art for each campaign member. GM uploads handouts there and clicks one to display it to everyone; each user may dismiss locally, or GM can close it globally. The active handout also appears after reconnecting.
5. **System tools:** Click colored dice to build a pool; minus buttons remove dice. Roll executes cryptographic random selection on the server. Results and individual face tooltips appear in Comms and Roll log. Opposed success/failure and advantage/threat cancel; triumph/despair and light/dark remain independent. Click a destiny side to flip a point; GM can set initial totals. Initiative sorts PC/NPC slots by successes, advantages, then PC priority; click to mark used, and advance the round to reset. Range mode shows labeled illustrative rings around your ruler origin. They are narrative guides, **not official fixed conversions** between range bands and map units.
6. **Communication:** Send messages from Comms. GM can choose a single player for a private whisper. Private messages are removed from other users' server snapshots. Roll results post automatically.

## Career & specialization trees

Open **Character → Browse trees**. The tracker holds 135 trees across Age of Rebellion, Edge of the Empire, Force and Destiny and Universal: 18 career signature-ability trees and 117 specializations.

- Pick a game and career on the left. The tabs show the career's **Signature Abilities** and each specialization with its purchased count (for example `3/20`).
- Click a talent to mark it purchased; a tree joins your profile the first time you tick one of its talents. Dimmed talents are not yet reachable through a connector from a purchased talent. The check is advisory, so house rules still work. Dark headers are active talents and ▦ marks ranked talents.
- The header shows the XP you have spent across every tree. **Search** finds talents and signature abilities by name or text and jumps straight to them. **My Build** lists everything you have purchased, grouped by game and career. **Reset** clears every tree, and **Clear this tree** clears one.
- Progress is stored per player (`member.trees`), validated by the server (`profile:tree`), and included in player and campaign exports.
- The earlier reference-image trees were retired. Progress saved under their ids carries over to the matching Edge of the Empire tree (same node numbering); see `legacyTreeIds` and `migrateTreeProgress` in `shared/trees.ts`.

Tree ids and node counts live in `shared/customTreeMeta.ts` (shared with the server) and talent text, costs and connectors in `client/customTreeData.ts` (loaded on demand). The dialog is `client/TreeDialog.tsx` and its pure logic (grouping, reachability, XP, build summary, search) is in `client/treeIndex.ts`. Node numbers: specializations 0-19 in row order; careers 0-8 for signature ability 1 (node 0) and its upgrades, 9-17 for ability 2 (node 9) and its upgrades. Text was read from scans by OCR, so correct any typos directly in `client/customTreeData.ts`.

## Portable save files

Use **Save / export** in a table:

- **Export full campaign** (GM): all scenes, images, tokens/sheets, profiles, destiny, initiative, handout and retained chat, including secrets and whispers. In the lobby, **Restore a table** imports it as a separate campaign owned by the importing guest with a new invite.
- **Export visible table** (player): the active map with fog permanently baked into its pixels and only information available to that player. This can create a separate table; it cannot recover hidden information or access the original GM role.
- **Export my player**: profile, color, portrait, art/token library and owned tokens, including appearance and sheets. Choose this file beside the invite code when joining. Within a table, **Restore my player** replaces your profile and owned tokens. Matching scene IDs retain placements; otherwise tokens move to the active scene. Player imports never grant GM authority or import hidden tokens as hidden.

Images are embedded, so files work on another installation. Keep player files private: their recovery key permits reclaiming that player. **Players should export first, then the GM exports the campaign** so the full campaign includes the corresponding hashed recovery keys. Restoring the campaign followed by each player's matching save reconnects their restored membership without duplicating it. A player save from another table joins as a new player. A browser already occupying a different membership cannot reclaim another participant; use a separate browser profile.

Export after each session and before clearing cookies or changing hosts. Files are manual snapshots; later changes are not included automatically. Campaign files include the last 500 retained chat/roll messages, not unbounded history. Imports accept version-1 `.json` files up to 128 MB, with at most 90 MB of decoded embedded image data (20 MB per image). Images are checked and re-encoded on import. Large libraries may need pruning before export.

**Live multiplayer still requires a backend.** The Vercel deployment now includes a cloud Express/Socket.IO backend using Supabase, while local Node/Docker hosting retains SQLite. Save files provide portable backups in both modes.

## Architecture

```text
client/               React UI, canvas rendering, optimistic movement, Socket.IO client
shared/types.ts       Shared campaign and action-related types
shared/dice.ts        Pure numerical face tables, pool validation, symbol resolution
server/index.ts       Server entry point
server/app.ts         HTTP/auth/uploads, filtered sockets, masked map rendering
server/actions.ts     Validated, role-checked state mutations
server/state.ts       Campaign defaults, visibility and permission helpers
server/db.ts          SQLite schema and atomic campaign snapshot commits
server/saves.ts       Portable exports, validated imports and player recovery
server/save-schema.ts Versioned save format validation
server/map-image.ts   Shared masked-map rendering
server/storage.ts     Storage interface and local disk adapter
server/placeholder.ts Original geometric map illustration
 tests/               Dice and ordered HTTP/WebSocket integration checks
 docs/PROTOCOL.md     Socket events, payloads, persistence model and invariants
```

The server is authoritative. Clients submit intentions, not replacement campaign objects. Every action validates its payload with Zod, verifies membership/ownership/GM permission, applies the change to a fresh state, commits it, then emits a per-user `state` snapshot. Token dragging predicts locally, submits positions at approximately 14 Hz, and interpolates received positions. Final coordinates are server-snapped and clamped to the map. On reconnect the client joins its current room and receives a fresh persisted snapshot. Offline edits are rejected rather than queued.

SQLite stores users, hashed opaque sessions, campaign metadata with a versioned JSON state, memberships, and asset file references. Maps, tokens, character sheets, messages, destiny and initiative are nested in that atomic campaign state. See [the data model and protocol](docs/PROTOCOL.md).

Uploads have a 20 MB request file limit and a 40-megapixel decoded image limit. The server checks decoded format, re-encodes to WebP, removes metadata and original filenames from storage keys, and uses random UUID paths. Files are accessible through authenticated campaign routes, never an open upload directory. The storage adapter can later use S3 while retaining those authorization checks.

Guest sessions use random 256-bit tokens, stored as SHA-256 hashes, expiring after 30 days. Cookies are HttpOnly and SameSite=Strict. Mutating requests reject mismatched origins. Guest entry, upload, export/import and socket action rate limits are included. Legacy participant records and existing cookies are retained for compatibility, but password login and signup are disabled.

## Verification

```sh
npm test
npm run build
npm audit
```

The test suite checks all seven dice, cancellation, uncancelled special symbols, force pips, deterministic rolls, bad pools, and face totals. The ordered integration test starts an isolated temporary database and real HTTP/Socket.IO server and covers guests, room joins, image uploads and server fog compositing, token ownership, hidden-token filtering, portraits, handouts, dice, destiny, initiative, chat, reconnection and persistence. It needs permission to open and connect to localhost sockets. `npm run build` includes strict TypeScript checking.

Manual QA: use separate browser profiles for GM and player; test upload, map switch, drag, hide/reveal, whisper privacy, refresh, and reconnect. Test pinch and pointer gestures on your target tablet before a live session.

## Scope and next steps

This is a functional single-server foundation. Snapshot broadcasting is simple and reliable for small groups; large maps or many players will benefit from incremental updates, raster tile caches, and a Socket.IO adapter. Fog is a GM-painted mask, not dynamic lighting or line-of-sight; token visibility uses the token center. Revealed information cannot be removed from a player's memory or previously captured images. There is no undo, campaign deletion UI, invite rotation, or per-user storage quota yet. The last 500 chat/roll entries are retained per campaign; fog is capped at 500 strokes per map. Token moves use last accepted server write when multiple controllers drag simultaneously.

Roadmap:

- Audio/music: synchronized playlists, volume controls, licensed uploads, reconnect-aware playback positions.
- Character import: validated import adapters, preview/diff, field mapping, versioned character records.
- Macros: saved dice pools and parameterized actions with an allowlisted interpreter (no arbitrary code execution).
- Operational hardening: invite rotation, quotas, backups, audit logs, database migrations, paginated history.
- Table tools: undo/redo, token movement locks, image tiling, shared GM camera pings, dynamic lighting and accessibility enhancements.

Numerical dice behavior was checked against the publisher's [dice overview](https://www.fantasyflightgames.com/en/news/2013/2/27/that-star-wars-feeling/). Dice and result icons now use the user-supplied images. No rules prose is reproduced.

## This workspace's live preview

The current local preview uses `.tools/qa-data` for its persistent database and uploads, selected in the ignored `.env` file. Keep that directory: it includes the campaign and map added during preview. Running `npm start` here uses that same data. A fresh checkout without `.env` uses `data/`. Neither directory is included in Docker images or source control.

On Windows, after installing dependencies, `./Start-VTT.ps1` also launches the app (and builds it if needed), without requiring npm on the runtime PATH.

## Vercel build warnings and deployment scope

The Node engine is pinned to `24.x`, and `package.json.allowScripts` explicitly permits the installed `esbuild@0.28.2` postinstall step. Revisit that version-specific approval when updating esbuild. On newer npm, `npm install-scripts ls` lists scripts needing review. Do not enable all dependency scripts just to silence a warning.

An `Unknown env config "cache-dir"` warning is not configured by this repository. If your deployment settings inject `NPM_CONFIG_CACHE_DIR` (or `npm_config_cache_dir`), remove it; npm's supported cache location setting is `NPM_CONFIG_CACHE`. A warning by itself does not establish a failed build: inspect subsequent error lines and the final exit status.

The current backend requires a single long-running Node server and durable disk storage for SQLite and uploaded images. A Vite frontend-only deployment on Vercel does not deploy or route this backend automatically. Vercel Functions have ephemeral storage, so moving the SQLite database into `/tmp` is not a persistence fix. Vercel now supports WebSockets in public beta, but a full migration still requires external database/object storage, a Vercel-compatible server entry point, and cross-instance synchronization. The supplied Docker setup on a host with a persistent volume retains the current architecture.

References: [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [npm script approvals](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/), [Vercel SQLite storage limitations](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [WebSocket public beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta).

## Interface customization

The supplied SWEuroRegular font is used for readable interface text, Starjhol for headings, and Aurebesh only for decorative text marked hidden from assistive technology. Font assets are user-supplied in public/fonts. Blank scenes show “No Map Data...” until a map image is assigned. Range mode exposes a personal base-radius control in map pixels; ring multipliers are 1, 3, 6, 10 and 15. These are narrative guides. Select a placed token in the Tokens panel or use Rename / edit token from its context menu to change its name or delete it (owner/GM permissions apply). Save / import / export includes player imports and full-table imports; table imports create a new campaign.

### Character Data
Open the Character tab and upload an OggDude Character XML (up to 5 MB). Review the imported name, species, career, specializations, credits, six characteristics, soak, wound/strain thresholds, and ranged/melee defense, then save. Custom species/career identifiers remain editable when no name is embedded. Calculated equipment or conditional bonuses should be reviewed. Select Obligation, Duty, or Morality and set its counter from 1–100 (initially 50).

Each member edits their own Character Data; everyone at the table can view it. Data synchronizes through `profile:update` and is included in player and campaign exports/imports. XML is parsed locally; only the reviewed fields are sent to the server. This imports the displayed fields, not the entire OggDude talent/equipment database.

## Career and specialization trees
Open Character → Browse trees to work through the 135 career and specialization trees (described above). Click a talent to mark or unmark it; the tree joins your profile on your first click. Clear this tree and Reset remove marks after confirmation. This is a reference tracker, not a prerequisite or XP validator.

Progress persists with your campaign membership and is included in player, table, and campaign exports/imports. Export your player data to carry it into another table. Existing saves without trees continue to work.

Socket event `profile:tree`: `{treeId, operation: "add" | "remove" | "mark", node?, completed?}`. Mark uses a zero-based node and an explicit boolean for safe retries. The server validates the catalog and node bounds and only edits the acting member. Member data adds optional `trees: [{treeId, completed: number[]}]`; the catalog lives in `shared/trees.ts` and `shared/customTreeMeta.ts`. Ids from the retired reference-image trees are remapped to their current ids whenever saved progress is parsed (`migrateTreeProgress`).
