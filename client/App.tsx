import {ActionQueue} from "./action-queue";
import { serverConfig } from "./runtime";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  Campaign,
  Die,
  Pool,
  Token,
  Member,
  Sheet,
  TokenAppearanceStyle,
  Asset,
  Grid,
  Symbols,
} from "../shared/types";
import { api, assetUrl, upload } from "./api";
import { importSave } from "./saves";
import SaveTools from "./SaveTools";
import TokenAppearance from "./TokenAppearance";
import MapCanvas, { type Tool } from "./MapCanvas";
import CharacterTab from "./CharacterTab";
import InitiativePopout, { SlotFace } from "./InitiativePopout";
import NumberField from "./NumberField";
import SliderField from "./SliderField";
import NotesPanel from "./NotesPanel";
import TokenDraftModal, { type TokenDraftStart } from "./TokenDraft";
import { characterTokenStats } from "../shared/character";
const diceNames: Die[] = [
  "boost",
  "ability",
  "proficiency",
  "setback",
  "difficulty",
  "challenge",
  "force",
];
const dieLetter: Record<Die, string> = {
  boost: "B",
  ability: "A",
  proficiency: "P",
  setback: "S",
  difficulty: "D",
  challenge: "C",
  force: "F",
};
const resultText = (s: Symbols) =>
  Object.entries(s)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${k}`)
    .join(" · ") || "No net symbols";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Upload({
  label,
  onFile,
  busy = false,
}: {
  label: string;
  onFile: (file: File) => void;
  busy?: boolean;
}) {
  return (
    <label className={`upload-button ${busy ? "disabled" : ""}`}>
      {busy ? "Uploading…" : label}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
export default function App() {
  const [user, setUser] = useState<{ id: string; username: string } | null>(
      null,
    ),
    [ready, setReady] = useState(false),
    [cloudConfig, setCloudConfig] = useState<{
      cloud: boolean;
      socketPath?: string;
    }>({ cloud: false }),
    [error, setError] = useState(""),
    [saveOpen, setSaveOpen] = useState(false),
    [joinFile, setJoinFile] = useState<File | null>(null),
    [rooms, setRooms] = useState<{ id: string; name: string }[]>([]),
    [room, setRoom] = useState(
      new URLSearchParams(location.search).get("room") || "",
    ),
    [state, setState] = useState<Campaign | null>(null),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false);
  const [tool, setTool] = useState<Tool>("select"),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("comms"),
    [leftTab, setLeftTab] = useState("scenes"),
    [pool, setPool] = useState<Pool>({}),
    [brush, setBrush] = useState(160),
    [rangeBase,setRangeBase] = useState(64),
    [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(
      null,
    ),
    [dismissed, setDismissed] = useState(""),
    [sheetOpen, setSheetOpen] = useState(false),
    [inviteOpen, setInviteOpen] = useState(false);
  const [manageScenes, setManageScenes] = useState(false);
  const [newSize, setNewSize] = useState(1);
  const [tokenDraft, setTokenDraft] = useState<TokenDraftStart | null>(null);
  const [tokenLook, setTokenLook] = useState<{
    assetId: string | null;
    backAssetId: string | null;
    appearance?: TokenAppearanceStyle;
  } | null>(null);
  const [rangeColor, setRangeColor] = useState("#f2be74");
  const [placing, setPlacing] = useState(false);
  const [libraryOwner, setLibraryOwner] = useState("");
  const [poolLabel, setPoolLabel] = useState("");
  const [secretRoll, setSecretRoll] = useState(false);
  const [initType, setInitType] = useState("PC");
  const leaving = useRef(false);
  const [sceneSelection, setSceneSelection] = useState<string[]>([]);
  const [confirmScenes, setConfirmScenes] = useState(false);
  const [deletingScenes, setDeletingScenes] = useState(false);
  const actions = useRef<ActionQueue | null>(null);
  const socket = useRef<Socket | null>(null),
    chatEnd = useRef<HTMLDivElement>(null);
  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    Promise.all([api("/me"), serverConfig()])
      .then(([u, c]) => {
        setUser(u);
        setCloudConfig(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (user)
      api("/rooms")
        .then(setRooms)
        .catch((e) => setError(e.message));
  }, [user, room]);
  useEffect(() => {
    if (!user || !room) {
      setState(null);
      return;
    }
    const s = io({
      autoConnect: false,
      ...(cloudConfig.cloud
        ? { path: cloudConfig.socketPath, transports: ["websocket"], addTrailingSlash: false }
        : {}),
    });
    socket.current = s;
    const makeQueue = () => new ActionQueue((event,payload,done)=>{
      s.timeout(cloudConfig.cloud?30000:5000).emit(event,payload,(err:any,res:any)=>{
        if(err) {
          setError(`No response to ${event}. Reconnecting to refresh the table; check the result before retrying.`);
          actions.current?.close();
          s.disconnect();s.connect();
        } else if(res?.error) setError(res.error);
        done(!err&&!res?.error);
      });
    });
    s.on("connect", () => {
      actions.current?.close();actions.current=makeQueue();
      s.emit("room:join", { roomId: room }, (r: any) => {
        if (r.error) {
          setError(r.error);
          if (r.error === "Campaign access denied") leave();
        } else setConnected(true);
      });
    });
    s.on("disconnect", () => {setConnected(false);actions.current?.close();});
    s.on("connect_error", (e) => setError(e.message));
    s.on("state", (c: Campaign) => setState(c));
    // The GM removed this player (or they left on another device): return to the campaign list.
    s.on("kicked", () => {
      if (!leaving.current) setError("You are no longer part of this table.");
      leaving.current = false;
      leave();
    });
    s.connect();
    return () => {
      actions.current?.close();actions.current=null;
      s.disconnect();
      socket.current = null;
      setConnected(false);
    };
  }, [room, user, cloudConfig]);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length, tab]);
  const send = (
    event: string,
    payload: unknown,
    complete?: (ok: boolean) => void,
  ) => {
    if (!socket.current?.connected) {
      complete?.(false);
      setError("Connection lost. Wait for reconnection before making changes.");
      return;
    }
    actions.current?.push(event,payload,complete);
  };
  const enter = (id: string) => {
    setRoom(id);
    history.replaceState({}, "", `?room=${id}`);
  };
  const leave = () => {
    setRoom("");
    setSelected("");
    history.replaceState({}, "", "/");
  };
  const deleteAsset = (a: Asset) => {
    if (
      !window.confirm(
        `Delete "${a.name}" from the library? Tokens already on the map using it become plain markers.`,
      )
    )
      return;
    send("asset:delete", { assetId: a.id });
  };
  const leaveTable = () => {
    if (!window.confirm("Leave this table? You can rejoin later with the invite code.")) return;
    leaving.current = true;
    send("member:leave", {}, (ok) => {
      if (ok) leave();
      else leaving.current = false;
    });
  };
  const removePlayer = (m: { userId: string; name: string }) => {
    if (
      !window.confirm(
        `Remove ${m.name} from the table? Their tokens will be given to you. They can rejoin with the invite code.`,
      )
    )
      return;
    send("member:remove", { userId: m.userId });
  };
  const doUpload = (kind: string, file: File, after?: (a: Asset) => void) =>
    run(async () => {
      setBusy(true);
      try {
        if (file.size > 20 * 1024 * 1024)
          throw new Error("Images must be 20 MB or smaller");
        const a = await upload(room, kind, file);
        after?.(a);
      } finally {
        setBusy(false);
      }
    });
  const toast = error && (
    <div role="alert" className="toast">
      {error}
      <button aria-label="Dismiss notification" onClick={() => setError("")}>
        ×
      </button>
    </div>
  );
  if (!ready) return <div className="loading">Establishing uplink…</div>;
  if (!user)
    return (
      <div className="auth-page">
        <div className="starfield" />
        <header className="brand">
          <span className="brand-icon">◈</span> ARCHIVE{" "}
          <small>VIRTUAL TABLETOP</small>
        </header>
        <main className="auth-layout">
          <section className="auth-intro">
            <div className="eyebrow">YOUR CREW. YOUR GALAXY.</div><div className="aurebesh-trim" aria-hidden="true">Archive uplink online</div>
            <h1>
              Every great story
              <br />
              starts at the table<span>.</span>
            </h1>
            <p>
              A shared command center for your next adventure.
              <br />
              Bring the map. Gather your crew. Let the dice decide.
            </p>
            <div className="orbital">
              <div />
              <span>07</span>
              <small>UNEXPLORED SECTOR</small>
            </div>
            <div className="auth-features">
              <span>◈ Narrative dice</span>
              <span>◎ Shared battle maps</span>
              <span>↗ Real-time play</span>
            </div>
          </section>
          <form
            className="auth-card"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(async () =>
                setUser(await api("/guest", { name: f.get("name") })),
              );
            }}
          >
            <div className="eyebrow">ESTABLISH CONNECTION</div>
            <h2>Welcome aboard.</h2>
            <p>
              Enter a display name to host or join. No account or password
              needed.
            </p>
            <Field label="Display name">
              <input
                name="name"
                required
                maxLength={80}
                placeholder="Your callsign"
                autoComplete="nickname"
              />
            </Field>
            <button className="primary full">Enter tabletop ↗</button>
            <p>
              Your browser remembers you. Export saves to keep your campaign and
              characters when switching devices or clearing browser data.
            </p>
          </form>
        </main>
        {toast}
      </div>
    );
  if (!room)
    return (
      <div className="lobby">
        <header className="topbar">
          <div className="brand">
            <span className="brand-icon">◈</span> ARCHIVE{" "}
            <small>CAMPAIGN CONTROL</small>
          </div>
          <div className="row">
            <span>{user.username}</span>
            <span className="badge">GUEST SESSION</span>
          </div>
        </header>
        <main className="lobby-main">
          <div className="eyebrow">TRANSMISSION RECEIVED</div>
          <h1>
            Your next adventure
            <br />
            is waiting.
          </h1>
          <p className="muted">Open a campaign or gather a new crew.</p>
          <div className="lobby-columns">
            <section>
              <h2>
                Your campaigns{" "}
                <small>{rooms.length.toString().padStart(2, "0")}</small>
              </h2>
              {rooms.length ? (
                rooms.map((r, i) => (
                  <button
                    className="campaign-card"
                    key={r.id}
                    onClick={() => enter(r.id)}
                  >
                    <span className="campaign-art">◎</span>
                    <span>
                      <small>CAMPAIGN {String(i + 1).padStart(2, "0")}</small>
                      <strong>{r.name}</strong>
                      <span>Open command center</span>
                    </span>
                    <b>↗</b>
                  </button>
                ))
              ) : (
                <div className="empty-card">
                  No active campaigns.
                  <br />
                  Create one to begin your story.
                </div>
              )}
              <form
                className="create-room"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  run(async () =>
                    enter((await api("/rooms", { name: f.get("name") })).id),
                  );
                }}
              >
                <input
                  aria-label="Campaign name"
                  name="name"
                  placeholder="Name your new campaign"
                  required
                  maxLength={80}
                />
                <button className="primary">+ Create campaign</button>
              </form>
              <section className="panel">
                <h3>Import table data</h3>
                <p>
                  Upload a campaign or visible-table save to create a new table.
                  Existing tables stay intact.
                </p>
                <input
                  aria-label="Restore table save"
                  type="file"
                  accept=".json,application/json"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      run(async () => {
                        setBusy(true);
                        try {
                          enter((await importSave("/restore", file)).id);
                        } finally {
                          setBusy(false);
                        }
                      });
                  }}
                />
              </section>
            </section>
            <form
              className="panel join-card"
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                run(async () =>
                  enter(
                    (joinFile
                      ? await importSave("/join-save", joinFile, {
                          code: String(data.code),
                        })
                      : await api("/join", data)
                    ).id,
                  ),
                );
              }}
            >
              <span className="eyebrow">HAVE AN INVITATION?</span>
              <h2>Join the crew</h2>
              <Field label="Invite code">
                <input
                  name="code"
                  required
                  defaultValue={
                    new URLSearchParams(location.search).get("invite") || ""
                  }
                  placeholder="Paste your GM’s invite code"
                />
              </Field>
              <Field label="Display name">
                <input
                  name="name"
                  required
                  maxLength={80}
                  defaultValue={user.username}
                />
              </Field>
              <Field label="Your token color">
                <input name="color" type="color" defaultValue="#65c8c3" />
              </Field>
              <Field label="Player save (optional)">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setJoinFile(e.target.files?.[0] || null)}
                />
              </Field>
              <p className="muted">
                A player save restores your saved name, color, portrait, art,
                tokens, and sheets. Keep the file private.
              </p>
              <button className="primary full">
                {joinFile ? "Join with player save ↗" : "Join campaign ↗"}
              </button>
            </form>
          </div>
        </main>
        {toast}
      </div>
    );
  if (!state)
    return (
      <div className="loading">
        Joining campaign…<button onClick={leave}>Back to campaigns</button>
        {toast}
      </div>
    );
  const me = state.members.find((m) => m.userId === user.id)!,
    gm = me.role === "gm",
    map = state.maps.find((m) => m.id === state.activeMapId)!,
    token = state.tokens.find((t) => t.id === selected),
    editable = token && (gm || token.ownerId === user.id),
    myArt = state.assets.filter(
      (a) => a.ownerId === user.id && a.kind === "art",
    );
  const libraryOwnerId = gm && state.members.some((m) => m.userId === libraryOwner) ? libraryOwner : user.id,
    libraryOwnerName = state.members.find((m) => m.userId === libraryOwnerId)?.name ?? "";
  const updateGrid = (patch: Partial<Grid>) =>
    send("map:grid", { ...map.grid, ...patch });
  const visibleTokens = state.tokens.filter((t) => t.mapId === map.id);
  return (
    <div className="tabletop" onClick={() => menu && setMenu(null)}>
      <header className="topbar">
        <button className="brand brand-button" onClick={leave}>
          <span className="brand-icon">◈</span>
          <span>
            ARCHIVE<small>VIRTUAL TABLETOP</small>
          </span>
        </button>
        <div className="campaign-title">
          <span className="divider" />
          <div>
            <small>CAMPAIGN</small>
            <strong>{state.name}</strong>
          </div>
          <span className="badge">{gm ? "GM VIEW" : "PLAYER VIEW"}</span>
          <div className="crew-manifest">
            <span className="eyebrow">CREW MANIFEST</span>
            <div className="crew-faces">
              {state.members.map((m) => (
                <span
                  key={m.userId}
                  title={`${m.name} · ${m.role}`}
                  style={{ borderColor: m.color }}
                >
                  {m.portrait ? (
                    <img src={assetUrl(room, m.portrait)} alt={m.name} />
                  ) : (
                    m.name.slice(0, 2)
                  )}
                </span>
              ))}
              <small>{state.members.length} members</small>
            </div>
            {gm && state.members.length > 1 && (
              <details className="crew-manage">
                <summary>Manage players</summary>
                <div className="crew-popover">
                  {state.members
                    .filter((m) => m.role !== "gm")
                    .map((m) => (
                      <div className="crew-row" key={m.userId}>
                        <span style={{ borderColor: m.color }}>
                          {m.portrait ? (
                            <img src={assetUrl(room, m.portrait)} alt="" />
                          ) : (
                            m.name.slice(0, 2)
                          )}
                        </span>
                        <em>{m.name}</em>
                        <button
                          className="danger-button"
                          aria-label={`Remove ${m.name} from the table`}
                          onClick={() => removePlayer(m)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        </div>
        <div className="top-actions">
          <span className={`connection ${connected ? "" : "offline"}`}>
            <i />
            {connected ? "Session live" : "Reconnecting"}
          </span>
          <button onClick={() => setSaveOpen(true)}>Save / import / export</button>
          {gm && (
            <button onClick={() => setInviteOpen(true)}>↗ Invite crew</button>
          )}
          <button
            className="avatar"
            style={{ borderColor: me.color }}
            onClick={() => setLeftTab("profile")}
            title="Your profile"
          >
            {me.name.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>
      <aside className="left-panel">
        <nav className="panel-tabs">
          {["scenes", "tokens", "profile", "character"].map((t) => (
            <button
              className={leftTab === t ? "active" : ""}
              key={t}
              onClick={() => setLeftTab(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="left-content">
          {leftTab === "scenes" && (
            <>
              <div className="section-heading">
                <h3>Scene collection</h3>
                <span>{state.maps.length.toString().padStart(2, "0")}</span>
              </div>
              {gm && (
                <button
                  className="manage-scenes-button full"
                  onClick={() => {
                    setSceneSelection([]);
                    setConfirmScenes(false);
                    setManageScenes(true);
                  }}
                >
                  Manage scenes
                </button>
              )}
              {state.maps.map((m, i) => (
                <button
                  disabled={!gm}
                  className={`scene-card ${m.id === map.id ? "active" : ""}`}
                  key={m.id}
                  onClick={() => send("map:activate", { id: m.id })}
                >
                  <div className="scene-preview">
                    {m.assetId ? (
                      <img src={assetUrl(room, m.assetId)} alt="" />
                    ) : (
                      <span>◎</span>
                    )}
                    <span className="scene-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {m.id === map.id && <b>ACTIVE</b>}
                  </div>
                  <strong>{m.name}</strong>
                  <small>
                    {m.width} × {m.height} · {m.grid.type} grid
                  </small>
                </button>
              ))}
              {gm && (
                <>
                  <Upload
                    busy={busy}
                    label="+ Upload a map"
                    onFile={(f) =>
                      doUpload("map", f, (a) =>
                        send("map:create", {
                          name: a.name.replace(/\.[^.]+$/, ""),
                          assetId: a.id,
                        }),
                      )
                    }
                  />
                  <p className="hint">PNG, JPG or WebP · up to 20 MB</p>
                  <div className="section-heading separated">
                    <h3>Grid settings</h3>
                    <span>⌗</span>
                  </div>
                  <Field label="Grid type">
                    <select
                      value={map.grid.type}
                      onChange={(e) =>
                        updateGrid({ type: e.target.value as Grid["type"] })
                      }
                    >
                      <option value="square">Square</option>
                      <option value="hex">Hexagonal</option>
                      <option value="none">None</option>
                    </select>
                  </Field>
                  <SliderField
                    label="Grid size"
                    min={16}
                    max={256}
                    value={map.grid.size}
                    onCommit={(v) => updateGrid({ size: v })}
                  />
                  <Field label="Color">
                    <input
                      type="color"
                      value={map.grid.color}
                      onChange={(e) => updateGrid({ color: e.target.value })}
                    />
                  </Field>
                  <div className="two-col">
                    {(["offsetX", "offsetY"] as const).map((k) => (
                      <Field
                        key={k}
                        label={k === "offsetX" ? "Offset X" : "Offset Y"}
                      >
                        <NumberField
                          label={k === "offsetX" ? "Grid offset X in pixels" : "Grid offset Y in pixels"}
                          value={map.grid[k]}
                          min={-1000}
                          max={1000}
                          onCommit={(v) => updateGrid({ [k]: v })}
                        />
                      </Field>
                    ))}
                  </div>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={map.grid.snap}
                      onChange={(e) => updateGrid({ snap: e.target.checked })}
                    />
                    Snap tokens to grid
                  </label>
                  <div className="section-heading separated">
                    <h3>Fog of war</h3>
                    <span>◌</span>
                  </div>
                  <p className="hint">
                    Use the hide and reveal brushes on the map.
                  </p>
                  <Field label={`Brush size · ${brush}px`}>
                    <input
                      type="range"
                      min={20}
                      max={600}
                      step={10}
                      value={brush}
                      onChange={(e) => setBrush(+e.target.value)}
                    />
                    <NumberField
                      label="Brush size in pixels"
                      min={20}
                      max={600}
                      value={brush}
                      onCommit={setBrush}
                    />
                  </Field>
                  <button
                    className="full"
                    onClick={() => send("fog:clear", {})}
                  >
                    Reveal entire map
                  </button>
                </>
              )}
            </>
          )}
          {leftTab === "tokens" && (
            <>
              <div className="section-heading">
                <h3>On this scene</h3>
                <span>{visibleTokens.length}</span>
              </div>
              <p className="muted">Select a token to rename, customize, or delete it. Players can edit their own tokens; the GM can edit any token.</p>
              {visibleTokens.map((t) => (
                <button
                  key={t.id}
                  className={`token-row ${selected === t.id ? "active" : ""}`}
                  onClick={() => {
                    setSelected(t.id);
                    setSheetOpen(true);
                  }}
                >
                  <span className="token-thumb">
                    {t.assetId ? (
                      <img src={assetUrl(room, t.assetId)} alt="" />
                    ) : (
                      t.name.slice(0, 2)
                    )}
                  </span>
                  <span>
                    <strong>{t.name}</strong>
                    <small>
                      {state.members.find((m) => m.userId === t.ownerId)?.name}
                      {t.hidden ? " · hidden" : ""}
                    </small>
                  </span>
                  <span>›</span>
                </button>
              ))}
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setTokenDraft({ name: String(f.get("name")), size: newSize });
                  e.currentTarget.reset();
                }}
              >
                <input
                  name="name"
                  placeholder="Token name"
                  aria-label="New token name"
                  required
                  maxLength={80}
                />
                <button className="full">+ Create marker token…</button>
              </form>
              <Field label={`New token size · ${newSize} grid ${newSize === 1 ? "square" : "squares"}`}>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={newSize}
                  aria-label="New token size slider"
                  onChange={(e) => setNewSize(+e.target.value)}
                />
                <NumberField
                  label="New token size in grid squares"
                  decimals
                  min={0.5}
                  max={10}
                  value={newSize}
                  onCommit={setNewSize}
                />
              </Field>
              <div className="section-heading separated">
                <h3>{libraryOwnerId === user.id ? "My token library" : `${libraryOwnerName}'s token library`}</h3>
              </div>
              {gm && state.members.length > 1 && (
                <Field label="Library">
                  <select
                    value={libraryOwnerId}
                    onChange={(e) => setLibraryOwner(e.target.value)}
                  >
                    {state.members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.userId === user.id ? "My library" : `${m.name}'s library`}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {libraryOwnerId === user.id ? (
                <Upload
                  busy={busy}
                  label="+ Upload token image"
                  onFile={(f) => doUpload("token", f)}
                />
              ) : (
                <p className="hint">
                  Tokens placed from this library are controlled by {libraryOwnerName}.
                </p>
              )}
              <div className="asset-grid">
                {state.assets
                  .filter((a) => a.kind === "token" && a.ownerId === libraryOwnerId)
                  .map((a) => {
                    const tokenName = a.name.replace(/\.[^.]+$/, "");
                    return (
                      <div className="asset-tile" key={a.id}>
                        <button
                          title={`Edit and place ${a.name}`}
                          onClick={() =>
                            setTokenDraft({
                              name: tokenName,
                              assetId: a.id,
                              ownerId: gm ? libraryOwnerId : undefined,
                              size: newSize,
                            })
                          }
                        >
                          <img src={assetUrl(room, a.id)} alt={a.name} />
                          <span>{a.name}</span>
                          <small>Edit &amp; place…</small>
                        </button>
                        <button
                          className="asset-quick"
                          aria-label={`Place ${a.name} now without editing`}
                          title={`Place now at ${newSize} grid ${newSize === 1 ? "square" : "squares"}`}
                          onClick={() =>
                            send("token:create", {
                              name: tokenName,
                              assetId: a.id,
                              size: newSize,
                              ...(gm && libraryOwnerId !== user.id ? { ownerId: libraryOwnerId } : {}),
                            })
                          }
                        >
                          ⚡
                        </button>
                        <button
                          className="asset-delete"
                          aria-label={`Delete ${a.name} from the library`}
                          title="Delete from library"
                          onClick={() => deleteAsset(a)}
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
              </div>
              <p className="hint">
                Click an image to edit the token before placing it, or ⚡ to place it right away.
                Select a token on the table to edit its sheet.
              </p>
            </>
          )}
          {leftTab === "profile" && (
            <>
              <div className="section-heading">
                <h3>Your character</h3>
                <span>◈</span>
              </div>
              <div className="portrait">
                {me.portrait ? (
                  <img
                    src={assetUrl(room, me.portrait)}
                    alt="Character portrait"
                  />
                ) : (
                  <span>{me.name.slice(0, 2)}</span>
                )}
              </div>
              <Upload
                busy={busy}
                label="Upload portrait"
                onFile={(f) =>
                  doUpload("art", f, (a) =>
                    send("profile:update", { portrait: a.id }),
                  )
                }
              />
              {me.portrait && (
                <button
                  className="full"
                  onClick={() => {
                    const a = state.assets.find((x) => x.id === me.portrait);
                    if (a) deleteAsset(a);
                  }}
                >
                  Delete portrait
                </button>
              )}
              <form
                className="stack"
                key={me.userId}
                onSubmit={(e) => {
                  e.preventDefault();
                  send(
                    "profile:update",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                }}
              >
                <Field label="Display name">
                  <input
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={me.name}
                  />
                </Field>
                <Field label="Token color">
                  <input name="color" type="color" defaultValue={me.color} />
                </Field>
                <button>Save profile</button>
              </form>
              <div className="section-heading separated">
                <h3>Character art</h3>
              </div>
              <Upload
                busy={busy}
                label="+ Add character art"
                onFile={(f) =>
                  doUpload("art", f, (a) =>
                    send("profile:update", { art: [...me.art, a.id] }),
                  )
                }
              />
              <div className="asset-grid">
                {myArt.map((a) => (
                  <div className="asset-tile" key={a.id}>
                    <a
                      href={assetUrl(room, a.id)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={assetUrl(room, a.id)} alt={a.name} />
                    </a>
                    <button
                      className="asset-delete"
                      aria-label={`Delete ${a.name} from the library`}
                      title="Delete from library"
                      onClick={() => deleteAsset(a)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              {gm && (
                <>
                  <div className="section-heading separated">
                    <h3>Shared handouts</h3>
                  </div>
                  <Upload
                    busy={busy}
                    label="+ Upload handout"
                    onFile={(f) => doUpload("handout", f)}
                  />
                  {state.assets
                    .filter((a) => a.kind === "handout")
                    .map((a) => (
                      <button
                        className="token-row"
                        key={a.id}
                        onClick={() =>
                          send("handout:show", { assetId: a.id, title: a.name })
                        }
                      >
                        <span className="token-thumb">
                          <img src={assetUrl(room, a.id)} alt="" />
                        </span>
                        <span>{a.name}</span>
                        <span>↗</span>
                      </button>
                    ))}
                </>
              )}
              {!gm && (
                <>
                  <div className="section-heading separated">
                    <h3>Leave this table</h3>
                  </div>
                  <p className="hint">
                    You will be removed from the crew and your tokens go to the GM. You can rejoin with the
                    invite code.
                  </p>
                  <button className="danger-button full" onClick={leaveTable}>
                    Leave table
                  </button>
                </>
              )}
            </>
          )}
          {leftTab === "character" && (
            <CharacterTab
              member={me}
              send={send}
              setPool={setPool}
              setPoolLabel={setPoolLabel}
              connected={connected}
            />
          )}
        </div>
      </aside>
      <main className="map-area">
        <div className="map-toolbar">
          <div className="tool-group">
            {(
              [
                ["select", "↖", "Select"],
                ["pan", "✥", "Pan"],
                ["ruler", "↔", "Measure"],
                ["range", "◎", "Range bands"],
                ...(gm
                  ? [
                      ["hide", "▧", "Hide fog"],
                      ["reveal", "◌", "Reveal fog"],
                    ]
                  : []),
              ] as [Tool, string, string][]
            ).map(([t, icon, label]) => (
              <button
                key={t}
                className={tool === t ? "active" : ""}
                title={label}
                aria-label={label}
                onClick={() => setTool(t)}
              >
                {icon}
              </button>
            ))}
          </div>
          <span>
            {tool === "select"
              ? "SELECT & MOVE"
              : tool === "range"
                ? "RANGE BANDS"
                : tool.toUpperCase()}
          </span>
          {tool === "range" && <div className="range-base"><SliderField live label="Range band radius" unit=" px" min={8} max={1000} step={4} value={rangeBase} onCommit={setRangeBase} /></div>}
          {tool === "range" && (
            <div className="range-colors" role="group" aria-label="Range band color">
              {["#f2be74", "#ff5a5f", "#65d4c1", "#ffffff", "#7aa2ff", "#d38cff", "#000000"].map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${rangeColor.toLowerCase() === c ? "active" : ""}`}
                  style={{ background: c }}
                  aria-label={`Range band color ${c}`}
                  onClick={() => setRangeColor(c)}
                />
              ))}
              <input type="color" aria-label="Custom range band color" value={rangeColor} onChange={(e) => setRangeColor(e.target.value)} />
            </div>
          )}
          {token && gm && (
            <button
              className="inspect"
              aria-pressed={token.hidden}
              title={token.hidden ? "Hidden from players. Click to show." : "Visible to players. Click to hide."}
              onClick={() => send("token:update", { id: token.id, hidden: !token.hidden })}
            >
              {token.hidden ? "◌ Show to players" : "◉ Hide from players"}
            </button>
          )}
          {token && (
            <button className="inspect" onClick={() => setSheetOpen(true)}>
              ◈ {token.name} · Rename / edit
            </button>
          )}
        </div>
        <MapCanvas
          state={state}
          userId={user.id}
          tool={tool}
          brush={brush}
          rangeBase={rangeBase}
          rangeColor={rangeColor}
          selected={selected}
          onSelect={setSelected}
          send={send}
          onMenu={(id, x, y) => setMenu({ id, x, y })}
        />
        <NotesPanel value={me.notes ?? ""} send={send} />
      </main>
      <aside className="right-panel">
        <section className="destiny">
          <div className="section-heading">
            <h3>Destiny pool</h3>
            <span>↔</span>
          </div>
          <div className="destiny-points">
            <button
              onClick={() => send("destiny:flip", { side: "light" })}
              title="Flip a light point to dark"
            >
              <span className="light-orb" style={{ backgroundImage: "url(/destiny/lightside.png)" }}>{state.destiny.light}</span>
              <span>LIGHT SIDE</span>
            </button>
            <span className="muted">⇄</span>
            <button
              onClick={() => send("destiny:flip", { side: "dark" })}
              title="Flip a dark point to light"
            >
              <span className="dark-orb" style={{ backgroundImage: "url(/destiny/darkside.png)" }}>{state.destiny.dark}</span>
              <span>DARK SIDE</span>
            </button>
          </div>
          {gm && (
            <details>
              <summary>Set pool</summary>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  send("destiny:set", {
                    light: Number(f.get("light")),
                    dark: Number(f.get("dark")),
                  });
                }}
              >
                <input
                  aria-label="Light points"
                  name="light"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={state.destiny.light}
                />
                <input
                  aria-label="Dark points"
                  name="dark"
                  type="number"
                  min={0}
                  max={30}
                  defaultValue={state.destiny.dark}
                />
                <button>Set</button>
              </form>
            </details>
          )}
        </section>
        <section className="dice-panel">
          <div className="section-heading">
            <h3>Narrative dice</h3>
            <button
              className="text-button"
              onClick={() => {
                setPool({});
                setPoolLabel("");
              }}
            >
              Clear
            </button>
          </div>
          <div className="dice-tray">
            {diceNames.map((d) => (
              <div key={d}>
                <button
                  title={`Add ${d}`}
                  aria-label={`Add ${d} die`}
                  className={`die supplied-die ${d}`}
                  onClick={() =>
                    setPool((p) => ({ ...p, [d]: (p[d] || 0) + 1 }))
                  }
                >
                  <img src={`/dice/${d}.png`} alt="" />
                </button>
                <span>{pool[d] || 0}</span>
                <button
                  className="die-minus"
                  aria-label={`Remove ${d} die`}
                  onClick={() =>
                    setPool((p) => ({
                      ...p,
                      [d]: Math.max(0, (p[d] || 0) - 1),
                    }))
                  }
                >
                  −
                </button>
              </div>
            ))}
          </div>
          {poolLabel && <p className="pool-picked">Rolling: {poolLabel}</p>}
          {gm && (
            <label className="secret-roll">
              <input
                type="checkbox"
                checked={secretRoll}
                onChange={(e) => setSecretRoll(e.target.checked)}
              />
              Hide this roll from players (GM only)
            </label>
          )}
          <button
            className="primary full roll-button"
            disabled={!Object.values(pool).some(Boolean) || !connected}
            onClick={() => {
              send("dice:roll", {
                pool,
                ...(poolLabel ? { label: poolLabel } : {}),
                ...(gm && secretRoll ? { secret: true } : {}),
              });
              setPoolLabel("");
            }}
          >
            ◇ Roll dice pool{" "}
            <span>{Object.values(pool).reduce((a, b) => a + b, 0)}</span>
          </button>
        </section>
        <nav className="panel-tabs">
          <button
            className={tab === "comms" ? "active" : ""}
            onClick={() => setTab("comms")}
          >
            Comms
          </button>
          <button
            className={tab === "rolls" ? "active" : ""}
            onClick={() => setTab("rolls")}
          >
            Roll log
          </button>
          <button
            className={tab === "initiative" ? "active" : ""}
            onClick={() => setTab("initiative")}
          >
            Initiative
          </button>
        </nav>
        {tab === "initiative" ? (
          <div className="initiative">
            <div className="section-heading">
              <h3>Round {state.initiative.round}</h3>
              {gm && (
                <button onClick={() => send("initiative:next", {})}>
                  Next ↗
                </button>
              )}
            </div>
            {state.initiative.slots.map((s, i) => (
              <div className="slot-row" key={s.id}>
                <button
                  className={`slot ${s.used ? "used" : ""}`}
                  onClick={() => send("initiative:use", { id: s.id })}
                  disabled={!gm && s.type === "NPC"}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <SlotFace state={state} slot={s} index={i} gm={gm} room={room} />
                  <span>{s.used ? "✓" : "○"}</span>
                </button>
                {gm && (
                  <>
                    <button
                      className="slot-tool"
                      aria-label={s.hidden ? "Show this combatant to players" : "Hide this combatant from players"}
                      title={s.hidden ? "Hidden from players — click to show" : "Visible to players — click to hide"}
                      onClick={() => send("initiative:update", { id: s.id, hidden: !s.hidden })}
                    >
                      {s.hidden ? "Hidden" : "Shown"}
                    </button>
                    <button
                      className="slot-tool"
                      aria-label="Remove this initiative slot"
                      onClick={() => send("initiative:remove", { id: s.id })}
                    >
                      ✕
                    </button>
                  </>
                )}
              </div>
            ))}
            {!state.initiative.slots.length && (
              <p className="hint">
                The GM can add PC and NPC slots. Any player can claim a PC slot
                for this round.
              </p>
            )}
            {gm && (
              <form
                className="stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const nm = String(f.get("name") || "").trim(),
                    tk = String(f.get("tokenId") || "");
                  send("initiative:add", {
                    type: f.get("type"),
                    success: Number(f.get("success")),
                    advantage: Number(f.get("advantage")),
                    ...(nm ? { name: nm } : {}),
                    ...(tk ? { tokenId: tk } : {}),
                    hidden: f.get("hidden") === "on",
                  });
                  e.currentTarget.reset();
                  setInitType("PC");
                }}
              >
                <Field label="Slot type">
                  <select
                    name="type"
                    value={initType}
                    onChange={(e) => setInitType(e.target.value)}
                  >
                    <option>PC</option>
                    <option>NPC</option>
                  </select>
                </Field>
                <Field label="Token on the map (optional)">
                  <select name="tokenId" defaultValue="">
                    <option value="">No token</option>
                    {state.tokens
                      .filter((t) => t.mapId === state.activeMapId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Name shown in the order (optional)">
                  <input name="name" maxLength={40} placeholder="Defaults to the token name" />
                </Field>
                <label className="check">
                  <input
                    name="hidden"
                    type="checkbox"
                    key={initType}
                    defaultChecked={initType === "NPC"}
                  />
                  Hide this combatant’s token and name from players
                </label>
                <div className="two-col">
                  <Field label="Successes">
                    <input
                      name="success"
                      type="number"
                      defaultValue={0}
                      min={0}
                      max={100}
                    />
                  </Field>
                  <Field label="Advantages">
                    <input
                      name="advantage"
                      type="number"
                      defaultValue={0}
                      min={0}
                      max={100}
                    />
                  </Field>
                </div>
                <button>+ Add initiative slot</button>
                <button
                  type="button"
                  onClick={() => send("initiative:clear", {})}
                >
                  Clear encounter
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="chat-log">
              <div className="system-note">
                <span>◈</span>
                <strong>Uplink established</strong>
                <p>
                  Your story begins here.
                  <br />
                  All systems ready, {me.name}.
                </p>
              </div>
              {state.messages
                .filter((m) => tab === "comms" || m.roll)
                .map((m) => (
                  <article
                    className={`message ${m.roll ? "roll-message" : ""}`}
                    key={m.id}
                  >
                    <header>
                      <strong
                        style={{
                          color: state.members.find(
                            (u) => u.userId === m.userId,
                          )?.color,
                        }}
                      >
                        {m.name}
                      </strong>
                      <time>
                        {new Date(m.time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </header>
                    {m.secret ? (
                      <span className="secret-badge">SECRET ROLL · GM ONLY</span>
                    ) : (
                      m.to && (
                        <small className="whisper">
                          PRIVATE →{" "}
                          {state.members.find((u) => u.userId === m.to)?.name}
                        </small>
                      )
                    )}
                    {m.roll ? (
                      <>
                        {m.label && <b className="roll-label">{m.label}</b>}
                        <small>ROLLED {m.roll.faces.length} DICE</small>
                        <div className="rolled-dice">
                          {m.roll.faces.map((f, i) => (
                            <span
                              title={`${f.die}, face ${f.face + 1}: ${resultText(f.symbols)}`}
                              className={`die supplied-die ${f.die}`}
                              key={i}
                            >
                              <img src={`/dice/${f.die}.png`} alt="" />
                            </span>
                          ))}
                        </div>
                        <div
                          className="roll-result symbol-results"
                          aria-label={resultText(m.roll.net)}
                        >
                          {Object.entries(m.roll.net)
                            .filter(([, n]) => n > 0)
                            .map(([symbol, n]) => (
                              <span key={symbol} title={`${n} ${symbol}`}>
                                <img src={`/dice/${symbol}.png`} alt={symbol} />
                                <b>{n}</b>
                                <small>{symbol}</small>
                              </span>
                            ))}
                          {!Object.values(m.roll.net).some(Boolean) &&
                            "No net symbols"}
                        </div>
                        {m.roll.faces.some(
                          (f) => f.die === "difficulty" || f.die === "challenge",
                        ) && (
                          <div
                            className={`roll-verdict ${m.roll.net.success > m.roll.net.failure ? "win" : "lose"}`}
                          >
                            {m.roll.net.success > m.roll.net.failure ? "Success" : "Failure"}
                            {m.roll.net.triumph > 0 && " · Triumph"}
                            {m.roll.net.despair > 0 && " · Despair"}
                          </div>
                        )}
                      </>
                    ) : (
                      <p>{m.text}</p>
                    )}
                  </article>
                ))}
              <div ref={chatEnd} />
            </div>
            <form
              className="chat-compose"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  f = new FormData(form);
                const to = f.get("to");
                send("chat:send", {
                  text: f.get("text"),
                  ...(to ? { to } : {}),
                });
                (form.elements.namedItem("text") as HTMLInputElement).value =
                  "";
              }}
            >
              {gm && (
                <select name="to" aria-label="Message recipient">
                  <option value="">Broadcast to everyone</option>
                  {state.members
                    .filter((m) => m.userId !== user.id)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        Whisper to {m.name}
                      </option>
                    ))}
                </select>
              )}
              <div>
                <input
                  name="text"
                  required
                  maxLength={2000}
                  placeholder="Send a transmission…"
                  aria-label="Chat message"
                />
                <button aria-label="Send message" disabled={!connected}>
                  ↗
                </button>
              </div>
              <small>Enter to transmit</small>
            </form>
          </>
        )}
      </aside>
      <InitiativePopout state={state} gm={gm} room={room} send={send} />
      <footer className="statusbar">
        <span>
          ◈ ARCHIVE <b>TABLETOP</b>
        </span>
        <span>
          SERVER SYNC <i /> REV {state.revision.toString().padStart(4, "0")}
        </span>
        <span>FFG NARRATIVE SYSTEM</span>
      </footer>
      {menu && (
        <div
          className="context-menu"
          style={{
            left: Math.min(menu.x, innerWidth - 200),
            top: Math.min(menu.y, innerHeight - 270),
          }}
        >
          {[
            ["Flip token", "token:flip", {}],
            ["Duplicate", "token:duplicate", {}],
            ["Send to front", "token:layer", { front: true }],
            ["Send to back", "token:layer", { front: false }],
            ...(gm
              ? [
                  state.tokens.find((t) => t.id === menu.id)?.hidden
                    ? ["Show to players", "token:update", { hidden: false }]
                    : ["Hide from players", "token:update", { hidden: true }],
                ]
              : []),
            ["Delete token", "token:delete", {}],
          ].map(([label, event, extra]) => (
            <button
              key={String(event) + String(label)}
              onClick={() =>
                send(String(event), { id: menu.id, ...(extra as object) })
              }
            >
              {String(label)}
            </button>
          ))}
          <button onClick={() => {setSelected(menu.id);setSheetOpen(true);}}>
            Rename / edit token
          </button>
        </div>
      )}
      {sheetOpen && token && (
        <div className="modal-backdrop" onClick={() => setSheetOpen(false)}>
          <section
            className="modal sheet-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setSheetOpen(false)}>
              ×
            </button>
            <div className="eyebrow">TOKEN DETAILS</div>
            <h2>{token.name}</h2>
            {editable && (
              <TokenAppearance
                key={`appearance-${token.id}`}
                token={token}
                room={room}
                assets={state.assets.filter((a) => gm || a.ownerId === user.id)}
                ownerColor={
                  state.members.find((m) => m.userId === token.ownerId)
                    ?.color || "#6dd5dd"
                }
                send={send}
                draft={{ onChange: setTokenLook }}
              />
            )}
            {editable ? (
              <TokenForm
                key={token.id}
                token={token}
                look={tokenLook}
                onCancel={() => setSheetOpen(false)}
                gm={gm}
                members={state.members}
                character={state.members.find((m) => m.userId === token.ownerId)?.character}
                save={(p) => {
                  send("token:update", p);
                  setSheetOpen(false);
                }}
              />
            ) : (
              <p>This token belongs to another crew member.</p>
            )}
            {editable && (
              <div className="token-actions">
                <button
                  onClick={() => {
                    send("token:duplicate", { id: token.id });
                    setSheetOpen(false);
                  }}
                >
                  Duplicate
                </button>
                <button
                  onClick={() =>
                    send("token:layer", { id: token.id, front: true })
                  }
                >
                  Bring to front
                </button>
                <button
                  onClick={() =>
                    send("token:layer", { id: token.id, front: false })
                  }
                >
                  Send to back
                </button>
                <button
                  onClick={() => {
                    send("token:delete", { id: token.id });
                    setSheetOpen(false);
                    setSelected("");
                  }}
                >
                  Delete token
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      {manageScenes && gm && (
        <div className="modal-backdrop">
          <section
            className="modal scene-manager"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manage-scenes-title"
          >
            <button
              className="close"
              aria-label="Close scene manager"
              disabled={deletingScenes}
              onClick={() => setManageScenes(false)}
            >
              ×
            </button>
            <div className="eyebrow">CAMPAIGN SCENES</div>
            <h2 id="manage-scenes-title">
              {confirmScenes ? "Delete selected scenes?" : "Manage scenes"}
            </h2>
            {confirmScenes ? (
              <>
                <p>
                  This permanently removes {sceneSelection.length} selected
                  scene{sceneSelection.length === 1 ? "" : "s"}, including their
                  fog and{" "}
                  {
                    state.tokens.filter((t) => sceneSelection.includes(t.mapId))
                      .length
                  }{" "}
                  placed tokens and character sheets. Uploaded images stay in
                  the library.
                </p>
                <ul className="scene-delete-list">
                  {state.maps
                    .filter((m) => sceneSelection.includes(m.id))
                    .map((m) => (
                      <li key={m.id}>{m.name}</li>
                    ))}
                </ul>
                {sceneSelection.includes(state.activeMapId) && (
                  <p>
                    {sceneSelection.length === state.maps.length
                      ? "A new blank scene will replace these scenes for everyone."
                      : "Everyone will switch to the first remaining scene."}
                  </p>
                )}
                <div className="two-col">
                  <button
                    disabled={deletingScenes}
                    onClick={() => setConfirmScenes(false)}
                  >
                    Back
                  </button>
                  <button
                    className="danger-button"
                    disabled={deletingScenes || !connected}
                    onClick={() => {
                      setDeletingScenes(true);
                      send("map:delete", { ids: sceneSelection }, (ok) => {
                        setDeletingScenes(false);
                        if (ok) {
                          setManageScenes(false);
                          setSceneSelection([]);
                          setSelected("");
                          setSheetOpen(false);
                        }
                      });
                    }}
                  >
                    {deletingScenes ? "Deleting…" : "Confirm deletion"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>Select the scenes you want to delete.</p>
                <div className="scene-selection-tools">
                  <button
                    onClick={() =>
                      setSceneSelection(state.maps.map((m) => m.id))
                    }
                  >
                    Select all
                  </button>
                  <button
                    disabled={!sceneSelection.length}
                    onClick={() => setSceneSelection([])}
                  >
                    Clear selection
                  </button>
                  <span>{sceneSelection.length} selected</span>
                </div>
                <div className="scene-selection-list">
                  {state.maps.map((m) => (
                    <label className="scene-selection-row" key={m.id}>
                      <input
                        type="checkbox"
                        checked={sceneSelection.includes(m.id)}
                        onChange={(e) => {
                          setSceneSelection((ids) =>
                            e.target.checked
                              ? [...ids, m.id]
                              : ids.filter((id) => id !== m.id),
                          );
                        }}
                      />
                      <span>
                        <strong>{m.name}</strong>
                        <small>
                          {m.width} × {m.height}
                          {m.id === state.activeMapId ? " · Active scene" : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  className="danger-button full"
                  disabled={!sceneSelection.length || !connected}
                  onClick={() => setConfirmScenes(true)}
                >
                  Delete selected ({sceneSelection.length})
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {saveOpen && (
        <SaveTools
          room={room}
          gm={gm}
          imported={id=>{setSaveOpen(false);enter(id);}}
          close={() => setSaveOpen(false)}
          restored={() => {
            setSelected("");
            setSaveOpen(false);
          }}
        />
      )}
      {inviteOpen && (
        <div className="modal-backdrop">
          <section className="modal">
            <button className="close" onClick={() => setInviteOpen(false)}>
              ×
            </button>
            <div className="eyebrow">EXPAND YOUR CREW</div>
            <h2>Invite to campaign</h2>
            <p>
              Players enter a display name, then join with this invite and an
              optional player save.
            </p>
            <Field label="Invite link">
              <input
                readOnly
                value={`${location.origin}/?invite=${state.invite}`}
              />
            </Field>
            <Field label="Invite code">
              <input readOnly value={state.invite} />
            </Field>
            <button
              className="primary full"
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText(
                    `${location.origin}/?invite=${state.invite}`,
                  );
                  setInviteOpen(false);
                })
              }
            >
              Copy invite link
            </button>
          </section>
        </div>
      )}
      {state.handout && dismissed !== state.handout.id && (
        <div className="modal-backdrop">
          <section className="modal handout">
            <button
              className="close"
              onClick={() => setDismissed(state.handout!.id)}
            >
              ×
            </button>
            <span className="eyebrow">INCOMING TRANSMISSION</span>
            <h2>{state.handout.title}</h2>
            <img
              src={assetUrl(room, state.handout.assetId)}
              alt={state.handout.title}
            />
            {gm && (
              <button onClick={() => send("handout:close", {})}>
                Close for everyone
              </button>
            )}
          </section>
        </div>
      )}
      {tokenDraft && (
        <TokenDraftModal
          key={`${tokenDraft.name}-${tokenDraft.assetId ?? "marker"}`}
          start={tokenDraft}
          room={room}
          assets={state.assets.filter((a) => a.ownerId === user.id || a.id === tokenDraft.assetId)}
          members={state.members}
          me={me}
          gm={gm}
          placing={placing}
          onClose={() => setTokenDraft(null)}
          onPlace={(payload) => {
            setPlacing(true);
            send("token:create", payload, (ok) => {
              setPlacing(false);
              if (ok) setTokenDraft(null);
            });
          }}
        />
      )}
      {toast}
    </div>
  );
}
function TokenForm({
  token: t,
  gm,
  members,
  character,
  look,
  onCancel,
  save,
}: {
  token: Token;
  look: { assetId: string | null; backAssetId: string | null; appearance?: TokenAppearanceStyle } | null;
  onCancel: () => void;
  gm: boolean;
  members: Campaign["members"];
  character?: Member["character"];
  save: (p: any) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const fillFromCharacter = () => {
    if (!character || !formRef.current) return;
    for (const [k, v] of Object.entries(characterTokenStats(character))) {
      const input = formRef.current.elements.namedItem(k) as HTMLInputElement | null;
      if (input) input.value = String(v);
    }
  };
  return (
    <form
      ref={formRef}
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget),
          sheet = { ...t.sheet };
        for (const k of Object.keys(sheet) as (keyof Sheet)[])
          (sheet as any)[k] =
            k === "notes" ? String(f.get(k)) : Number(f.get(k));
        save({
          id: t.id,
          name: f.get("name"),
          size: Number(f.get("size")),
          rotation: Number(f.get("rotation")),
          status: f.get("status"),
          sheet,
          // Picture and look are saved together with the details, so one Save covers everything.
          ...(look
            ? {
                assetId: look.assetId,
                backAssetId: look.backAssetId,
                ...(look.appearance ? { appearance: look.appearance } : {}),
              }
            : {}),
          ...(gm
            ? { hidden: f.get("hidden") === "on", ownerId: f.get("ownerId") }
            : {}),
        });
      }}
    >
      <Field label="Token name">
        <input name="name" required maxLength={80} defaultValue={t.name} />
      </Field>
      <div className="two-col">
        <Field label="Size (grid units)">
          <input
            name="size"
            type="number"
            min={0.5}
            max={10}
            step={0.5}
            defaultValue={t.size}
          />
        </Field>
        <Field label="Rotation (degrees)">
          <input
            name="rotation"
            type="number"
            min={-360}
            max={360}
            defaultValue={t.rotation}
          />
        </Field>
      </div>
      <Field label="Status marker">
        <input
          name="status"
          maxLength={30}
          placeholder="e.g. Stunned"
          defaultValue={t.status}
        />
      </Field>
      {gm && (
        <>
          <Field label="Controlled by">
            <select name="ownerId" defaultValue={t.ownerId}>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} ({m.role})
                </option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input name="hidden" type="checkbox" defaultChecked={t.hidden} />
            Hidden from players
          </label>
        </>
      )}
      <h3>Character sheet</h3>
      {character && (
        <button type="button" onClick={fillFromCharacter}>
          Fill from {character.name || "character"} sheet
        </button>
      )}
      <div className="two-col">
        {Object.entries({
          wounds: "Wounds · current",
          woundThreshold: "Wounds · threshold",
          strain: "Strain · current",
          strainThreshold: "Strain · threshold",
          soak: "Soak",
          defense: "Defense",
          credits: "Credits",
        }).map(([k, label]) => (
          <Field key={k} label={label}>
            <input
              name={k}
              type="number"
              min={0}
              max={k === "credits" ? 1e12 : 9999}
              defaultValue={t.sheet[k as keyof Sheet]}
            />
          </Field>
        ))}
      </div>
      <Field label="Notes">
        <textarea
          name="notes"
          rows={4}
          maxLength={10000}
          defaultValue={t.sheet.notes}
        />
      </Field>
      <div className="modal-savebar">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary">Save token</button>
      </div>
    </form>
  );
}
