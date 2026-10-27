import type { IncomingMessage, ServerResponse } from "node:http";
import type { createRoomStore } from "./room-store.mjs";
export function syncApi(
  store: ReturnType<typeof createRoomStore>,
): (
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void,
) => Promise<void>;
