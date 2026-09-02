import type { GameModule, Player } from "./types";

export interface TicTacToeState {
  board: (string | null)[][];
  currentTurn: string;
  playerIds: [string, string];
  playerNames: Record<string, string>;
  winnerId: string | null;
  winnerLine: [number, number][] | null;
  draw: boolean;
  scores: Record<string, number>;
}

type TicTacToeAction =
  | { type: "move"; row: number; col: number }
  | { type: "resign" };

const WINNING_LINES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]],
];

function checkWinner(board: (string | null)[][]): { winnerId: string | null; line: [number, number][] | null } {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line as [[number, number], [number, number], [number, number]];
    const va = board[a[0]]?.[a[1]];
    const vb = board[b[0]]?.[b[1]];
    const vc = board[c[0]]?.[c[1]];
    if (va && va === vb && va === vc) {
      return { winnerId: va, line };
    }
  }
  return { winnerId: null, line: null };
}

function isDraw(board: (string | null)[][]): boolean {
  return board.every((row) => row.every((cell) => cell !== null));
}

export const ticTacToeModule: GameModule<TicTacToeState, TicTacToeAction> = {
  id: "tic_tac_toe",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]) {
    const board: (string | null)[][] = [
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ];
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

    if (action.type === "move") {
      const { row, col } = action;
      if (row < 0 || row > 2 || col < 0 || col > 2) return state;
      if (state.board[row]?.[col] !== null) return state;

      const board = state.board.map((r) => [...r]);
      board[row]![col] = playerId;
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
