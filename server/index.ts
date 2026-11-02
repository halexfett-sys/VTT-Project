import { createApp } from "./app.js";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { http } = createApp();
const port = Number(process.env.PORT || 3001);
http.listen(port, "0.0.0.0", () =>
  console.log(`Outer Rim listening at http://localhost:${port}`),
);
