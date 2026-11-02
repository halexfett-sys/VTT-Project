import { serverConfig, stageFile } from "./runtime";
import { readApiResponse } from "./response";
export async function api(path: string, body?: unknown) {
  const r = await fetch(`/api${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return readApiResponse(r);
}
export const assetUrl = (room: string, id: string) =>
  `/api/rooms/${room}/assets/${id}`;
export async function upload(room: string, kind: string, file: File) {
  if ((await serverConfig()).cloud)
    return api(`/rooms/${room}/assets`, {
      kind,
      transfer: await stageFile(file, "image"),
    });
  const form = new FormData();
  form.append("kind", kind);
  form.append("file", file);
  const r = await fetch(`/api/rooms/${room}/assets`, {
    method: "POST",
    body: form,
  });
  return readApiResponse(r);
}
