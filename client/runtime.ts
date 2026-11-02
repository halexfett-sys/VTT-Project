import { readApiResponse } from "./response";
let configuration: Promise<{ cloud: boolean; socketPath?: string }> | undefined;
export function serverConfig() {
  return (configuration ||= fetch("/api/config")
    .then(readApiResponse)
    .catch((e) => {
      configuration = undefined;
      throw e;
    }));
}
export async function stageFile(file: File, type: "image" | "save") {
  const response = await fetch("/api/transfers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type }),
  });
  const { id, chunkSize } = await readApiResponse(response);
  for (
    let offset = 0, part = 0;
    offset < file.size;
    offset += chunkSize, part++
  ) {
    const r = await fetch(`/api/transfers/${id}/${part}`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: file.slice(offset, offset + chunkSize),
    });
    await readApiResponse(r);
  }
  return id as string;
}
