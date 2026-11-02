/** Hosting/proxy error pages are not API JSON. Never surface JSON parser errors. */
export async function readApiResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const status = `HTTP ${response.status}`;
  const endpoint = response.url ? new URL(response.url).pathname : "/api";
  if (!contentType.includes("application/json")) {
    if (response.status === 429)
      throw new Error("Too many requests. Wait a minute and try again.");
    if (response.status === 413)
      throw new Error("The server or hosting provider rejected this upload because it is too large.");
    throw new Error(
      `The tabletop backend returned a page instead of JSON (${status}, ${endpoint}). ` +
      "If this is a static deployment, the Express/Socket.IO backend must also be running and /api must route to it. " +
      "For local play, start the server and open http://localhost:3001.",
    );
  }
  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(`The tabletop backend returned invalid JSON (${status}, ${endpoint}). Try again or check the server logs.`);
  }
  if (!response.ok)
    throw new Error(typeof data?.error === "string" ? data.error : `Request failed (${status}, ${endpoint}).`);
  return data;
}
