import { spawn } from "node:child_process";
import WebSocket from "ws";

const PORT = 8790;
const BASE = `http://127.0.0.1:${PORT}`;
const URL_WS = `ws://127.0.0.1:${PORT}/ws`;

let failures = 0;
let checks = 0;

function check(label, cond) {
  checks++;
  if (cond) {
    console.log(`  ok - ${label}`);
  } else {
    failures++;
    console.log(`  FAIL - ${label}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitUntil(fn, timeoutMs = 5000, everyMs = 50) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (fn()) return true;
    if (Date.now() > deadline) return false;
    await sleep(everyMs);
  }
}

function httpJson(method, path, body) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => null) }));
}

class TestClient {
  constructor() {
    this.ws = null;
    this.messages = [];
    this.waiters = [];
    this.closedCode = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(URL_WS);
      this.ws = ws;
      ws.on("open", resolve);
      ws.on("error", reject);
      ws.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        this.messages.push(msg);
        this.waiters = this.waiters.filter((w) => {
          if (w.pred(msg)) {
            w.resolve(msg);
            return false;
          }
          return true;
        });
      });
      ws.on("close", (code) => {
        this.closedCode = code;
        for (const w of this.waiters.splice(0)) w.reject(new Error("socket closed"));
      });
    });
  }

  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }

  next(pred, label, timeoutMs = 4000) {
    const existing = this.messages.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), timeoutMs);
      this.waiters.push({
        pred,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        }
      });
    });
  }

  request(msg) {
    msg.id = Math.floor(Math.random() * 1e9);
    const ackP = this.next((m) => m.type === "ack" && m.id === msg.id, `ack#${msg.id}`);
    this.send(msg);
    return ackP;
  }

  kill() {
    if (this.ws) this.ws.terminate();
  }

  close() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }
}

const statesOf = (c) => c.messages.filter((m) => m.type === "room:state");

