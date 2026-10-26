import { createServer } from "node:http";
import { readFileSync, statSync, existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoomStore } from "./room-store.mjs";
import { syncApi } from "./api.mjs";
export function createLocalServer({
  root = resolve("dist"),
  store = createRoomStore(resolve(".local/rooms.json")),
} = {}) {
  const api = syncApi(store);
  return createServer((req, res) =>
    api(req, res, () => {
      let path;
      try {
        path = decodeURIComponent(
          new URL(req.url, "http://localhost").pathname,
        );
      } catch {
        res.statusCode = 400;
        return res.end();
      }
      const file = resolve(
        root,
        "." + (path.endsWith("/") ? path + "index.html" : path),
      );
      if (file !== root && !file.startsWith(root + sep)) {
        res.statusCode = 403;
        return res.end();
      }
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.statusCode = 404;
        return res.end("not found");
      }
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".svg": "image/svg+xml",
      };
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader(
        "Cache-Control",
        path.endsWith("/sw.js") || path.endsWith(".html")
          ? "no-cache"
          : "public, max-age=0",
      );
      res.end(readFileSync(file));
    }),
  );
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const portIndex = process.argv.indexOf("--port"),
    hostIndex = process.argv.indexOf("--host");
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4321,
    host = hostIndex >= 0 ? process.argv[hostIndex + 1] : "127.0.0.1";
  createLocalServer().listen(port, host, () =>
    console.log(`Local app + versioned sync API: http://${host}:${port}/`),
  );
}
