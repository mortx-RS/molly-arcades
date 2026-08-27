import WebSocket from "ws";
import { spawn } from "node:child_process";

const PORT = 8795;
const URL_WS = `ws://127.0.0.1:${PORT}/ws`;

let failures = 0;
let checks = 0;

function check(label, cond) {
  checks++;
  if (cond) console.log(`  ok - ${label}`);
  else { failures++; console.log(`  FAIL - ${label}`); }
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

class TestClient {
  constructor() { this.ws = null; this.messages = []; this.waiters = []; this.closedCode = null; }

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
          if (w.pred(msg)) { w.resolve(msg); return false; }
          return true;
        });
      });
      ws.on("close", (code) => { this.closedCode = code; });
    });
  }

  send(obj) { this.ws.send(JSON.stringify(obj)); }

  next(pred, label, timeoutMs = 4000) {
    const existing = this.messages.find(pred);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${label}`)), timeoutMs);
      this.waiters.push({ pred, resolve: (m) => { clearTimeout(timer); resolve(m); }, reject: (e) => { clearTimeout(timer); reject(e); } });
    });
  }

  request(msg) {
    msg.id = Math.floor(Math.random() * 1e9);
    const ackP = this.next((m) => m.type === "ack" && m.id === msg.id, "ack");
    this.send(msg);
    return ackP;
  }

  kill() { this.ws.terminate(); }
}

async function main() {
  console.log(`starting server on :${PORT}…`);
  const child = spawn("npx", ["tsx", "server/index.ts"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(d));
  child.on("exit", () => {});

  try {
    const up = await waitUntil(() =>
      fetch(`http://127.0.0.1:${PORT}/healthz`).then((r) => r.ok).catch(() => false)
    );
    check("server up", up);
    if (!up) throw new Error("server never started");

    const A = new TestClient();
    const B = new TestClient();
    await A.connect();
    await B.connect();

    const created = await A.request({ type: "room:create", gameType: "archery", playerName: "Alice" });
    const roomId = created.data?.roomId;
    const aliceId = created.data?.playerId;
    check("room created", created.ok && /^[A-Z]+-\d{3}$/.test(roomId));

    const joinB = await B.request({ type: "room:join", roomId, playerName: "Bob" });
    const bobId = joinB.data?.playerId;
    check("bob joined", joinB.ok && typeof bobId === "string");

    await sleep(100);
    const roomStates = A.messages.filter((m) => m.type === "room:state");
    const lastState = roomStates[roomStates.length - 1];
    check("room has 2 players", lastState?.room.players.length === 2);
    check("room is in-progress", lastState?.room.status === "in-progress");
    check("room has gameState", lastState?.room.gameState !== null);

    const aliceGameState = await A.next((m) => m.type === "game:state" && m.you === aliceId, "alice game state");
    check("alice got game:state", !!aliceGameState);
    check("alice sees turn is hers", aliceGameState?.state.isMyTurn === true);

    const bobGameState = await B.next((m) => m.type === "game:state" && m.you === bobId, "bob game state");
    check("bob sees turn is alice's", bobGameState?.state.isMyTurn === false);

    const shotAck = await A.request({ type: "game:action", roomId, action: { angle: 45, power: 5 } });
    check("alice shot acked", shotAck.ok === true);

    await sleep(100);
    const aliceAfter = await A.next((m) => m.type === "game:state" && m.you === aliceId, "alice state after shot");
    const bobAfter = await B.next((m) => m.type === "game:state" && m.you === bobId, "bob state after shot");
    check("alice turn advanced to bob", aliceAfter?.state.turn === bobId);
    check("bob turn is his", bobAfter?.state.isMyTurn === true);
    check("alice score updated", (aliceAfter?.state.myScore ?? 0) > 0);

    const bobShotAck = await B.request({ type: "game:action", roomId, action: { angle: 30, power: 7 } });
    check("bob shot acked", bobShotAck.ok === true);
    await sleep(100);
    const aliceAfterBob = await A.next((m) => m.type === "game:state" && m.you === aliceId, "alice after bob shot");
    check("turn back to alice", aliceAfterBob?.state.turn === aliceId);

    A.kill();
    check("server still alive", true);
  } finally {
    child.kill("SIGTERM");
    await sleep(300);
    if (!child.killed) child.kill("SIGKILL");
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
