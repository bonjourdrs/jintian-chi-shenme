import { parseSyncPayload } from "../src/lib/coupleSync.ts";
export function syncApi(store) {
  return async function handle(
    req,
    res,
    next = () => {
      res.statusCode = 404;
      res.end("not found");
    },
  ) {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/api/rooms")) return next();
    const reply = (status, data) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify(data));
    };
    if (req.headers.origin) {
      try {
        if (new URL(req.headers.origin).host !== req.headers.host)
          return reply(403, { error: "来源无效" });
      } catch {
        return reply(403, { error: "来源无效" });
      }
    }
    const code = url.pathname.split("/")[3];
    if (code && !/^[A-Z0-9]{8}$/.test(code))
      return reply(400, { error: "房间号格式无效" });
    try {
      if (req.method === "GET" && code) {
        const room = store.get(code);
        return room ? reply(200, room) : reply(404, { error: "房间不存在" });
      }
      if (!["POST", "PUT"].includes(req.method))
        return reply(405, { error: "方法不支持" });
      let size = 0,
        body = "";
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 4_000_000) return reply(413, { error: "同步包过大" });
        body += chunk;
      }
      const parsed = JSON.parse(body),
        payload = parseSyncPayload(parsed);
      if (!payload?.sync) return reply(400, { error: "需要新版同步数据" });
      if (req.method === "POST" && !code)
        return reply(201, store.create(payload));
      if (req.method === "PUT" && code) {
        const revision = Number(req.headers["if-match"]);
        if (!Number.isSafeInteger(revision) || revision < 1)
          return reply(428, { error: "需要If-Match版本号" });
        const result = store.put(code, revision, payload);
        return reply(result.status, result);
      }
      reply(404, { error: "路径不存在" });
    } catch (error) {
      reply(error instanceof SyntaxError ? 400 : 500, {
        error:
          error instanceof SyntaxError
            ? "请求内容无效"
            : "保存失败，请稍后重试",
      });
    }
  };
}
