import { useEffect, useState } from "react";
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
  /** Editing a token that is not on the table yet: report every change upward instead of saving to the server. */
  draft?: {
    onChange: (v: {
      assetId: string | null;
      backAssetId: string | null;
      appearance?: TokenAppearanceStyle;
    }) => void;
  };
};
export default function TokenAppearance({
  token,
  room,
  assets,
  ownerColor,
  send,
  draft,
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
    [backImage, setBackImage] = useState<string | null>(token.backAssetId || null),
    [side, setSide] = useState<"front" | "back">("front"),
    [uploaded, setUploaded] = useState<Asset[]>([]);
  const [touched, setTouched] = useState(false);
  const change = (p: Partial<TokenAppearanceStyle>) => {
    setStyle((s) => ({ ...s, ...p }));
    setTouched(true);
    setSaved(false);
  };
  useEffect(() => {
    // Colors and outline are only sent once changed, so tokens nobody restyled keep their default look.
    draft?.onChange({
      assetId: image,
      backAssetId: backImage,
      appearance: touched || token.appearance ? style : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, backImage, style, touched]);
  // Which face is being edited. A back face only has its own zoom/position once a back image is chosen.
  const editingBack = side === "back" && Boolean(backImage);
  const faceImage = side === "back" ? backImage || image : image;
  const keys = editingBack
    ? ({ s: "backImageScale", x: "backImageX", y: "backImageY" } as const)
    : ({ s: "imageScale", x: "imageX", y: "imageY" } as const);
  const zoom = style[keys.s] ?? 1,
    shiftX = style[keys.x] ?? 0,
    shiftY = style[keys.y] ?? 0;
  const noBackYet = side === "back" && !backImage;
  const uploadTo = async (file: File | undefined, apply: (id: string) => void) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Images must be 20 MB or smaller");
      const asset = await upload(room, "token", file);
      setUploaded((a) => [...a, asset]);
      apply(asset.id);
      setSaved(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const library = [
    ...assets,
    ...uploaded.filter((a) => !assets.some((b) => a.id === b.id)),
  ].filter(
    (a) =>
      a.kind === "token" || a.kind === "art" || a.id === image || a.id === backImage,
  );
  return (
    <section className="token-customizer" aria-label="Token appearance">
      <h3>Token appearance</h3>
      <p className="hint">
        {draft
          ? "Preview your image, colors and outline. They are applied when you place the token."
          : "Preview your image, colors and outline before saving."}
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
          {faceImage ? (
            <img
              src={assetUrl(room, faceImage)}
              alt={`Token ${side} preview`}
              style={{
                objectFit: style.imageFit,
                transform: `translate(${shiftX * 50}%, ${shiftY * 50}%) scale(${zoom})`,
              }}
            />
          ) : (
            <span>{token.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      <div className="token-name-preview" style={{ color: style.nameColor || "#e6edf0" }}>
        {token.name}
      </div>
      <div className="face-tabs" role="tablist" aria-label="Token side">
        {(["front", "back"] as const).map((s) => (
          <button
            type="button"
            role="tab"
            aria-selected={side === s}
            className={side === s ? "active" : ""}
            key={s}
            onClick={() => setSide(s)}
          >
            {s === "front" ? "Front" : "Back"}
            {s === "back" && !backImage ? " (none)" : ""}
          </button>
        ))}
      </div>
      <label className="upload-button">
        {busy ? "Uploading…" : "Upload / replace token image"}
        <input
          aria-label="Upload token image"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || saving}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            uploadTo(file, setImage);
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
      {side === "back" && (
        <>
          <label className="upload-button">
            {busy ? "Uploading…" : "Upload back image"}
            <input
              aria-label="Upload back image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy || saving}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                uploadTo(f, setBackImage);
              }}
            />
          </label>
          <label className="field">
            <span>Back image from library</span>
            <select
              value={backImage || ""}
              onChange={(e) => {
                setBackImage(e.target.value || null);
                setSaved(false);
              }}
              disabled={busy || saving}
            >
              <option value="">None — show the front image on both sides</option>
              {library.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      <fieldset className="image-adjust" disabled={noBackYet || !faceImage}>
        <legend>{side === "back" ? "Back" : "Front"} image size & position</legend>
        <label className="field">
          <span>Zoom · {Math.round(zoom * 100)}%</span>
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={zoom}
            aria-label="Image zoom"
            onChange={(e) => change({ [keys.s]: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Left / right · {Math.round(shiftX * 100)}%</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={shiftX}
            aria-label="Image horizontal position"
            onChange={(e) => change({ [keys.x]: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Up / down · {Math.round(shiftY * 100)}%</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            value={shiftY}
            aria-label="Image vertical position"
            onChange={(e) => change({ [keys.y]: Number(e.target.value) })}
          />
        </label>
        <button
          type="button"
          onClick={() => change({ [keys.s]: 1, [keys.x]: 0, [keys.y]: 0 })}
        >
          Reset image position
        </button>
      </fieldset>
      {noBackYet && (
        <p className="hint">
          No back image yet. Flipping the token shows the front image on both sides.
        </p>
      )}
      {token.id !== "draft" && (
        <button
          type="button"
          className="full"
          onClick={() => send("token:flip", { id: token.id })}
        >
          ⇄ Flip token (showing {token.flipped ? "back" : "front"})
        </button>
      )}
      <div className="two-col">
        <label className="field">
          <span>Background color</span>
          <input
            type="color"
            value={style.background}
            onChange={(e) => change({ background: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Text color (name and initials)</span>
          <input
            type="color"
            value={style.nameColor || "#e6edf0"}
            onChange={(e) => change({ nameColor: e.target.value, textColor: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Outline color</span>
          <input
            type="color"
            value={style.outlineColor}
            onChange={(e) => change({ outlineColor: e.target.value })}
          />
        </label>
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
            setTouched(true);
            setSaved(false);
          }}
        >
          Reset colors & outline
        </button>
        {!draft && (
        <button
          type="button"
          className="primary"
          disabled={saving || busy}
          onClick={() => {
            setSaving(true);
            setError("");
            send(
              "token:update",
              { id: token.id, assetId: image, backAssetId: backImage, appearance: style },
              (ok) => {
                setSaving(false);
                setSaved(ok);
              },
            );
          }}
        >
          {saving ? "Saving…" : "Save appearance"}
        </button>
        )}
      </div>
      {error && (
        <p role="alert" className="appearance-error">
          {error}
        </p>
      )}
      {saved && !draft && (
        <p role="status" className="appearance-saved">
          Appearance saved for everyone.
        </p>
      )}
    </section>
  );
}
