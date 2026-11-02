# Protocol and data model

## Socket contract

Authenticate with the same HttpOnly session cookie used by HTTP. Connections do not trust client-supplied user IDs. The socket starts without a campaign. Emit `room:join` after every connect/reconnect; send only after its acknowledgement succeeds.

Every request accepts a final acknowledgement callback returning `{ ok: true, revision?: number }` or `{ error: string }`. Acknowledgement timeouts are ambiguous: refresh the snapshot before retrying non-idempotent actions (roll, flip, duplicate, chat). Changes are committed before broadcasting. The only server push event is `state`, a complete viewer-filtered `Campaign`. There is no client event accepting arbitrary state. One socket views one campaign at a time.

| Client event       | Payload                                                                 | Authorization / effect                                               |
| ------------------ | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `room:join`        | `{roomId}`                                                              | Member; restores `state`                                             |
| `map:create`       | `{name, assetId?}`                                                      | GM; create scene and activate                                        |
| `map:activate`     | `{id}`                                                                  | GM; switch everyone's active map                                     |
| `map:delete` | `{ids: string[]}` | GM; atomically remove selected scenes and their tokens; retain uploads; switch active map or create replacement when none remain |
| `map:grid`         | `{type,size,offsetX,offsetY,color,snap}`                                | GM; replace active grid configuration                                |
| `fog:stroke`       | `{erase,size,points:[{x,y}]}`                                           | GM; paint/reveal active map; max 1,000 points/stroke                 |
| `fog:clear`        | `{}`                                                                    | GM; reveal active map                                                |
| `token:create`     | `{name,assetId?,ownerId?}`                                              | Member; players create only their own; GM may assign owner           |
| `token:move`       | `{id,x,y}`                                                              | Owner/GM; snap and clamp coordinates                                 |
| `token:update`     | `{id,name?,size?,rotation?,status?,hidden?,ownerId?,sheet?,assetId?,appearance?}`            | Owner/GM; `hidden` and `ownerId` GM-only; supplied sheet is complete |
| `token:duplicate`  | `{id}`                                                                  | Owner/GM; copy with new ID and position offset                       |
| `token:delete`     | `{id}`                                                                  | Owner/GM                                                             |
| `token:layer`      | `{id,front:boolean}`                                                    | Owner/GM; update z order                                             |
| `profile:update`   | `{name?,color?,portrait?,art?:string[]}`                                | Own membership profile; references owned assets                      |
| `handout:show`     | `{assetId,title}`                                                       | GM; persisted active popup                                           |
| `handout:close`    | `{}`                                                                    | GM; remove active popup                                              |
| `dice:roll`        | `{boost?,setback?,ability?,difficulty?,proficiency?,challenge?,force?}` | Member; integer counts, max 30/type, 60 total, at least 1            |
| `destiny:flip`     | `{side:'light'                                                          | 'dark'}`                                                             | Member; decrement selected side and increment opposite |
| `destiny:set`      | `{light,dark}`                                                          | GM; 0–30 each                                                        |
| `initiative:add`   | `{type:'PC'                                                             | 'NPC',success,advantage}`                                            | GM; sorted slot insertion                              |
| `initiative:use`   | `{id}`                                                                  | GM or player for PC slots; toggle used                               |
| `initiative:next`  | `{}`                                                                    | GM; increment round, reset used flags                                |
| `initiative:clear` | `{}`                                                                    | GM; reset encounter                                                  |
| `chat:send`        | `{text,to?}`                                                            | Member; optional recipient requires GM; max 2,000 characters         |

## HTTP endpoints

- `POST /api/auth/signup`, `POST /api/auth/login`: `{username,password}`; set session cookie.
- `GET /api/me`: public, returns signed-in user or null.
- `POST /api/logout`: revoke current session and its sockets.
- `GET /api/rooms`: campaign summaries for current user.
- `POST /api/rooms`: `{name}`, creates room and GM membership.
- `POST /api/join`: `{code,name,color}`, adds Player membership once.
- `POST /api/rooms/:room/assets`: multipart `file` and `kind` (`map`, `token`, `art`, `handout`); map/handout GM-only.
- `GET /api/rooms/:room/assets/:asset`: authenticated, per-viewer authorized asset bytes.
- `GET /api/rooms/:room/map/:map`: GM original / player server-masked map; players only access active map.
- `GET /api/health`: `{ok:true}` for deployment readiness.

