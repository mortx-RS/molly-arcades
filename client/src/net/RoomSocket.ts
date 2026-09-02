import type { AckResult, ClientMessage, CreatedRoomPayload, JoinedRoomPayload, ServerMessage } from "../../../shared/protocol";
import type { Room, RoundScore, Player, GameSession } from "../../../shared/types";
import type { Session } from "./session";

export type SockStatus = "idle" | "connecting" | "open" | "reconnecting";

export interface SocketListener {
  onRoomState(room: Room, you: string): void;
  onPlayerLeft(playerId: string): void;
  onRoomClosed(reason: string): void;
  onGameState(state: unknown, you: string): void;
  onGameOver(winnerId?: string): void;
  onRoundComplete(roundNumber: number, scores: RoundScore[], cumulative: Player[]): void;
  onSessionOver(session: GameSession, scoreboard: Player[]): void;
  onSessionDead(reason: string): void;
  onError(message: string): void;
  onStatus(status: SockStatus): void;
}

const PERMANENT_ACK_ERRORS = new Set(["room_not_found", "player_unknown", "room_closed"]);
const REQUEST_TIMEOUT_MS = 8_000;

interface PendingRequest {
  resolve: (result: AckResult) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class RoomSocket {
  private ws: WebSocket | null = null;
  private pending = new Map<number, PendingRequest>();
  private attachWaiters: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private nextId = 1;
  private running = false;
  private attached = false;
  private backoffMs = 400;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getSession: () => Session | null,
    private readonly listener: SocketListener
  ) {}

  start(): void {
    this.ensureRunning();
  }

  stop(): void {
    this.running = false;
    this.failAttachWaiters(new Error("stopped"));
    this.rejectAllPending();
    this.clearReconnectTimer();
    const ws = this.ws;
    this.ws = null;
    this.attached = false;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      ws.onclose = null;
      try { ws.close(); } catch { /* gone */ }
    }
    this.listener.onStatus("idle");
  }

  poke(): void {
    if (!this.running) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.clearReconnectTimer();
    this.backoffMs = 400;
    this.connect();
  }

  async requestWhenOpen<T = unknown>(msg: ClientMessage, timeoutMs = REQUEST_TIMEOUT_MS): Promise<AckResult<T>> {
    this.ensureRunning();
    if (!this.attached) await this.waitForAttach(timeoutMs);
    return this.sendRaw<T>(msg, timeoutMs);
  }

  private ensureRunning(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  private connect(): void {
    if (this.ws) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}://${location.host}/ws`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    this.attached = false;
    this.listener.onStatus("connecting");

    ws.onopen = () => {
      const session = this.getSession();
      if (!session) {
        this.onAttached();
        return;
      }
      this.sendRaw({ type: "room:join", roomId: session.roomId, playerId: session.playerId, playerName: session.playerName })
        .then((res) => {
          if (res.ok) {
            this.onAttached();
            return;
          }
          this.running = false;
          this.attached = false;
          this.failAttachWaiters(new Error(res.error));
          this.rejectAllPending();
          const sock = this.ws;
          this.ws = null;
          if (sock && sock.readyState <= WebSocket.OPEN) {
            sock.onclose = null;
            try { sock.close(); } catch { /* gone */ }
          }
          this.listener.onStatus("idle");
          this.listener.onSessionDead(res.error);
        })
        .catch(() => {
          const sock = this.ws;
          if (sock && sock.readyState <= WebSocket.OPEN) sock.close();
        });
    };

    ws.onmessage = (ev: MessageEvent) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data)) as ServerMessage;
      } catch {
        return;
      }
      this.dispatch(msg);
    };

    ws.onclose = () => {
      const wasAttached = this.attached;
      this.ws = null;
      this.attached = false;
      this.failAttachWaiters(new Error("connection_closed"));
      this.rejectAllPending();
      if (!this.running) {
        this.listener.onStatus("idle");
        return;
      }
      this.listener.onStatus("reconnecting");
      if (wasAttached) this.backoffMs = 400;
      this.scheduleReconnect();
    };
  }

  private onAttached(): void {
    this.attached = true;
    this.backoffMs = 400;
    this.listener.onStatus("open");
    const waiters = this.attachWaiters.splice(0);
    for (const w of waiters) w.resolve();
  }

  private waitForAttach(timeoutMs: number): Promise<void> {
    if (this.attached) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const entry = { resolve, reject };
      this.attachWaiters.push(entry);
      setTimeout(() => {
        const idx = this.attachWaiters.indexOf(entry);
        if (idx >= 0) {
          this.attachWaiters.splice(idx, 1);
          reject(new Error("timeout"));
        }
      }, timeoutMs);
    });
  }

  private failAttachWaiters(err: Error): void {
    const waiters = this.attachWaiters.splice(0);
    for (const w of waiters) w.reject(err);
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const jitter = Math.random() * 150;
    this.reconnectTimer = setTimeout(() => this.connect(), this.backoffMs + jitter);
    this.backoffMs = Math.min(this.backoffMs * 2, 5_000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private sendRaw<T = unknown>(msg: ClientMessage, timeoutMs = REQUEST_TIMEOUT_MS): Promise<AckResult<T>> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return Promise.resolve({ ok: false, error: "not_connected" });
    const id = this.nextId++;
    const wire = { ...msg, id } as ClientMessage;
    return new Promise<AckResult<T>>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: "timeout" });
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result as AckResult<T>);
        },
        timer
      });
      try {
        ws.send(JSON.stringify(wire));
      } catch {
        this.pending.delete(id);
        clearTimeout(timer);
        resolve({ ok: false, error: "send_failed" });
      }
    });
  }

  private rejectAllPending(): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.resolve({ ok: false, error: "connection_closed" });
    }
    this.pending.clear();
  }

  private dispatch(msg: ServerMessage): void {
    switch (msg.type) {
      case "ack": {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.ok) p.resolve({ ok: true, data: msg.data });
          else p.resolve({ ok: false, error: msg.error ?? "failed" });
        }
        return;
      }
      case "room:state":
        if (this.attached) this.listener.onRoomState(msg.room, msg.you);
        return;
      case "room:player_left":
        if (this.attached) this.listener.onPlayerLeft(msg.playerId);
        return;
      case "game:state":
        if (this.attached) this.listener.onGameState(msg.state, msg.you);
        return;
      case "game:over":
        if (this.attached) this.listener.onGameOver(msg.winnerId);
        return;
      case "round:complete":
        if (this.attached) this.listener.onRoundComplete(msg.roundNumber, msg.scores, msg.cumulative);
        return;
      case "game:session_over":
        if (this.attached) this.listener.onSessionOver(msg.session, msg.scoreboard);
        return;
      case "room:closed": {
        this.running = false;
        this.attached = false;
        this.failAttachWaiters(new Error("room_closed"));
        this.rejectAllPending();
        this.clearReconnectTimer();
        const sock = this.ws;
        this.ws = null;
        if (sock && sock.readyState <= WebSocket.OPEN) {
          sock.onclose = null;
          try { sock.close(); } catch { /* gone */ }
        }
        this.listener.onStatus("idle");
        this.listener.onRoomClosed(msg.reason);
        return;
      }
      case "error":
        this.listener.onError(msg.message);
        return;
      default:
        return;
    }
  }
}

export type { AckResult, CreatedRoomPayload, JoinedRoomPayload };
