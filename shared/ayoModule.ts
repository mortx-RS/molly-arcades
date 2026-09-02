import type { GameModule, Player } from "./types";

export interface AyoState {
  playerIds: [string, string];
  playerNames: Record<string, string>;
  board: number[];
  captures: Record<string, number>;
  currentTurn: string;
  winnerId: string | null;
  scores: Record<string, number>;
}

type AyoAction =
  | { type: "sow"; pit: number }
  | { type: "resign" };

const INITIAL_SEEDS = 4;
const BOARD_SIZE = 12;

function getOppositePit(pit: number): number {
  return 11 - pit;
}

export const ayoModule: GameModule<AyoState, AyoAction> = {
  id: "ayo",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]) {
    const board = Array(BOARD_SIZE).fill(INITIAL_SEEDS);
    const captures: Record<string, number> = {};
    const scores: Record<string, number> = {};
    for (const p of players) {
      captures[p.id] = 0;
      scores[p.id] = 0;
    }
    return {
      playerIds: [players[0]!.id, players[1]!.id],
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      board,
      captures,
      currentTurn: players[0]!.id,
      winnerId: null,
      scores,
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "resign") {
      const other = state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];
      const scores = { ...state.scores };
      scores[other] = (scores[other] ?? 0) + 10;
      return {
        ...state,
        winnerId: other,
        scores,
      };
    }

    if (action.type === "sow") {
      const { pit } = action;
      const myStart = state.playerIds[0] === playerId ? 0 : 6;
      const myEnd = myStart + 5;
      if (pit < myStart || pit > myEnd) return state;
      if (state.board[pit] === 0) return state;

      const board = [...state.board];
      const captures = { ...state.captures };
      let seeds = board[pit]!;
      board[pit] = 0;
      let current = pit;

      while (seeds > 0) {
        current = (current + 1) % BOARD_SIZE;
        board[current]!++;
        seeds--;
      }

      let captured = false;
      while (current >= myStart && current <= myEnd && board[current]! >= 2 && board[current]! <= 3) {
        captures[playerId]! += board[current]!;
        board[current] = 0;
        captured = true;
        current = (current - 1 + BOARD_SIZE) % BOARD_SIZE;
      }

      const totalCaptured = Object.values(captures).reduce((sum, c) => sum + c, 0);
      const emptyBoard = board.every((s) => s === 0);
      let winnerId = state.winnerId;

      if (totalCaptured >= 24 || emptyBoard) {
        const p0Captures = captures[state.playerIds[0]]!;
        const p1Captures = captures[state.playerIds[1]]!;
        if (p0Captures > p1Captures) winnerId = state.playerIds[0]!;
        else if (p1Captures > p0Captures) winnerId = state.playerIds[1]!;
      }

      const scores = { ...state.scores };
      if (winnerId) {
        scores[winnerId] = (scores[winnerId] ?? 0) + 10;
      }

      const next = state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];
      return { ...state, board, captures, currentTurn: winnerId ? playerId : next, winnerId, scores };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    const totalCaptured = Object.values(state.captures).reduce((sum, c) => sum + c, 0);
    if (totalCaptured >= 24) {
      const p0 = state.captures[state.playerIds[0]]!;
      const p1 = state.captures[state.playerIds[1]]!;
      if (p0 > p1) return { over: true, winnerId: state.playerIds[0] };
      if (p1 > p0) return { over: true, winnerId: state.playerIds[1] };
      return { over: true };
    }
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      board: state.board,
      captures: state.captures,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      winnerId: state.winnerId,
      scores: state.scores,
      playerNames: state.playerNames,
      myId: playerId,
      myStart: state.playerIds[0] === playerId ? 0 : 6,
      myEnd: state.playerIds[0] === playerId ? 5 : 11,
    };
  },
};
