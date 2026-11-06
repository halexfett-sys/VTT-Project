import { useEffect, useRef, useState } from "react";
import type { Campaign, Point, Token } from "../shared/types";
import { assetUrl } from "./api";
export type Tool = "select" | "pan" | "ruler" | "hide" | "reveal" | "range";
type Props = {
  state: Campaign;
  userId: string;
  tool: Tool;
  brush: number;
  rangeBase: number;
  selected: string;
  onSelect: (id: string) => void;
  send: (event: string, payload: unknown) => void;
  onMenu: (id: string, x: number, y: number) => void;
};
export default function MapCanvas({
  state,
  userId,
  tool,
  brush,
  rangeBase,
  selected,
  onSelect,
  send,
  onMenu,
}: Props) {
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    current = useRef({
      state,
      userId,
      tool,
      brush,
  rangeBase,
      selected,
      onSelect,
      send,
      onMenu,
    });
  current.current = {
    state,
    userId,
    tool,
    brush,
  rangeBase,
    selected,
    onSelect,
    send,
    onMenu,
  };
  const camera = useRef({ x: 70, y: 60, zoom: 0.7 }),
    [zoom, setZoom] = useState(70),
    [fitKey, setFitKey] = useState(0);
  const images = useRef(new Map<string, HTMLImageElement>()),
    positions = useRef(new Map<string, Point>()),
    drag = useRef<any>(null),
    measure = useRef<{ a: Point; b: Point } | null>(null),
    stroke = useRef<Point[]>([]),
    pointers = useRef(new Map<number, Point>()),
    lastSend = useRef(0);
  const map = state.maps.find((m) => m.id === state.activeMapId)!;
  const gm = state.members.find((m) => m.userId === userId)?.role === "gm";
  const fogVersion = gm ? "gm" : state.revision; // masked images are private and never browser-cached
  const mapUrl = `/api/rooms/${state.id}/map/${map.id}?v=${fogVersion}`;
  const fogCache = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(
    null,
  );
  const mapImage = useRef<HTMLImageElement | null>(null),
    imageKey = useRef("");
  // Reload only when map/fog changes, not for chat or token motion. Players receive a fog signature.
  const signature = `${map.id}:${map.fogRevision ?? map.fog.map((s) => s.id).join(",")}:${map.assetId || map.hasImage || ""}`;
  useEffect(() => {
    mapImage.current = null;
    imageKey.current = signature;
    if (!map.assetId && !map.hasImage) return;
    const img = new Image();
    img.onload = () => {
      if (imageKey.current === signature) mapImage.current = img;
    };
    img.src = mapUrl;
  }, [signature]);
  useEffect(() => {
    const fit = () => {
      if (!host.current) return; // table closed (kicked / left) while a resize was pending
      const box = host.current.getBoundingClientRect();
      const z = Math.max(
        0.08,
        Math.min(
          2,
          (box.width - 100) / map.width,
          (box.height - 100) / map.height,
        ),
      );
      camera.current = {
        x: (box.width - map.width * z) / 2,
        y: (box.height - map.height * z) / 2,
        zoom: Math.max(0.08, Math.min(2, z)),
      };
      setZoom(Math.round(camera.current.zoom * 100));
      measure.current = null;
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host.current!);
    fit();
    return () => observer.disconnect();
  }, [map.id, fitKey]);
  useEffect(() => {
    const el = canvas.current!,
      ctx = el.getContext("2d")!;
    let frame = 0;
    const image = (id: string) => {
      const url = assetUrl(current.current.state.id, id);
      let img = images.current.get(url);
      if (!img) {
        img = new Image();
        img.src = url;
        images.current.set(url, img);
      }
      return img.complete && img.naturalWidth ? img : null;
    };
    const draw = () => {
      const { state: s, userId, selected } = current.current,
        m = s.maps.find((m) => m.id === s.activeMapId)!;
      const isGM = s.members.find((m) => m.userId === userId)?.role === "gm";
      if (!host.current) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const rect = host.current.getBoundingClientRect(),
        dpr = window.devicePixelRatio || 1;
      if (
        el.width !== Math.round(rect.width * dpr) ||
        el.height !== Math.round(rect.height * dpr)
      ) {
        el.width = rect.width * dpr;
        el.height = rect.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#0b1016";
      ctx.fillRect(0, 0, rect.width, rect.height);
      const cam = camera.current;
      ctx.translate(cam.x, cam.y);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.fillStyle = "#15232b";
      ctx.fillRect(0, 0, m.width, m.height);
      if (mapImage.current)
        ctx.drawImage(mapImage.current, 0, 0, m.width, m.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, m.width, m.height);
      ctx.clip();
      const g = m.grid;
      ctx.strokeStyle = g.color;
      ctx.globalAlpha = 0.26;
      ctx.lineWidth = 1 / cam.zoom;
      if (g.type === "square") {
        ctx.beginPath();
        for (let x = g.offsetX % g.size; x < m.width; x += g.size) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, m.height);
        }
        for (let y = g.offsetY % g.size; y < m.height; y += g.size) {
          ctx.moveTo(0, y);
          ctx.lineTo(m.width, y);
        }
        ctx.stroke();
      }
      if (g.type === "hex") {
        const r = g.size / 2,
          h = Math.sqrt(3) * r;
        ctx.beginPath();
        for (let col = -2; col < m.width / (r * 1.5) + 2; col++)
          for (let row = -2; row < m.height / h + 2; row++) {
            const x = col * r * 1.5 + g.offsetX,
              y = row * h + ((col % 2) * h) / 2 + g.offsetY;
            for (let i = 0; i < 7; i++) {
              const a = (i * Math.PI) / 3;
              const px = x + Math.cos(a) * r,
                py = y + Math.sin(a) * r;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
          }
        ctx.stroke();
      }
      ctx.restore();
      if (isGM && m.fog.length) {
        const fogKey = m.id + m.fog.map((s) => s.id).join(",");
        let off =
          fogCache.current?.key === fogKey ? fogCache.current.canvas : null;
        if (!off) {
          off = document.createElement("canvas");
          off.width = m.width;
          off.height = m.height;
          const fog = off.getContext("2d")!;
          for (const f of m.fog) {
            fog.globalCompositeOperation = f.erase
              ? "destination-out"
              : "source-over";
            fog.strokeStyle = "#010307";
            fog.lineWidth = f.size;
            fog.lineCap = "round";
            fog.lineJoin = "round";
            fog.beginPath();
            f.points.forEach((p, i) =>
              i ? fog.lineTo(p.x, p.y) : fog.moveTo(p.x, p.y),
            );
            fog.lineTo(f.points.at(-1)!.x + 0.01, f.points.at(-1)!.y);
            fog.stroke();
          }
          fogCache.current = { key: fogKey, canvas: off };
        }
        ctx.globalAlpha = 0.55;
        ctx.drawImage(off, 0, 0);
        ctx.globalAlpha = 1;
      }
      for (const t of s.tokens
        .filter((t) => t.mapId === m.id)
        .sort((a, b) => a.z - b.z)) {
        let p = positions.current.get(t.id) || { x: t.x, y: t.y };
        if (drag.current?.id === t.id)
          p = { x: drag.current.x, y: drag.current.y };
        else p = { x: p.x + (t.x - p.x) * 0.35, y: p.y + (t.y - p.y) * 0.35 };
        positions.current.set(t.id, p);
        const size = t.size * g.size,
          owner = s.members.find((m) => m.userId === t.ownerId);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = t.hidden ? 0.4 : 1;
        ctx.rotate((t.rotation * Math.PI) / 180);
        ctx.fillStyle = t.appearance?.background || "#23333e";
        ctx.strokeStyle =
          t.appearance?.outlineColor || owner?.color || "#6dd5dd";
        ctx.lineWidth = (t.appearance?.outlineWidth ?? 2) / cam.zoom;
        ctx.beginPath();
        if (t.appearance?.shape === "square")
          ctx.rect(-size / 2, -size / 2, size, size);
        else ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.clip();
        const art = t.assetId ? image(t.assetId) : null;
        if (art) {
          const ratio =
            t.appearance?.imageFit === "contain"
              ? Math.min(size / art.width, size / art.height)
              : Math.max(size / art.width, size / art.height);
          const w = art.width * ratio,
            h = art.height * ratio;
          ctx.drawImage(art, -w / 2, -h / 2, w, h);
        } else {
          ctx.fillStyle = t.appearance?.textColor || owner?.color || "#9ab3bc";
          ctx.font = `bold ${size * 0.38}px SWEuro, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(t.name.slice(0, 2).toUpperCase(), 0, 0);
        }
        ctx.restore();
        if ((t.appearance?.outlineWidth ?? 2) > 0) ctx.stroke();
        if (t.id === selected) {
          ctx.beginPath();
          ctx.strokeStyle = "#f2be74";
          ctx.lineWidth = 2 / cam.zoom;
          const radius =
            size / 2 + ((t.appearance?.outlineWidth ?? 2) / 2 + 5) / cam.zoom;
          if (t.appearance?.shape === "square")
            ctx.rect(-radius, -radius, radius * 2, radius * 2);
          else ctx.arc(0, 0, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.font = `${14 / cam.zoom}px SWEuro, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillStyle = "#e6edf0";
        ctx.fillText(t.name, p.x, p.y + size / 2 + 18 / cam.zoom);
        if (t.status) {
          ctx.fillStyle = "#efb66e";
          ctx.fillText(t.status, p.x, p.y - size / 2 - 10 / cam.zoom);
        }
      }
      const ruler = measure.current;
      if (ruler) {
        const dist =
          Math.hypot(ruler.b.x - ruler.a.x, ruler.b.y - ruler.a.y) / g.size;
        ctx.strokeStyle = "#f2be74";
        ctx.fillStyle = "#f2be74";
        ctx.lineWidth = 2 / cam.zoom;
        ctx.setLineDash([6 / cam.zoom, 5 / cam.zoom]);
        ctx.beginPath();
        ctx.moveTo(ruler.a.x, ruler.a.y);
        ctx.lineTo(ruler.b.x, ruler.b.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = `${15 / cam.zoom}px SWEuro, sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText(
          `${dist.toFixed(1)} grid units`,
          ruler.b.x + 12 / cam.zoom,
          ruler.b.y - 12 / cam.zoom,
        );
        if (current.current.tool === "range") {
          ["Engaged", "Short", "Medium", "Long", "Extreme"].forEach(
            (name, i) => {
              const radius = [1, 3, 6, 10, 15][i] * current.current.rangeBase;
              ctx.globalAlpha = 0.4;
              ctx.beginPath();
              ctx.arc(ruler.a.x, ruler.a.y, radius, 0, Math.PI * 2);
              ctx.stroke();
              ctx.globalAlpha = 1;
              ctx.fillText(name, ruler.a.x + radius + 5, ruler.a.y);
            },
          );
        }
      }
      if (stroke.current.length) {
        ctx.strokeStyle =
          current.current.tool === "hide" ? "#dd9f67" : "#65d4c1";
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = current.current.brush;
        ctx.lineCap = "round";
        ctx.beginPath();
        stroke.current.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  const screen = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const world = (p: Point) => ({
    x: (p.x - camera.current.x) / camera.current.zoom,
    y: (p.y - camera.current.y) / camera.current.zoom,
  });
  const bounded = (p: Point) => ({
    x: Math.max(0, Math.min(map.width, p.x)),
    y: Math.max(0, Math.min(map.height, p.y)),
  });
  const hit = (p: Point) =>
    [...state.tokens]
      .sort((a, b) => b.z - a.z)
      .find(
        (t) =>
          t.mapId === map.id &&
          (t.appearance?.shape === "square"
            ? Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y))
            : Math.hypot(p.x - t.x, p.y - t.y)) <
            (t.size * map.grid.size) / 2,
      );
  const zoomAt = (p: Point, factor: number) => {
    const w = world(p),
      z = Math.max(0.08, Math.min(4, camera.current.zoom * factor));
    camera.current = { x: p.x - w.x * z, y: p.y - w.y * z, zoom: z };
    setZoom(Math.round(z * 100));
  };
  useEffect(() => {
    const el = canvas.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(screen(e), Math.exp(-e.deltaY * 0.001));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const finish = () => {
    if (drag.current?.id) {
      const d = drag.current;
      send("token:move", { id: d.id, ...bounded(d) });
    }
    if (stroke.current.length) {
      send("fog:stroke", {
        erase: tool === "reveal",
        size: brush,
        points: stroke.current,
      });
      stroke.current = [];
    }
    drag.current = null;
  };
  return (
    <div className="map-host" ref={host}>
      <canvas
        ref={canvas}
        tabIndex={0}
        aria-label="Tactical map. Drag to pan, wheel or pinch to zoom. Select a token and use arrow keys to move."
        onKeyDown={(e) => {
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
          ) {
            const t = state.tokens.find((t) => t.id === selected);
            if (t && (gm || t.ownerId === userId)) {
              e.preventDefault();
              send("token:move", {
                id: t.id,
                ...bounded({
                  x:
                    t.x +
                    (e.key === "ArrowRight"
                      ? map.grid.size
                      : e.key === "ArrowLeft"
                        ? -map.grid.size
                        : 0),
                  y:
                    t.y +
                    (e.key === "ArrowDown"
                      ? map.grid.size
                      : e.key === "ArrowUp"
                        ? -map.grid.size
                        : 0),
                }),
              });
            }
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const t = hit(world(screen(e)));
          if (t && (gm || t.ownerId === userId)) {
            onSelect(t.id);
            onMenu(t.id, e.clientX, e.clientY);
          }
        }}
        onPointerDown={(e) => {
          if (e.button === 2) return;
          canvas.current!.setPointerCapture(e.pointerId);
          canvas.current!.focus();
          const p = screen(e),
            w = bounded(world(p));
          pointers.current.set(e.pointerId, p);
          if (pointers.current.size === 2) {
            finish();
            const [a, b] = [...pointers.current.values()];
            drag.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y) };
            return;
          }
          if ((tool === "hide" || tool === "reveal") && gm) {
            stroke.current = [w];
            return;
          }
          if (tool === "ruler" || tool === "range") {
            measure.current = { a: w, b: w };
            drag.current = { ruler: true };
            return;
          }
          const t = tool === "select" ? hit(w) : undefined;
          if (t) {
            onSelect(t.id);
            if (gm || t.ownerId === userId)
              drag.current = {
                id: t.id,
                x: t.x,
                y: t.y,
                dx: t.x - w.x,
                dy: t.y - w.y,
              };
          } else {
            onSelect("");
            drag.current = { pan: true, x: p.x, y: p.y };
          }
        }}
        onPointerMove={(e) => {
          const p = screen(e);
          if (!pointers.current.has(e.pointerId)) return;
          pointers.current.set(e.pointerId, p);
          const w = bounded(world(p)),
            d = drag.current;
          if (pointers.current.size === 2 && d?.pinch) {
            const [a, b] = [...pointers.current.values()],
              dist = Math.hypot(a.x - b.x, a.y - b.y);
            zoomAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist / d.pinch);
            d.pinch = dist;
            return;
          }
          if (stroke.current.length) {
            if (stroke.current.length < 1000) stroke.current.push(w);
            return;
          }
          if (d?.ruler) {
            measure.current!.b = w;
            return;
          }
          if (d?.pan) {
            camera.current.x += p.x - d.x;
            camera.current.y += p.y - d.y;
            d.x = p.x;
            d.y = p.y;
          } else if (d?.id) {
            Object.assign(d, bounded({ x: w.x + d.dx, y: w.y + d.dy }));
            if (Date.now() - lastSend.current > 70) {
              send("token:move", { id: d.id, x: d.x, y: d.y });
              lastSend.current = Date.now();
            }
          }
        }}
        onPointerUp={(e) => {
          pointers.current.delete(e.pointerId);
          finish();
        }}
        onPointerCancel={(e) => {
          pointers.current.delete(e.pointerId);
          finish();
        }}
      />
      {!map.assetId && !map.hasImage && <div className="no-map-data" role="status">No Map Data...</div>}
      <div className="map-caption">
        <span className="live-dot" /> {map.name}
        <small>
          {map.width} × {map.height} ·{" "}
          {map.grid.type === "none"
            ? "No grid"
            : `${map.grid.size}px ${map.grid.type}`}
        </small>
      </div>
      <div className="map-bottom">
        <span>
          {tool === "range"
            ? "Range rings are adjustable narrative guides, not fixed rules distances."
            : tool === "hide" || tool === "reveal"
              ? "Draw on the map to edit fog of war."
              : "Drag to pan · Scroll to zoom · Right-click a token for actions"}
        </span>
        <div className="zoom">
          <button
            onClick={() => zoomAt({ x: 300, y: 300 }, 0.8)}
            aria-label="Zoom out"
          >
            −
          </button>
          <span>{zoom}%</span>
          <button
            onClick={() => zoomAt({ x: 300, y: 300 }, 1.25)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button onClick={() => setFitKey((k) => k + 1)}>Fit</button>
        </div>
      </div>
    </div>
  );
}
