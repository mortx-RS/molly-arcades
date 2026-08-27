import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { GAME_CATALOG } from "../shared/types";
import { normalizeRoomCode } from "./roomCodes";
import { RoomManager } from "./rooms";

const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 8787;
const HERE = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = resolve(HERE, "..", "dist");

const manager = new RoomManager();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(payload);
}

async function readBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 16_384) return {};
    chunks.push(chunk as Buffer);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function handleApi(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/api/") && url.pathname !== "/healthz") return false;

  if (req.method === "GET" && url.pathname === "/api/games") {
    json(res, 200, GAME_CATALOG);
    return true;
  }
  if (req.method === "GET" && url.pathname === "/healthz") {
    json(res, 200, { ok: true, ...manager.stats() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/rooms") {
    const body = await readBody(req);
    const result = manager.createDetached(String(body.gameType ?? ""), String(body.playerName ?? ""));
    if ("error" in result) return json(res, 400, result), true;
    json(res, 201, result);
    return true;
  }

  const roomMatch = /^\/api\/rooms\/([^/]+)$/.exec(url.pathname);
  if (req.method === "GET" && roomMatch?.[1]) {
    const info = manager.describeRoom(decodeURIComponent(roomMatch[1]));
    if (!info) return json(res, 404, { error: "Room not found" }), true;
    json(res, 200, info);
    return true;
  }

  const joinMatch = /^\/api\/rooms\/([^/]+)\/join$/.exec(url.pathname);
  if (req.method === "POST" && joinMatch?.[1]) {
    const body = await readBody(req);
    const result = manager.joinDetached(decodeURIComponent(joinMatch[1]), String(body.playerName ?? ""));
    if ("error" in result) return json(res, result.code === "room_not_found" ? 404 : 409, result), true;
    json(res, 200, result);
    return true;
  }

  json(res, 404, { error: "Not found" });
  return true;
}

async function serveStatic(res: import("node:http").ServerResponse, pathname: string): Promise<void> {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const target = join(DIST_DIR, rel.replace(/\.\./g, ""));
  try {
    const data = await readFile(target);
    res.writeHead(200, {
      "content-type": MIME[extname(target)] ?? "application/octet-stream",
      "cache-control": rel.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache"
    });
    res.end(data);
  } catch {
    try {
      const index = await readFile(join(DIST_DIR, "index.html"));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
      res.end(index);
    } catch {
      res.writeHead(503, { "content-type": "text/plain" });
      res.end("Client bundle not built yet. Run: npm run build");
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (await handleApi(req, res, url)) return;
    if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
    await serveStatic(res, url.pathname);
  } catch (err) {
    json(res, 500, { error: "Internal error" });
  }
});

const wss = new WebSocketServer({ noServer: true });
server.on("upgrade", (req, socket, head) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (pathname !== "/ws") {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => manager.registerSocket(ws));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[molly] http+ws listening on http://0.0.0.0:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    manager.stop();
    server.close(() => process.exit(0));
    for (const ws of wss.clients) ws.close(1001, "server-shutdown");
    setTimeout(() => process.exit(0), 1500).unref();
  });
}
