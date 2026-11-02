import { serverConfig, stageFile } from "./runtime";
import { api } from "./api";
import { readApiResponse } from "./response";
export async function importSave(
  path: string,
  file: File,
  fields: Record<string, string> = {},
) {
  if (file.size > 128 * 1024 * 1024)
    throw new Error("Save must be 128 MB or smaller");
  if ((await serverConfig()).cloud)
    return api(path, { ...fields, transfer: await stageFile(file, "save") });
  const body = new FormData();
  body.set("file", file);
  Object.entries(fields).forEach(([key, value]) => body.set(key, value));
  const response = await fetch(`/api${path}`, { method: "POST", body });
  return readApiResponse(response);
}
export async function downloadSave(room: string, kind: "player" | "table") {
  const response = await fetch(`/api/rooms/${room}/export/${kind}`);
  const data = await readApiResponse(response);
  if (data?.format !== "outer-rim-save" || data?.version !== 1)
    throw new Error(
      "The server did not return a valid tabletop save. No file was downloaded.",
    );
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `outer-rim-${kind}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
