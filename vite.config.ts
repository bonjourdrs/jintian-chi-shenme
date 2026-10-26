import { createRoomStore } from "./server/room-store.mjs";
import { syncApi } from "./server/api.mjs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

async function publicShell(dir: string, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = `${prefix}${entry.name}`;
    if (path === "sw.js" || path.startsWith("assets/dishes")) continue;
    if (entry.isDirectory())
      paths.push(...(await publicShell(resolve(dir, entry.name), `${path}/`)));
    else paths.push(path);
  }
  return paths;
}

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    {
      name: "jte-versioned-sync",
      configureServer(server) { server.middlewares.use(syncApi(createRoomStore(resolve(".local/rooms.json")))); },
      configurePreviewServer(server) { server.middlewares.use(syncApi(createRoomStore(resolve(".local/rooms.json")))); },
    },
    {
      name: "jte-offline-shell",
      async writeBundle(options, bundle) {
        const files = [
          ...Object.keys(bundle),
          ...(await publicShell(resolve("public"))),
        ].sort();
        const hash = createHash("sha256");
        for (const file of files)
          hash.update(await readFile(resolve(options.dir!, file)));
        const source = await readFile(resolve("public/sw.js"), "utf8");
        const sw = source
          .replace("__BUILD_ID__", hash.digest("hex").slice(0, 16))
          .replace(
            "const PRECACHE = [];",
            `const PRECACHE = ${JSON.stringify(files.map((file) => `./${file}`))};`,
          );
        await writeFile(resolve(options.dir!, "sw.js"), sw);
      },
    },
  ],
  server: {
    host: "127.0.0.1",
    port: 4321,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4321,
    strictPort: true,
  },
});
