import type { GameModule, Player } from "./types";

export interface Connect4State {
  board: (string | null)[][];
  currentTurn: string;
  playerIds: [string, string];
  playerNames: Record<string, string>;
  winnerId: string | null;
  winnerLine: [number, number][] | null;
  draw: boolean;
  scores: Record<string, number>;
}

type Connect4Action =
  | { type: "drop"; col: number }
  | { type: "resign" };

const ROWS = 6;
const COLS = 7;

function checkWinner(board: (string | null)[][]): { winnerId: string | null; line: [number, number][] | null } {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = board[r]?.[c];
      if (!val) continue;
      for (const [dr, dc] of dirs) {
        const line: [number, number][] = [[r, c]];
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && board[nr]?.[nc] === val) {
          line.push([nr, nc]);
          nr += dr;
          nc += dc;
        }
        if (line.length >= 4) return { winnerId: val, line };
      }
    }
  }
  return { winnerId: null, line: null };
}

function isDraw(board: (string | null)[][]): boolean {
  return board[0]!.every((cell) => cell !== null);
}

export const connect4Module: GameModule<Connect4State, Connect4Action> = {
  id: "connect4",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]) {
    const board: (string | null)[][] = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = 0;
    }
    return {
      board,
      currentTurn: players[0]!.id,
      playerIds: [players[0]!.id, players[1]!.id],
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      winnerId: null,
      winnerLine: null,
      draw: false,
      scores,
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId || state.draw) return state;
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

    if (action.type === "drop") {
      const { col } = action;
      if (col < 0 || col >= COLS) return state;
      const board = state.board.map((r) => [...r]);
      let targetRow = -1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r]![col] === null) {
          targetRow = r;
          break;
        }
      }
      if (targetRow === -1) return state;
      board[targetRow]![col] = playerId;
      const { winnerId, line } = checkWinner(board);
      if (winnerId) {
        const scores = { ...state.scores };
        scores[winnerId] = (scores[winnerId] ?? 0) + 10;
        return {
          ...state,
          board,
          winnerId,
          winnerLine: line,
          scores,
        };
      }
      if (isDraw(board)) {
        const scores = { ...state.scores };
        scores[state.playerIds[0]] = (scores[state.playerIds[0]] ?? 0) + 5;
        scores[state.playerIds[1]] = (scores[state.playerIds[1]] ?? 0) + 5;
        return {
          ...state,
          board,
          draw: true,
          scores,
        };
      }
      const next = state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];
      return { ...state, board, currentTurn: next };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    if (state.draw) return { over: true };
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      board: state.board,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      winnerId: state.winnerId,
      winnerLine: state.winnerLine,
      draw: state.draw,
      scores: state.scores,
      playerNames: state.playerNames,
      myId: playerId,
    };
  },
};
