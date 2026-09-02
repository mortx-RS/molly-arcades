import type { GameModule, Player } from "./types";

export interface LudoToken {
  id: number;
  position: number;
  home: boolean;
  finished: boolean;
}

export interface LudoMoveOption {
  tokenId: number;
  die: number;
  steps: number;
}

export interface LudoState {
  playerIds: string[];
  playerNames: Record<string, string>;
  tokens: Record<string, LudoToken[]>;
  currentTurn: string;
  dice: [number | null, number | null];
  diceUsed: [boolean, boolean];
  legalMoves: LudoMoveOption[];
  winnerId: string | null;
  scores: Record<string, number>;
}

type LudoAction =
  | { type: "roll" }
  | { type: "move"; tokenId: number; die: number }
  | { type: "pass" };

const HOME_POSITIONS: Record<number, number> = {
  0: 0,
  1: 13,
  2: 26,
  3: 39,
};

function rand(max: number): number {
  return Math.floor(Math.random() * max);
}

function nextPlayerId(state: LudoState): string {
  const idx = state.playerIds.indexOf(state.currentTurn);
  return state.playerIds[(idx + 1) % state.playerIds.length]!;
}

function endTurn(state: LudoState, extraRoll: boolean) {
  state.dice = [null, null];
  state.diceUsed = [false, false];
  state.legalMoves = [];
  if (!extraRoll) state.currentTurn = nextPlayerId(state);
}

function recomputeLegal(state: LudoState) {
  const out: LudoMoveOption[] = [];
  const playerId = state.currentTurn;
  const tokens = state.tokens[playerId] ?? [];
  const homeIdx = HOME_POSITIONS[parseInt(playerId) % 4] ?? 0;

  for (const die of [0, 1] as const) {
    if (state.diceUsed[die] || state.dice[die] == null) continue;
    const d = state.dice[die]!;
    for (const t of tokens) {
      if (t.finished) continue;
      if (t.home) {
        if (d === 6) out.push({ tokenId: t.id, die, steps: 0 });
      } else {
        const p = t.position - homeIdx;
        if (p + d <= 56) out.push({ tokenId: t.id, die, steps: d });
      }
    }
  }
  state.legalMoves = out;
}

function applySteps(playerId: string, tokenId: number, steps: number, state: LudoState) {
  const homeIdx = HOME_POSITIONS[parseInt(playerId) % 4] ?? 0;
  const tokens = state.tokens[playerId] ?? [];
  const token = tokens.find((t) => t.id === tokenId);
  if (!token) return;

  if (steps === 0) {
    token.position = homeIdx;
    token.home = false;
    return;
  }

  token.position += steps;
  const relativePos = token.position - homeIdx;
  if (relativePos >= 56) {
    token.finished = true;
    token.position = -1;
  }
}

export const ludoModule: GameModule<LudoState, LudoAction> = {
  id: "ludo",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(players: Player[]) {
    const tokens: Record<string, LudoToken[]> = {};
    for (const p of players) {
      tokens[p.id] = [
        { id: 0, position: -1, home: true, finished: false },
        { id: 1, position: -1, home: true, finished: false },
        { id: 2, position: -1, home: true, finished: false },
        { id: 3, position: -1, home: true, finished: false },
      ];
    }
    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = 0;
    }
    return {
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      tokens,
      currentTurn: players[0]!.id,
      dice: [null, null],
      diceUsed: [false, false],
      legalMoves: [],
      winnerId: null,
      scores,
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "roll") {
      if (state.dice[0] !== null) return state;
      const s = { ...state };
      s.dice = [1 + rand(6), 1 + rand(6)];
      s.diceUsed = [false, false];
      recomputeLegal(s);
      if (s.legalMoves.length === 0) {
        endTurn(s, false);
      }
      return s;
    }

    if (action.type === "pass") {
      if (state.dice[0] === null) return state;
      const s = { ...state };
      endTurn(s, false);
      return s;
    }

    if (action.type === "move") {
      if (state.dice[0] === null) return state;
      const s = {
        ...state,
        tokens: Object.fromEntries(
          Object.entries(state.tokens).map(([k, v]) => [k, v.map((t) => ({ ...t }))])
        ),
        dice: [...state.dice] as [number | null, number | null],
        diceUsed: [...state.diceUsed] as [boolean, boolean],
        legalMoves: [...state.legalMoves],
      };

      const opt = s.legalMoves.find((o) => o.tokenId === action.tokenId && o.die === action.die);
      if (!opt) return state;

      applySteps(playerId, opt.tokenId, opt.steps, s);
      s.diceUsed[opt.die] = true;
      recomputeLegal(s);

      const allFinished = (s.tokens[playerId] ?? []).every((t) => t.finished);
      if (allFinished) {
        s.winnerId = playerId;
        const scores = { ...s.scores };
        for (const [pid, score] of Object.entries(scores)) {
          scores[pid] = pid === playerId ? score + 10 : score + 4;
        }
        s.scores = scores;
        endTurn(s, false);
        s.winnerId = playerId;
        return s;
      }

      const doubles = s.dice[0] === s.dice[1];
      const bothUsed = s.diceUsed[0] && s.diceUsed[1];
      if (s.legalMoves.length === 0) {
        endTurn(s, doubles && bothUsed);
      } else if (bothUsed && !doubles) {
        endTurn(s, false);
      } else if (bothUsed && doubles) {
        s.diceUsed = [false, false];
        recomputeLegal(s);
        if (s.legalMoves.length === 0) endTurn(s, false);
      }

      return s;
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    for (const [pid, tokens] of Object.entries(state.tokens)) {
      if (tokens.every((t) => t.finished)) return { over: true, winnerId: pid };
    }
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      tokens: state.tokens,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      dice: state.dice,
      diceUsed: state.diceUsed,
      legalMoves: state.legalMoves,
      winnerId: state.winnerId,
      scores: state.scores,
      playerNames: state.playerNames,
      myId: playerId,
    };
  },
};
