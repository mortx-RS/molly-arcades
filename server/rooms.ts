import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { GAME_CATALOG, type Player, type Room, type GameModule, type GameSession } from "../shared/types";
import type { ClientMessage, ServerMessage } from "../shared/protocol";
import { generateRoomCode, normalizeRoomCode } from "./roomCodes";
import { chessModule, crazy8Module, ticTacToeModule, connect4Module, snakeLadderModule, checkersModule, ludoModule, whotModule, ayoModule } from "../shared/gameModules";
import { ScoreManager } from "./scores";

const gameModuleRegistry = new Map<string, GameModule>();
gameModuleRegistry.set("chess", chessModule);
gameModuleRegistry.set("crazy8", crazy8Module);
gameModuleRegistry.set("tic_tac_toe", ticTacToeModule);
gameModuleRegistry.set("connect4", connect4Module);
gameModuleRegistry.set("snake_ladder", snakeLadderModule);
gameModuleRegistry.set("checkers", checkersModule);
gameModuleRegistry.set("ludo", ludoModule);
gameModuleRegistry.set("whot", whotModule);
gameModuleRegistry.set("ayo", ayoModule);

const envNum = (key: string, dflt: number): number => {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : dflt;
};

const SEAT_GRACE_MS = envNum("SEAT_GRACE_MS", 5 * 60_000);
const ROOM_TTL_MS = envNum("ROOM_TTL_MS", 60 * 60_000);
const EMPTY_ROOM_TTL_MS = envNum("EMPTY_ROOM_TTL_MS", 10 * 60_000);
const SWEEP_INTERVAL_MS = envNum("SWEEP_INTERVAL_MS", 30_000);
const HEARTBEAT_INTERVAL_MS = envNum("HEARTBEAT_INTERVAL_MS", 15_000);
const MAX_MESSAGE_BYTES = 16_384;
const MAX_NAME_LEN = 16;

interface Seat extends Player {
  lastSeenAt: number;
}

interface RoomInternal extends Omit<Room, "players"> {
  players: Seat[];
  lastActivityAt: number;
  gameModule?: GameModule;
  currentGame: GameSession | null;
  gameHistory: GameSession[];
}

interface ConnInfo {
  alive: boolean;
  seatRef?: { roomId: string; playerId: string };
  kicked?: boolean;
}

function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "Player";
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LEN);
  return cleaned.length > 0 ? cleaned : "Player";
}

