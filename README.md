# Outer Rim — browser virtual tabletop

A React + TypeScript virtual tabletop for the FFG Star Wars narrative dice system (Edge of the Empire, Age of Rebellion, and Force and Destiny). Unofficial and independent. No licensed artwork, logos, fonts, or rules prose are bundled. The landing-zone schematic is original SVG geometry rendered on the server; upload your own art.

## Quick start

Requires **Node.js 24+** (uses built-in SQLite) and npm.

```sh
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` and `/socket.io` to Express on port 3001. Create an account (username 3–32 characters; password 8–128 characters), create a campaign, and use **Invite crew**. Players sign in, open the invite link, and choose a display name and color. For LAN play, use the host computer's LAN address, not `localhost`, in the link. Allow the selected port through your firewall.

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

1. **Accounts and rooms:** Sign up or sign in. Create a campaign to become its GM. Invite codes are random, persistent, and shareable. Existing memberships rejoin without changing their role. Return to campaigns by clicking the upper-left brand; sign out there.
2. **Maps:** In Scenes, upload PNG/JPG/WebP images up to 20 MB. The new map activates for everyone. Click another scene to switch. **Manage scenes** opens GM-only scene selection with Select all, Clear selection, and Delete selected. The confirmation lists affected scenes and token counts. Deleting the active scene switches everyone to the first remaining scene; deleting all scenes creates a replacement. Scene deletion removes placed tokens and their sheets, but keeps reusable uploaded images. Drag empty space or use Pan; wheel or pinch to zoom; Fit resets the camera. Camera pan/zoom is personal; the map and its content are shared. Set square/flat-top hex/no grid, size, offsets, color, and snapping. GM hide/reveal tools paint fog; brush size is adjustable. Players receive a server-composited masked image, never the original map file. Reveal entire map clears fog.
3. **Tokens:** Open Tokens, create a marker or upload an image to the reusable campaign library, then click the image to place it. Select a token and Inspect to set name, grid size, rotation, status, sheet fields, and notes. GM can assign its owner and hide it. Owners and GM can drag, use arrow keys to move a selected token, duplicate, delete, or reorder via right-click. Tablet users can edit, duplicate, delete and reorder through the token list and Inspect. Measure draws a local ruler in grid units.
4. **Portraits and handouts:** Profile stores a portrait and extra art for each campaign member. GM uploads handouts there and clicks one to display it to everyone; each user may dismiss locally, or GM can close it globally. The active handout also appears after reconnecting.
5. **System tools:** Click colored dice to build a pool; minus buttons remove dice. Roll executes cryptographic random selection on the server. Results and individual face tooltips appear in Comms and Roll log. Opposed success/failure and advantage/threat cancel; triumph/despair and light/dark remain independent. Click a destiny side to flip a point; GM can set initial totals. Initiative sorts PC/NPC slots by successes, advantages, then PC priority; click to mark used, and advance the round to reset. Range mode shows labeled illustrative rings around your ruler origin. They are narrative guides, **not official fixed conversions** between range bands and map units.
6. **Communication:** Send messages from Comms. GM can choose a single player for a private whisper. Private messages are removed from other users' server snapshots. Roll results post automatically.

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
server/storage.ts     Storage interface and local disk adapter
server/placeholder.ts Original geometric map illustration
 tests/               Dice and ordered HTTP/WebSocket integration checks
 docs/PROTOCOL.md     Socket events, payloads, persistence model and invariants
```

The server is authoritative. Clients submit intentions, not replacement campaign objects. Every action validates its payload with Zod, verifies membership/ownership/GM permission, applies the change to a fresh state, commits it, then emits a per-user `state` snapshot. Token dragging predicts locally, submits positions at approximately 14 Hz, and interpolates received positions. Final coordinates are server-snapped and clamped to the map. On reconnect the client joins its current room and receives a fresh persisted snapshot. Offline edits are rejected rather than queued.

SQLite stores users, hashed opaque sessions, campaign metadata with a versioned JSON state, memberships, and asset file references. Maps, tokens, character sheets, messages, destiny and initiative are nested in that atomic campaign state. See [the data model and protocol](docs/PROTOCOL.md).

Uploads have a 20 MB request file limit and a 40-megapixel decoded image limit. The server checks decoded format, re-encodes to WebP, removes metadata and original filenames from storage keys, and uses random UUID paths. Files are accessible through authenticated campaign routes, never an open upload directory. The storage adapter can later use S3 while retaining those authorization checks.

Passwords use scrypt with a per-account salt. Sessions use random 256-bit tokens, are stored as SHA-256 hashes, and expire after 30 days. Cookies are HttpOnly and SameSite=Strict. Mutating requests reject mismatched origins. Authentication, upload, and socket action rate limits are included.

## Verification

```sh
npm test
npm run build
npm audit
```

The test suite checks all seven dice, cancellation, uncancelled special symbols, force pips, deterministic rolls, bad pools, and face totals. The ordered integration test starts an isolated temporary database and real HTTP/Socket.IO server and covers accounts, room joins, image uploads and server fog compositing, token ownership, hidden-token filtering, portraits, handouts, dice, destiny, initiative, chat, reconnection and persistence. It needs permission to open and connect to localhost sockets. `npm run build` includes strict TypeScript checking.

Manual QA: use separate browser profiles for GM and player; test upload, map switch, drag, hide/reveal, whisper privacy, refresh, and reconnect. Test pinch and pointer gestures on your target tablet before a live session.

## Scope and next steps

This is a functional single-server foundation. Snapshot broadcasting is simple and reliable for small groups; large maps or many players will benefit from incremental updates, raster tile caches, and a Socket.IO adapter. Fog is a GM-painted mask, not dynamic lighting or line-of-sight; token visibility uses the token center. Revealed information cannot be removed from a player's memory or previously captured images. There is no undo, account recovery, campaign deletion UI, invite rotation, or per-user storage quota yet. The last 500 chat/roll entries are retained per campaign; fog is capped at 500 strokes per map. Token moves use last accepted server write when multiple controllers drag simultaneously.

Roadmap:

- Audio/music: synchronized playlists, volume controls, licensed uploads, reconnect-aware playback positions.
- Character import: validated import adapters, preview/diff, field mapping, versioned character records.
- Macros: saved dice pools and parameterized actions with an allowlisted interpreter (no arbitrary code execution).
- Operational hardening: invite rotation, password reset, quotas, backups, audit logs, database migrations, paginated history.
- Table tools: undo/redo, token movement locks, image tiling, shared GM camera pings, dynamic lighting and accessibility enhancements.

Numerical dice behavior was checked against the publisher's [dice overview](https://www.fantasyflightgames.com/en/news/2013/2/27/that-star-wars-feeling/). No publisher artwork or rules prose is reproduced.

## This workspace's live preview

The current local preview uses `.tools/qa-data` for its persistent database and uploads, selected in the ignored `.env` file. Keep that directory: it includes the campaign and map added during preview. Running `npm start` here uses that same data. A fresh checkout without `.env` uses `data/`. Neither directory is included in Docker images or source control.

On Windows, after installing dependencies, `./Start-VTT.ps1` also launches the app (and builds it if needed), without requiring npm on the runtime PATH.
