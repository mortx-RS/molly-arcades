import type { GameModule, Player } from "./types";

export interface SnakeLadderState {
  playerIds: string[];
  playerNames: Record<string, string>;
  positions: Record<string, number>;
  currentTurn: string;
  dice: number | null;
  winnerId: string | null;
  scores: Record<string, number>;
}

type SnakeLadderAction =
  | { type: "roll" }
  | { type: "move" };

const SNAKES: Record<number, number> = {
  16: 6,
  47: 26,
  49: 11,
  56: 53,
  62: 19,
  64: 60,
  87: 24,
  93: 73,
  95: 75,
  98: 78,
};

const LADDERS: Record<number, number> = {
  1: 38,
  4: 14,
  9: 31,
  21: 42,
  28: 84,
  36: 44,
  51: 67,
  71: 91,
  80: 100,
};

function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export const snakeLadderModule: GameModule<SnakeLadderState, SnakeLadderAction> = {
  id: "snake_ladder",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(players: Player[]) {
    const positions: Record<string, number> = {};
    for (const p of players) {
      positions[p.id] = 0;
    }
    return {
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      positions,
      currentTurn: players[0]!.id,
      dice: null,
      winnerId: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "roll") {
      const dice = rollDice();
      const pos = state.positions[playerId] ?? 0;
      let newPos = pos + dice;
      if (newPos > 100) newPos = pos;
      if (SNAKES[newPos]) newPos = SNAKES[newPos]!;
      if (LADDERS[newPos]) newPos = LADDERS[newPos]!;
      const positions = { ...state.positions, [playerId]: newPos };
      let winnerId: string | null = null;
      if (newPos === 100) winnerId = playerId;
      const scores = { ...state.scores };
      if (winnerId) {
        for (const [pid, score] of Object.entries(scores)) {
          scores[pid] = pid === winnerId ? score + 10 : score + 3;
        }
      }
      const currentTurn = winnerId
        ? playerId
        : state.playerIds[(state.playerIds.indexOf(playerId) + 1) % state.playerIds.length]!;
      return { ...state, positions, dice, winnerId, scores, currentTurn };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    for (const [pid, pos] of Object.entries(state.positions)) {
      if (pos === 100) return { over: true, winnerId: pid };
    }
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      positions: state.positions,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      dice: state.dice,
      winnerId: state.winnerId,
      scores: state.scores,
      playerNames: state.playerNames,
      myId: playerId,
      snakes: SNAKES,
      ladders: LADDERS,
    };
  },
};
