import type { GameModule, Player } from "./types";

export interface LudoToken {
  id: number;
  position: number;
  home: boolean;
  finished: boolean;
  /** Legacy field. Kept in the type for backward compatibility with the UI,
   *  but standard Ludo never removes the attacking piece on capture. */
  cleared: boolean;
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

/** Ring index where each seat's track begins. The first square for seat N is
 *  this index; the "home column" begins after completing the 52-square lap. */
const START_POSITIONS: Record<number, number> = {
  0: 0,
  1: 13,
  2: 26,
  3: 39,
};

function rand(max: number): number {
  return Math.floor(Math.random() * max);
}

// Standard Ludo safe squares (start squares + star squares) — immune from capture
const SAFE_IDX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

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

function seatIndex(playerId: string): number {
  return parseInt(playerId) % 4;
}

function recomputeLegal(state: LudoState) {
  const out: LudoMoveOption[] = [];
  const playerId = state.currentTurn;
  const tokens = state.tokens[playerId] ?? [];
  const homeIdx = START_POSITIONS[seatIndex(playerId)] ?? 0;

  for (const die of [0, 1] as const) {
    if (state.diceUsed[die] || state.dice[die] == null) continue;
    const d = state.dice[die]!;
    for (const t of tokens) {
      if (t.finished || t.cleared) continue;
      if (t.home) {
        // Standard Ludo: only a 6 brings a token out of the base/house
        if (d === 6) out.push({ tokenId: t.id, die, steps: 0 });
      } else {
        const relative = t.position - homeIdx;
        // 0..50 on the shared ring, 51..55 home column, 56 finish.
        // Exact count is required to enter home; overshoots are illegal.
        if (relative + d <= 56) out.push({ tokenId: t.id, die, steps: d });
      }
    }
  }
  state.legalMoves = out;
}

/** Capture a single opponent on the destination square. Returns true if a
 *  capture occurred. Standard Ludo: the attacker stays, the victim returns
 *  to its base. */
function resolveCaptures(state: LudoState, moverPid: string, moved: LudoToken): boolean {
  const dest = moved.position;
  if (moved.finished || moved.cleared || dest < 0 || dest > 51) return false;
  if (SAFE_IDX.has(dest)) return false;

  let hit = false;
  for (const pid of Object.keys(state.tokens)) {
    if (pid === moverPid) continue;
    for (const victim of state.tokens[pid]!) {
      if (victim.finished || victim.cleared) continue;
      if (victim.position === dest) {
        victim.position = -1;
        victim.home = true;
        hit = true;
      }
    }
  }
  return hit;
}

interface ApplyResult {
  entered: boolean;
  finished: boolean;
}

function applySteps(playerId: string, tokenId: number, steps: number, state: LudoState): ApplyResult {
  const homeIdx = START_POSITIONS[seatIndex(playerId)] ?? 0;
  const tokens = state.tokens[playerId] ?? [];
  const token = tokens.find((t) => t.id === tokenId);
  if (!token) return { entered: false, finished: false };

  if (steps === 0) {
    // Rolling a 6 deploys the token onto its starting square.
    token.position = homeIdx;
    token.home = false;
    return { entered: true, finished: false };
  }

  const relativeBefore = token.position - homeIdx;
  const relativeAfter = relativeBefore + steps;

  // Exact roll required to finish; overshoots are not allowed here because
  // recomputeLegal already filters them out.
  if (relativeAfter > 56) return { entered: false, finished: false };

  token.position += steps;
  if (relativeAfter === 56) {
    token.finished = true;
    token.position = -1;
    return { entered: false, finished: true };
  }
  return { entered: false, finished: false };
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
        { id: 0, position: -1, home: true, finished: false, cleared: false },
        { id: 1, position: -1, home: true, finished: false, cleared: false },
        { id: 2, position: -1, home: true, finished: false, cleared: false },
        { id: 3, position: -1, home: true, finished: false, cleared: false },
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

      const rolledSix = s.dice[0] === 6 || s.dice[1] === 6;
      const result = applySteps(playerId, opt.tokenId, opt.steps, s);
      const movedToken = (s.tokens[playerId] ?? []).find((t) => t.id === opt.tokenId);
      const captured = movedToken ? resolveCaptures(s, playerId, movedToken) : false;
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

      const bothUsed = s.diceUsed[0] && s.diceUsed[1];
      const extraRoll = rolledSix || captured || result.finished;

      if (s.legalMoves.length === 0) {
        endTurn(s, extraRoll);
      } else if (bothUsed) {
        endTurn(s, extraRoll);
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
    const playerSeats: Record<string, number> = {};
    state.playerIds.forEach((pid, idx) => {
      playerSeats[pid] = idx;
    });
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
      playerSeats,
      myId: playerId,
    };
  },
};
