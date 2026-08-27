import type { Room } from "./types";

export interface WireEnvelope {
  id?: number;
}

export type ClientMessage =
  | (WireEnvelope & { type: "room:create"; gameType: string; playerName: string })
  | (WireEnvelope & { type: "room:join"; roomId: string; playerName: string; playerId?: string })
  | (WireEnvelope & { type: "room:leave" })
  | (WireEnvelope & { type: "game:start" })
  | (WireEnvelope & { type: "game:action"; roomId: string; action: unknown })
  | (WireEnvelope & { type: "game:input"; roomId: string; input: unknown });

export type ServerMessage =
  | { type: "ack"; id: number; ok: boolean; data?: unknown; error?: string }
  | { type: "room:state"; room: Room; you: string }
  | { type: "room:player_left"; playerId: string }
  | { type: "room:closed"; reason: string }
  | { type: "game:state"; state: unknown; you: string }
  | { type: "game:over"; winnerId?: string }
  | { type: "error"; code: string; message: string; ref?: number };

export type AckResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface CreatedRoomPayload {
  roomId: string;
  playerId: string;
  gameType: string;
}

export interface JoinedRoomPayload {
  roomId: string;
  playerId: string;
}

export interface GameActionI<TAction = never> {
  type: "game:action";
  action: TAction;
}

export interface GameStateI<TState = never> {
  type: "game:state";
  state: TState;
}