async function main() {
  console.log(`starting server on :${PORT} with fast timers…`);
  const child = spawn("npx", ["tsx", "server/index.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: {
      ...process.env,
      PORT: String(PORT),
      SEAT_GRACE_MS: "1200",
      EMPTY_ROOM_TTL_MS: "2500",
      SWEEP_INTERVAL_MS: "250",
      HEARTBEAT_INTERVAL_MS: "1000"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let exited = null;
  child.stdout.on("data", (d) => process.stdout.write(`[srv] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[srv!] ${d}`));
  child.on("exit", (code, sig) => {
    exited = code;
    console.log(`[srv] exited code=${code} sig=${sig}`);
  });

  try {
    const up = await waitUntil(() =>
      fetch(`${BASE}/healthz`).then((r) => r.ok).catch(() => false)
    );
    check("server came up", up);
    if (!up) throw new Error("server never became healthy");

    console.log("\n[HTTP endpoints]");
    const games = await httpJson("GET", "/api/games");
    check("GET /api/games lists 4 games", games.status === 200 && Array.isArray(games.body) && games.body.length === 4);

    const created = await httpJson("POST", "/api/rooms", { gameType: "archery", playerName: "HttpHost" });
    check("POST /api/rooms returns roomId+playerId", created.status === 201 && /^[A-Z]+-\d{3}$/.test(created.body.roomId ?? ""));
    const described = await httpJson("GET", `/api/rooms/${created.body.roomId}`);
    check("GET /api/rooms/:id describes room", described.status === 200 && described.body.seatedCount === 1);
    const joinedHttp = await httpJson("POST", `/api/rooms/${created.body.roomId}/join`, { playerName: "HttpJoiner" });
    check("POST /api/rooms/:id/join seats a player", joinedHttp.status === 200 && typeof joinedHttp.body.playerId === "string");
    const missing = await httpJson("GET", "/api/rooms/ZZZ-999");
    check("unknown room -> 404", missing.status === 404);

    console.log("\n[WS create + join]");
    const host = new TestClient();
    const guest = new TestClient();
    await host.connect();
    await guest.connect();

    const createdAck = await host.request({ type: "room:create", gameType: "golf", playerName: "Ada" });
    const roomId = createdAck.data?.roomId;
    const hostId = createdAck.data?.playerId;
    check("room:create acked with FOX-482 style code", createdAck.ok === true && /^[A-Z]+-\d{3}$/.test(roomId ?? ""));

    const hostState1 = await host.next((m) => m.type === "room:state", "host initial state");
    check(
      "host sees itself as sole connected host",
      hostState1.you === hostId &&
        hostState1.room.players.length === 1 &&
        hostState1.room.players[0].isHost === true &&
        hostState1.room.players[0].connected === true &&
        hostState1.room.status === "lobby" &&
        hostState1.room.gameState === null
    );

    const joinAck = await guest.request({ type: "room:join", roomId, playerName: "Bruno" });
    const guestId = joinAck.data?.playerId;
    check("guest join acked with playerId", joinAck.ok === true && typeof guestId === "string");

    const hostState2 = await host.next((m) => m.type === "room:state" && m.room.players.length === 2, "host sees guest");
    check("host notified of guest", hostState2.room.players.some((p) => p.name === "Bruno"));
    const guestState = await guest.next((m) => m.type === "room:state" && m.room.players.length === 2, "guest full state");
    check("guest snapshot matches data model shape", guestId !== undefined && guestState.you === guestId && guestState.room.hostId === hostId);

    const badJoin = await new TestClient();
    await badJoin.connect();
    const badAck = await badJoin.request({ type: "room:join", roomId: "ZZZ-999", playerName: "Ghost" });
    check("joining unknown room errors", badAck.ok === false && badAck.error === "room_not_found");
    badJoin.close();

    console.log("\n[disconnect -> host migration]");
    host.kill();
    const afterDrop = await guest.next(
      (m) => m.type === "room:state" && m.room.players.find((p) => p.id === hostId)?.connected === false,
      "guest sees host drop"
    );
    check("guest marks host disconnected", !!afterDrop);
    check("host migrated to remaining connected player", afterDrop.room.hostId === guestId);

    console.log("\n[reconnect restores seat]");
    const hostAgain = new TestClient();
    await hostAgain.connect();
    const reAck = await hostAgain.request({ type: "room:join", roomId, playerId: hostId, playerName: "Ada" });
    check("reconnect with playerId reclaims seat", reAck.ok === true && reAck.data?.playerId === hostId);
    const backState = await guest.next(
      (m) => m.type === "room:state" && m.room.players.find((p) => p.id === hostId)?.connected === true,
      "guest sees host back"
    );
    check("guest sees host connected again", backState.room.players.length === 2);
    check("host stays migrated while away-host returns", backState.room.hostId === guestId);

    console.log("\n[duplicate connection supersedes old socket]");
    const hostThird = new TestClient();
    await hostThird.connect();
    await hostThird.request({ type: "room:join", roomId, playerId: hostId, playerName: "Ada" });
    const superseded = await waitUntil(() => hostAgain.closedCode === 4001);
    check("old socket closed with 4001 superseded", superseded);
    hostAgain.close();

    console.log("\n[leave + prune + ttl cleanup]");
    guest.send({ type: "room:leave", id: 777 });
    const leftEvt = await hostThird.next((m) => m.type === "room:player_left" && m.playerId === guestId, "player_left event");
    check("room:player_left broadcast on leave", !!leftEvt);
    const shrunk = await hostThird.next((m) => m.type === "room:state" && m.room.players.length === 1, "state shrinks");
    check("leaver removed from roster, host reclaimed", shrunk.room.hostId === hostId && shrunk.room.players[0]?.id === hostId);

    hostThird.kill();
    const observer = new TestClient();
    await observer.connect();
    await observer.request({ type: "room:join", roomId, playerName: "Cleo" });
    const prunedEvt = await observer.next((m) => m.type === "room:player_left" && m.playerId === hostId, "grace prune", 6000);
    check("disconnected seat pruned after grace period", !!prunedEvt);
    const finalState = await observer.next((m) => m.type === "room:state" && m.room.players.every((p) => p.id !== hostId), "final roster", 3000);
    check("pruned seat gone from roster, observer is host", finalState.room.hostId === observer.messages.find((m) => m.type === "ack")?.data?.playerId);

    observer.kill();
    const emptyGone = await waitUntil(async () => {
      const r = await httpJson("GET", `/api/rooms/${roomId}`);
      return r.status === 404;
    }, 8000, 200);
    check("empty room deleted after empty-TTL", emptyGone);

    console.log("\n[malformed input]");
    const rude = new TestClient();
    await rude.connect();
    rude.send("not json at all!!!");
    const errBack = await rude.next((m) => m.type === "error" && m.code === "bad_message", "error frame");
    check("garbage payload answered with error frame", errBack.code === "bad_message");
    rude.close();

    check("server stayed alive throughout", exited === null);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (exited === null && !child.killed) child.kill("SIGKILL");
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