export class RoomManager {
  private rooms = new Map<string, RoomInternal>();
  private conns = new Map<WebSocket, ConnInfo>();
  private seatSockets = new Map<string, WebSocket>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
  }

  stop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.heartbeatTimer = null;
    this.sweepTimer = null;
  }

  stats(): { rooms: number; sockets: number } {
    return { rooms: this.rooms.size, sockets: this.conns.size };
  }

  registerSocket(ws: WebSocket): void {
    this.conns.set(ws, { alive: true });
    ws.on("pong", () => {
      const info = this.conns.get(ws);
      if (info) info.alive = true;
    });
    ws.on("message", (data, isBinary) => this.handleMessage(ws, data, isBinary));
    ws.on("close", () => this.handleClose(ws));
    ws.on("error", () => ws.terminate());
  }

  private handleMessage(ws: WebSocket, data: unknown, isBinary: boolean): void {
    if (isBinary) return this.sendError(ws, "bad_message", "Binary frames are not accepted");
    let raw: string;
    try {
      raw = (data as Buffer).toString("utf8");
    } catch {
      return this.sendError(ws, "bad_message", "Undecodable message");
    }
    if (raw.length > MAX_MESSAGE_BYTES) {
      return this.sendError(ws, "too_large", "Message exceeds size limit");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.sendError(ws, "bad_message", "Invalid JSON");
    }
    const msg = parsed as Partial<ClientMessage>;
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
      return this.sendError(ws, "bad_message", "Missing message type");
    }
    switch (msg.type) {
      case "room:create":
        return this.handleCreate(ws, msg as ClientMessage & { type: "room:create" });
      case "room:join":
        return this.handleJoin(ws, msg as ClientMessage & { type: "room:join" });
      case "room:leave":
        return this.handleLeave(ws, msg as ClientMessage & { type: "room:leave" });
      case "room:select_game":
        return this.handleSelectGame(ws, msg as ClientMessage & { type: "room:select_game" });
      case "game:start":
        return this.handleGameStart(ws, msg as ClientMessage & { type: "game:start" });
      case "game:action":
        return this.handleGameAction(ws, msg as ClientMessage & { type: "game:action" });
      case "game:finish_round":
        return this.handleFinishRound(ws, msg as ClientMessage & { type: "game:finish_round" });
      case "game:rematch":
        return this.handleRematch(ws, msg as ClientMessage & { type: "game:rematch" });
      case "game:new_game":
        return this.handleNewGame(ws, msg as ClientMessage & { type: "game:new_game" });
      default:
        return this.sendError(ws, "unknown_type", `Unknown message type`, typeof msg.id === "number" ? msg.id : undefined);
    }
  }

  private handleCreate(ws: WebSocket, msg: ClientMessage & { type: "room:create" }): void {
    const id = wireId(msg);
    const gameType = msg.gameType || "";
    const entry = gameType ? GAME_CATALOG.find((g) => g.id === gameType) : null;
    if (gameType && !entry) return this.sendError(ws, "bad_game", `Unknown game "${String(gameType)}"`, id);

    const module = gameType ? gameModuleRegistry.get(gameType) : undefined;
    if (gameType && !module) return this.sendError(ws, "bad_game", `Game module not yet implemented for "${gameType}"`, id);

    const now = Date.now();
    const room: RoomInternal = {
      id: generateRoomCode(new Set(this.rooms.keys())),
      gameType: entry?.id ?? "",
      players: [],
      status: "lobby",
      gameState: null,
      createdAt: now,
      hostId: "",
      lastActivityAt: now,
      gameModule: module,
      currentGame: null,
      gameHistory: [],
    };
    const host = this.newSeat(sanitizeName(msg.playerName), now);
    room.players.push(host);
    room.hostId = host.id;
    this.rooms.set(room.id, room);

    this.bind(ws, room, host);
    this.recomputeHost(room);
    this.sendAck(ws, id, true, { roomId: room.id, playerId: host.id, gameType: room.gameType });
    this.broadcastRoom(room);
  }

  private handleJoin(ws: WebSocket, msg: ClientMessage & { type: "room:join" }): void {
    const id = wireId(msg);
    const code = normalizeRoomCode(String(msg.roomId ?? ""));
    const room = this.rooms.get(code);
    if (!room) return this.sendError(ws, "room_not_found", `Room ${code || "?"} does not exist`, id);

    let seat: Seat | undefined;
    if (typeof msg.playerId === "string" && msg.playerId.length > 0) {
      seat = room.players.find((p) => p.id === msg.playerId);
      if (!seat) return this.sendError(ws, "player_unknown", "Seat no longer exists in this room", id);
    }
    if (!seat && room.status !== "lobby") {
      return this.sendError(ws, "room_in_progress", "This match has already started", id);
    }
    const maxPlayers = GAME_CATALOG.find((g) => g.id === room.gameType)?.maxPlayers ?? 8;
    if (!seat && room.players.length >= maxPlayers) {
      return this.sendError(ws, "room_full", "This room is full", id);
    }

    if (!seat) {
      seat = this.newSeat(sanitizeName(msg.playerName), Date.now());
      room.players.push(seat);
    }
    this.bind(ws, room, seat);
    this.touch(room);
    this.recomputeHost(room);
    this.sendAck(ws, id, true, { roomId: room.id, playerId: seat.id });
    this.broadcastRoom(room);
  }

  private handleLeave(ws: WebSocket, msg: ClientMessage & { type: "room:leave" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendAck(ws, id, true, {});
    const { roomId, playerId } = info.seatRef;
    const room = this.rooms.get(roomId);
    this.clearSeatRef(ws);
    if (!room) return this.sendAck(ws, id, true, {});

    const idx = room.players.findIndex((p) => p.id === playerId);
    if (idx >= 0) room.players.splice(idx, 1);
    const key = `${roomId}:${playerId}`;
    if (this.seatSockets.get(key) === ws) this.seatSockets.delete(key);
    this.recomputeHost(room);
    this.touch(room);
    this.sendAck(ws, id, true, {});
    if (room.players.length === 0) {
      this.destroyRoom(room, "empty");
      return;
    }
    this.broadcastToRoom(room, { type: "room:player_left", playerId });
    this.broadcastRoom(room);
  }

  private handleSelectGame(ws: WebSocket, msg: ClientMessage & { type: "room:select_game" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);
    if (room.status !== "lobby") return this.sendError(ws, "game_already_started", "Game already started", id);

    const seat = room.players.find((p) => p.id === info.seatRef!.playerId);
    if (!seat?.isHost) return this.sendError(ws, "not_host", "Only the host can select the game", id);

    const entry = GAME_CATALOG.find((g) => g.id === msg.gameId);
    if (!entry) return this.sendError(ws, "bad_game", `Unknown game "${String(msg.gameId)}"`, id);

    const module = gameModuleRegistry.get(msg.gameId);
    if (!module) return this.sendError(ws, "bad_game", `Game module not yet implemented for "${msg.gameId}"`, id);

    room.gameType = entry.id;
    room.gameModule = module;
    this.touch(room);

    this.sendAck(ws, id, true, { gameId: room.gameType });
    this.broadcastRoom(room);
  }

  private handleGameStart(ws: WebSocket, msg: ClientMessage & { type: "game:start" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);
    if (room.status !== "lobby") return this.sendError(ws, "already_started", "Game already started", id);
    if (!room.gameModule) return this.sendError(ws, "no_game_selected", "Select a game first", id);

    const seat = room.players.find((p) => p.id === info.seatRef!.playerId);
    if (!seat?.isHost) return this.sendError(ws, "not_host", "Only the host can start the game", id);

    if (room.players.length < room.gameModule.minPlayers) {
      return this.sendError(ws, "not_enough_players", `Need at least ${room.gameModule.minPlayers} players`, id);
    }

    room.status = "in-progress";
    room.gameState = room.gameModule.createInitialState(room.players);
    room.currentGame = ScoreManager.createGameSession(
      room.gameType,
      ScoreManager.getMaxRounds(room.gameType)
    );
    this.touch(room);

    for (const p of room.players) {
      const seatWs = this.seatSockets.get(`${room.id}:${p.id}`);
      if (!seatWs || seatWs.readyState !== seatWs.OPEN) continue;
      const view = room.gameModule.getViewFor(room.gameState, p.id);
      this.sendTo(seatWs, { type: "game:state", state: view, you: p.id });
    }
    this.sendAck(ws, id, true, {});
    this.broadcastRoom(room);
  }

  private handleGameAction(ws: WebSocket, msg: ClientMessage & { type: "game:action" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);
    if (!room.gameModule) return this.sendError(ws, "bad_game", "No game module for this room", id);
    if (room.gameModule.mode !== "turn-based") return this.sendError(ws, "bad_game", "Not a turn-based game", id);
    if (!room.gameModule.reduce) return this.sendError(ws, "bad_game", "Game has no reduce method", id);

    const currentState = room.gameState;
    if (!currentState) return this.sendError(ws, "bad_game", "No game state yet", id);

    const playerId = info.seatRef.playerId;
    const reduced = room.gameModule.reduce(currentState, playerId, msg.action as never);
    room.gameState = reduced;
    this.touch(room);

    this.sendAck(ws, id, true, {});

    for (const p of room.players) {
      const seatWs = this.seatSockets.get(`${room.id}:${p.id}`);
      if (!seatWs || seatWs.readyState !== seatWs.OPEN) continue;
      const view = room.gameModule.getViewFor(reduced, p.id);
      this.sendTo(seatWs, { type: "game:state", state: view, you: p.id });
    }

    const result = room.gameModule.checkGameOver(reduced);
    if (result.over) {
      this.broadcastToRoom(room, { type: "game:over", winnerId: result.winnerId });
    }
  }

  private handleFinishRound(ws: WebSocket, msg: ClientMessage & { type: "game:finish_round" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);
    if (!room.currentGame) return this.sendError(ws, "no_active_game", "No active game session", id);
    if (room.currentGame.status !== "playing") return this.sendError(ws, "game_not_active", "Game is not in progress", id);

    const seat = room.players.find((p) => p.id === info.seatRef!.playerId);
    if (!seat?.isHost) return this.sendError(ws, "not_host", "Only the host can submit round scores", id);

    const { scores } = msg;
    if (!Array.isArray(scores)) return this.sendError(ws, "invalid_scores", "Scores must be an array", id);

    const updatedPlayers = ScoreManager.updateCumulativeScores(room.players, scores);
    room.players = room.players.map((seat) => {
      const updated = updatedPlayers.find((p) => p.id === seat.id);
      return { ...seat, cumulativeScore: updated?.cumulativeScore ?? seat.cumulativeScore };
    });
    room.currentGame = ScoreManager.recordRound(room.currentGame, scores);
    this.touch(room);

    this.sendAck(ws, id, true, {});

    this.broadcastToRoom(room, {
      type: "round:complete",
      roundNumber: room.currentGame.currentRound - 1,
      scores,
      cumulative: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        cumulativeScore: p.cumulativeScore,
      })),
    });

    if (room.currentGame.status === "finished") {
      room.gameHistory.push(room.currentGame);
      this.broadcastToRoom(room, {
        type: "game:session_over",
        session: room.currentGame,
        scoreboard: ScoreManager.getStandings(room.players).map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          connected: p.connected,
          cumulativeScore: p.cumulativeScore,
        })),
      });
    }

    this.broadcastRoom(room);
  }

  private handleRematch(ws: WebSocket, msg: ClientMessage & { type: "game:rematch" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);
    if (!room.gameModule) return this.sendError(ws, "bad_game", "No game module for this room", id);

    const seat = room.players.find((p) => p.id === info.seatRef!.playerId);
    if (!seat?.isHost) return this.sendError(ws, "not_host", "Only the host can start a rematch", id);

    room.status = "in-progress";
    room.gameState = room.gameModule.createInitialState(room.players);
    room.currentGame = ScoreManager.createGameSession(
      room.gameType,
      ScoreManager.getMaxRounds(room.gameType)
    );
    room.players = room.players.map((seat) => ({ ...seat, cumulativeScore: 0 }));
    this.touch(room);

    for (const p of room.players) {
      const seatWs = this.seatSockets.get(`${room.id}:${p.id}`);
      if (!seatWs || seatWs.readyState !== seatWs.OPEN) continue;
      const view = room.gameModule.getViewFor(room.gameState, p.id);
      this.sendTo(seatWs, { type: "game:state", state: view, you: p.id });
    }
    this.sendAck(ws, id, true, {});
    this.broadcastRoom(room);
  }

  private handleNewGame(ws: WebSocket, msg: ClientMessage & { type: "game:new_game" }): void {
    const id = wireId(msg);
    const info = this.conns.get(ws);
    if (!info?.seatRef) return this.sendError(ws, "not_in_room", "You are not in a room", id);

    const room = this.rooms.get(info.seatRef.roomId);
    if (!room) return this.sendError(ws, "room_not_found", "Room not found", id);

    const seat = room.players.find((p) => p.id === info.seatRef!.playerId);
    if (!seat?.isHost) return this.sendError(ws, "not_host", "Only the host can choose a new game", id);

    const entry = GAME_CATALOG.find((g) => g.id === msg.gameId);
    if (!entry) return this.sendError(ws, "bad_game", `Unknown game "${String(msg.gameId)}"`, id);

    const module = gameModuleRegistry.get(msg.gameId);
    if (!module) return this.sendError(ws, "bad_game", `Game module not yet implemented for "${msg.gameId}"`, id);

    room.gameType = entry.id;
    room.gameModule = module;
    room.status = "lobby";
    room.gameState = null;
    room.currentGame = null;
    room.players = room.players.map((seat) => ({ ...seat, cumulativeScore: 0 }));
    this.touch(room);
    this.sendAck(ws, id, true, {});
    this.broadcastRoom(room);
  }

  private handleClose(ws: WebSocket): void {
    const info = this.conns.get(ws);
    this.conns.delete(ws);
    if (!info || info.kicked) return;
    const ref = info.seatRef;
    if (!ref) return;
    this.clearSeatRef(ws);
    const room = this.rooms.get(ref.roomId);
    if (!room) return;
    const key = `${ref.roomId}:${ref.playerId}`;
    if (this.seatSockets.get(key) === ws) this.seatSockets.delete(key);
    const seat = room.players.find((p) => p.id === ref.playerId);
    if (seat) {
      seat.connected = false;
      seat.lastSeenAt = Date.now();
    }
    this.recomputeHost(room);
    this.touch(room);
    this.broadcastRoom(room);
  }

  private bind(ws: WebSocket, room: RoomInternal, seat: Seat): void {
    const info = this.conns.get(ws);
    if (!info) return;
    const key = `${room.id}:${seat.id}`;
    const prev = this.seatSockets.get(key);
    if (prev && prev !== ws) {
      const prevInfo = this.conns.get(prev);
      if (prevInfo) {
        prevInfo.kicked = true;
        prevInfo.seatRef = undefined;
      }
      try {
        prev.close(4001, "superseded");
      } catch {
        try { prev.terminate(); } catch { /* already gone */ }
      }
    }
    info.seatRef = { roomId: room.id, playerId: seat.id };
    this.seatSockets.set(key, ws);
    seat.connected = true;
    seat.lastSeenAt = Date.now();
  }

  private clearSeatRef(ws: WebSocket): void {
    const info = this.conns.get(ws);
    if (info) info.seatRef = undefined;
  }

  private recomputeHost(room: RoomInternal): void {
    const next = room.players.find((p) => p.connected) ?? room.players[0];
    room.hostId = next ? next.id : "";
    for (const p of room.players) p.isHost = p.id === room.hostId;
  }

  private newSeat(name: string, now: number): Seat {
    return { id: randomUUID(), name, isHost: false, connected: false, lastSeenAt: now, cumulativeScore: 0 };
  }

  private touch(room: RoomInternal): void {
    room.lastActivityAt = Date.now();
  }

  private snapshot(room: RoomInternal): Room {
    return {
      id: room.id,
      gameType: room.gameType,
      status: room.status,
      gameState: room.gameState,
      createdAt: room.createdAt,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connected,
        cumulativeScore: p.cumulativeScore,
      })),
      currentGame: room.currentGame,
      gameHistory: room.gameHistory,
    };
  }

  private broadcastRoom(room: RoomInternal): void {
    const snap = this.snapshot(room);
    for (const p of room.players) {
      const ws = this.seatSockets.get(`${room.id}:${p.id}`);
      if (ws) this.sendTo(ws, { type: "room:state", room: snap, you: p.id });
    }
  }

  private broadcastToRoom(room: RoomInternal, msg: ServerMessage): void {
    for (const p of room.players) {
      const ws = this.seatSockets.get(`${room.id}:${p.id}`);
      if (ws) this.sendTo(ws, msg);
    }
  }

  private sendTo(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(JSON.stringify(msg)); } catch { /* dropped */ }
    }
  }

  private sendAck(ws: WebSocket, id: number, ok: boolean, data?: unknown, error?: string): void {
    const payload: ServerMessage = ok
      ? { type: "ack", id, ok, data }
      : { type: "ack", id, ok, error: error ?? "failed" };
    this.sendTo(ws, payload);
  }

  private sendError(ws: WebSocket, code: string, message: string, ref?: number): void {
    const payload: ServerMessage = ref !== undefined ? { type: "error", code, message, ref } : { type: "error", code, message };
    this.sendTo(ws, payload);
  }

  createDetached(gameType: string, playerName: string): { roomId: string; playerId: string } | { error: string } {
    const entry = GAME_CATALOG.find((g) => g.id === gameType);
    if (!entry) return { error: `Unknown game "${gameType}"` };
    const now = Date.now();
    const room: RoomInternal = {
      id: generateRoomCode(new Set(this.rooms.keys())),
      gameType: entry.id,
      players: [],
      status: "lobby",
      gameState: null,
      createdAt: now,
      hostId: "",
      lastActivityAt: now,
      currentGame: null,
      gameHistory: [],
    };
    const host = this.newSeat(sanitizeName(playerName), now);
    room.players.push(host);
    room.hostId = host.id;
    this.rooms.set(room.id, room);
    return { roomId: room.id, playerId: host.id };
  }

  joinDetached(roomId: string, playerName: string): { playerId: string } | { error: string; code: string } {
    const room = this.rooms.get(normalizeRoomCode(roomId));
    if (!room) return { error: "Room not found", code: "room_not_found" };
    const maxPlayers = GAME_CATALOG.find((g) => g.id === room.gameType)?.maxPlayers ?? 8;
    if (room.status !== "lobby") return { error: "Match already started", code: "room_in_progress" };
    if (room.players.length >= maxPlayers) return { error: "Room full", code: "room_full" };
    const seat = this.newSeat(sanitizeName(playerName), Date.now());
    room.players.push(seat);
    this.touch(room);
    return { playerId: seat.id };
  }

  describeRoom(roomId: string): Record<string, unknown> | null {
    const room = this.rooms.get(normalizeRoomCode(roomId));
    if (!room) return null;
    const maxPlayers = GAME_CATALOG.find((g) => g.id === room.gameType)?.maxPlayers ?? 8;
    return {
      id: room.id,
      gameType: room.gameType,
      status: room.status,
      playerCount: room.players.filter((p) => p.connected).length,
      seatedCount: room.players.length,
      maxPlayers,
      createdAt: room.createdAt
    };
  }

  private destroyRoom(room: RoomInternal, reason: string): void {
    this.rooms.delete(room.id);
    for (const p of room.players) {
      const key = `${room.id}:${p.id}`;
      const ws = this.seatSockets.get(key);
      if (ws) {
        this.seatSockets.delete(key);
        const info = this.conns.get(ws);
        if (info) info.seatRef = undefined;
        this.sendTo(ws, { type: "room:closed", reason });
        try { ws.close(1000, "room-closed"); } catch { /* gone */ }
      }
    }
  }

  private heartbeat(): void {
    for (const [ws, info] of this.conns) {
      if (!info.alive) {
        try { ws.terminate(); } catch { /* gone */ }
        continue;
      }
      info.alive = false;
      try { ws.ping(); } catch { /* gone */ }
    }
  }

  private sweep(): void {
    const now = Date.now();
    for (const room of [...this.rooms.values()]) {
      let pruned = false;
      for (let i = room.players.length - 1; i >= 0; i--) {
        const seat = room.players[i];
        if (!seat || seat.connected || now - seat.lastSeenAt <= SEAT_GRACE_MS) continue;
        room.players.splice(i, 1);
        this.seatSockets.delete(`${room.id}:${seat.id}`);
        this.broadcastToRoom(room, { type: "room:player_left", playerId: seat.id });
        pruned = true;
      }
      if (pruned) this.recomputeHost(room);
      if (room.players.length === 0) {
        if (now - room.lastActivityAt > EMPTY_ROOM_TTL_MS) this.destroyRoom(room, "idle-empty");
        continue;
      }
      if (now - room.lastActivityAt > ROOM_TTL_MS) {
        this.destroyRoom(room, "idle-timeout");
        continue;
      }
      if (pruned) {
        this.touch(room);
        this.broadcastRoom(room);
      }
    }
  }
}

function wireId(msg: Partial<ClientMessage>): number {
  return typeof msg.id === "number" ? msg.id : 0;
}