## SQLite tables

| Table         | Columns / relationships                                                      |
| ------------- | ---------------------------------------------------------------------------- |
| `users`       | `id` UUID PK; unique normalized `username`; `password` salt:scrypt digest    |
| `sessions`    | `token` SHA-256 PK; `user_id` FK; `expires` UTC epoch milliseconds           |
| `campaigns`   | `id` UUID PK; `name`; unique random `invite`; `state` JSON                   |
| `memberships` | composite PK (`campaign_id` FK, `user_id` FK); query index for room listings |
| `assets`      | `id` UUID PK; `campaign_id` FK; `owner_id` FK; generated `filename`          |

Campaign state and memberships commit together in a transaction. WAL is enabled. Each successfully saved mutation increments the campaign `revision`. Reads are fresh for each mutation, including after asynchronous upload decoding. File writes precede asset metadata publication; a crash can leave an unreferenced file, never a published partial upload. A future cleanup job can remove unreferenced blobs.

## Campaign JSON

The definitive TypeScript contract is `shared/types.ts`.

- Campaign: `id`, `name`, `invite`, `revision`, `activeMapId`, `maps[]`, `tokens[]`, `assets[]`, `members[]`, `messages[]`, `destiny`, `initiative`, optional `handout`.
- Member: `userId`, `name`, hex `color`, `role` (`gm`/`player`), optional portrait asset, art asset IDs.
- Map: UUID, name, optional original asset, pixel width/height, grid, ordered fog strokes. `fogRevision` is a player-safe signature for reloading the masked image.
- Grid: `type` (`none`/`square`/`hex`), pixel `size`, offsets, color, `snap`. Hex size is corner-to-corner diameter, flat-top orientation; coordinates snap to axial hex centers.
- Fog stroke: UUID, `erase`, pixel brush `size`, ordered map-coordinate points. Strokes compose in order.
- Token: UUID, map UUID, owner user UUID, name, optional image asset, center x/y, size in grid units, rotation degrees, status text, hidden flag, z order, character sheet.
- Sheet: `wounds`, `woundThreshold`, `strain`, `strainThreshold`, `soak`, `defense`, `credits`, free-text `notes`.
- Asset: UUID, owner user UUID, kind, sanitized display name, width/height. Stored as UUID.webp.
- Message: UUID, sender user UUID and display name snapshot, text, epoch time, optional recipient, optional roll.
- Roll: each die's type, zero-based face index and symbols; plus resolved net symbols. Triumph includes its success contribution; despair includes its failure contribution. Only success/failure and advantage/threat cancel.
- Destiny: light and dark counts.
- Initiative: round plus sorted slots, each UUID/type/success/advantage/used. Slots are not assigned to characters.
- Handout: unique presentation UUID, asset UUID and title. Dismissal is client-local; GM closing is persistent.

## Privacy and consistency

Players receive only the active map, no original map asset IDs or fog stroke coordinates, no hidden or fog-obscured token entries, no other owners' sheet values, and no whispers addressed to someone else. GM-only library assets are omitted unless publicly referenced by a visible token, profile, or active handout. Hidden entities previously seen cannot be erased from a hostile client's saved historical state; this is the same information limit as a physical table.

Canvas camera, measurement/range guides, selection and local handout dismissal are personal UI state, not campaign state. Everything affecting the shared game persists on the server. Reconnection is snapshot-based, without offline replay. Incremental protocol versions and migrations should be introduced before changing stored field meanings.

Token appearance is optional for backwards compatibility: `{background, textColor, outlineColor}` are #RRGGBB colors, `outlineWidth` is 0–12 screen pixels, `shape` is circle/square, and `imageFit` is cover/contain. `token:update.assetId` accepts an authorized asset UUID, or null to remove the image. Owners can keep a previously GM-assigned image while editing its style. New images must be owned by the caller, unless they are GM. Uploaded images are processed through the existing authenticated upload route.
