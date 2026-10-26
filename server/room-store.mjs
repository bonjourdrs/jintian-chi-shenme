import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
/** A single-process, durable compare-and-swap store. Persist before exposing success. */
export function createRoomStore(file) {
  let rooms = {};
  if (file) {
    try {
      rooms = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  function persist(next) {
    if (file) {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file + ".tmp", JSON.stringify(next), { mode: 0o600 });
      renameSync(file + ".tmp", file);
    }
    rooms = next;
  }
  return {
    get(code) {
      return rooms[code] ? structuredClone(rooms[code]) : null;
    },
    create(payload) {
      let code;
      do {
        code = randomBytes(6).toString("hex").slice(0, 8).toUpperCase();
      } while (rooms[code]);
      const room = { revision: 1, payload };
      persist({ ...rooms, [code]: room });
      return { code, ...structuredClone(room) };
    },
    put(code, revision, payload) {
      const previous = rooms[code];
      if (!previous) return { status: 404 };
      if (previous.revision !== revision)
        return { status: 409, ...structuredClone(previous) };
      const room = { revision: revision + 1, payload };
      persist({ ...rooms, [code]: room });
      return { status: 200, ...structuredClone(room) };
    },
  };
}
