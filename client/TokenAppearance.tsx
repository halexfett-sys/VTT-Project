import { useState } from "react";
import type { Asset, Token, TokenAppearanceStyle } from "../shared/types";
import { assetUrl, upload } from "./api";
type Props = {
  token: Token;
  room: string;
  assets: Asset[];
  ownerColor: string;
  send: (
    event: string,
    payload: unknown,
    complete?: (ok: boolean) => void,
  ) => void;
};
export default function TokenAppearance({
  token,
  room,
  assets,
  ownerColor,
  send,
}: Props) {
  const defaults: TokenAppearanceStyle = {
    background: "#23333e",
    textColor: ownerColor,
    outlineColor: ownerColor,
    outlineWidth: 2,
    shape: "circle",
    imageFit: "cover",
  };
  const [style, setStyle] = useState(token.appearance || defaults),
    [image, setImage] = useState<string | null>(token.assetId || null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [uploaded, setUploaded] = useState<Asset[]>([]);
  const change = (p: Partial<TokenAppearanceStyle>) => {
    setStyle((s) => ({ ...s, ...p }));
    setSaved(false);
  };
  const library = [
    ...assets,
    ...uploaded.filter((a) => !assets.some((b) => a.id === b.id)),
  ].filter((a) => a.kind === "token" || a.kind === "art" || a.id === image);
  return (
    <section className="token-customizer" aria-label="Token appearance">
      <h3>Token appearance</h3>
      <p className="hint">
        Preview your image, colors and outline before saving.
      </p>
      <div className="token-preview-stage">
        <div
          className="token-live-preview"
          style={{
            background: style.background,
            color: style.textColor,
            borderColor: style.outlineColor,
            borderWidth: style.outlineWidth,
            borderRadius: style.shape === "circle" ? "50%" : "0",
          }}
        >
          {image ? (
            <img
              src={assetUrl(room, image)}
              alt="Token appearance preview"
              style={{ objectFit: style.imageFit }}
            />
          ) : (
            <span>{token.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      <label className="upload-button">
        {busy ? "Uploading…" : "Upload / replace token image"}
        <input
          aria-label="Upload token image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || saving}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              if (file.size > 20 * 1024 * 1024)
                throw new Error("Images must be 20 MB or smaller");
              const asset = await upload(room, "token", file);
              setUploaded((a) => [...a, asset]);
              setImage(asset.id);
              setSaved(false);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <label className="field">
        <span>Image from library</span>
        <select
          value={image || ""}
          onChange={(e) => {
            setImage(e.target.value || null);
            setSaved(false);
          }}
          disabled={busy || saving}
        >
          <option value="">No image — initials</option>
          {library.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <div className="two-col">
        {(["background", "textColor", "outlineColor"] as const).map((k) => (
          <label className="field" key={k}>
            <span>
              {
                {
                  background: "Background color",
                  textColor: "Initials color",
                  outlineColor: "Outline color",
                }[k]
              }
            </span>
            <input
              type="color"
              value={style[k]}
              onChange={(e) => change({ [k]: e.target.value })}
            />
          </label>
        ))}
        <label className="field">
          <span>Outline thickness ({style.outlineWidth}px)</span>
          <input
            type="range"
            min={0}
            max={12}
            step={1}
            value={style.outlineWidth}
            onChange={(e) => change({ outlineWidth: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="two-col">
        <label className="field">
          <span>Token shape</span>
          <select
            value={style.shape}
            onChange={(e) =>
              change({ shape: e.target.value as TokenAppearanceStyle["shape"] })
            }
          >
            <option value="circle">Circle</option>
            <option value="square">Square</option>
          </select>
        </label>
        <label className="field">
          <span>Image fit</span>
          <select
            value={style.imageFit}
            onChange={(e) =>
              change({
                imageFit: e.target.value as TokenAppearanceStyle["imageFit"],
              })
            }
          >
            <option value="cover">Fill and crop</option>
            <option value="contain">Fit whole image</option>
          </select>
        </label>
      </div>
      <div className="two-col">
        <button
          type="button"
          disabled={saving || busy}
          onClick={() => {
            setStyle(defaults);
            setSaved(false);
          }}
        >
          Reset colors & outline
        </button>
        <button
          type="button"
          className="primary"
          disabled={saving || busy}
          onClick={() => {
            setSaving(true);
            setError("");
            send(
              "token:update",
              { id: token.id, assetId: image, appearance: style },
              (ok) => {
                setSaving(false);
                setSaved(ok);
              },
            );
          }}
        >
          {saving ? "Saving…" : "Save appearance"}
        </button>
      </div>
      {error && (
        <p role="alert" className="appearance-error">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="appearance-saved">
          Appearance saved for everyone.
        </p>
      )}
    </section>
  );
}
