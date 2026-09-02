import type { GameModule, Player } from "./types";

export interface CheckersPiece {
  id: number;
  row: number;
  col: number;
  color: "light" | "dark";
  king: boolean;
  captured: boolean;
}

export interface CheckersState {
  pieces: CheckersPiece[];
  currentTurn: string;
  playerIds: [string, string];
  playerNames: Record<string, string>;
  winnerId: string | null;
  scores: Record<string, number>;
}

type CheckersAction =
  | { type: "move"; pieceId: number; toRow: number; toCol: number }
  | { type: "resign" };

function getPieceAt(pieces: CheckersPiece[], row: number, col: number): CheckersPiece | undefined {
  return pieces.find((p) => p.row === row && p.col === col && !p.captured);
}

function getCapturedPieces(pieces: CheckersPiece[], row: number, col: number): number[] {
  return pieces.filter((p) => !p.captured).map((p) => p.id).filter((id) => {
    const piece = pieces.find((pp) => pp.id === id);
    if (!piece) return false;
    return Math.abs(piece.row - row) === 1 && Math.abs(piece.col - col) === 1;
  });
}

function isValidMove(state: CheckersState, piece: CheckersPiece, toRow: number, toCol: number): boolean {
  if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
  if (getPieceAt(state.pieces, toRow, toCol)) return false;
  const dr = toRow - piece.row;
  const dc = toCol - piece.col;
  if (piece.king) {
    if (Math.abs(dr) !== 1 || Math.abs(dc) !== 1) return false;
    return true;
  }
  const dir = piece.color === "light" ? 1 : -1;
  if (dr === dir && Math.abs(dc) === 1) return true;
  if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
    const midRow = piece.row + dr / 2;
    const midCol = piece.col + dc / 2;
    const midPiece = getPieceAt(state.pieces, midRow, midCol);
    if (midPiece && midPiece.color !== piece.color) return true;
  }
  return false;
}

function hasCaptures(state: CheckersState, playerId: string): boolean {
  const myPieces = state.pieces.filter((p) => !p.captured && p.color === (state.playerIds[0] === playerId ? "light" : "dark"));
  for (const piece of myPieces) {
    for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]] as [number, number][]) {
      const toRow = piece.row + dr;
      const toCol = piece.col + dc;
      if (isValidMove(state, piece, toRow, toCol)) return true;
    }
  }
  return false;
}

export const checkersModule: GameModule<CheckersState, CheckersAction> = {
  id: "checkers",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]) {
    const pieces: CheckersPiece[] = [];
    let id = 0;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          pieces.push({ id: id++, row, col, color: "dark", king: false, captured: false });
        }
      }
    }
    for (let row = 5; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 1) {
          pieces.push({ id: id++, row, col, color: "light", king: false, captured: false });
        }
      }
    }
    const scores: Record<string, number> = {};
    for (const p of players) {
      scores[p.id] = 0;
    }
    return {
      pieces,
      currentTurn: players[0]!.id,
      playerIds: [players[0]!.id, players[1]!.id],
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
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

    if (action.type === "move") {
      const piece = state.pieces.find((p) => p.id === action.pieceId);
      if (!piece || piece.captured) return state;
      const myColor = state.playerIds[0] === playerId ? "light" : "dark";
      if (piece.color !== myColor) return state;
      if (!isValidMove(state, piece, action.toRow, action.toCol)) return state;

      const pieces = state.pieces.map((p) => ({ ...p }));
      const movedPiece = pieces.find((p) => p.id === action.pieceId)!;
      movedPiece.row = action.toRow;
      movedPiece.col = action.toCol;
      if ((movedPiece.color === "light" && movedPiece.row === 7) ||
          (movedPiece.color === "dark" && movedPiece.row === 0)) {
        movedPiece.king = true;
      }

      const dr = action.toRow - piece.row;
      const dc = action.toCol - piece.col;
      if (Math.abs(dr) === 2 && Math.abs(dc) === 2) {
        const midRow = piece.row + dr / 2;
        const midCol = piece.col + dc / 2;
        const captured = pieces.find((p) => !p.captured && p.row === midRow && p.col === midCol);
        if (captured) captured.captured = true;
      }

      const opponentColor = myColor === "light" ? "dark" : "light";
      const opponentPieces = pieces.filter((p) => !p.captured && p.color === opponentColor);
      if (opponentPieces.length === 0) {
        const scores = { ...state.scores };
        scores[playerId] = (scores[playerId] ?? 0) + 10;
        return {
          ...state,
          pieces,
          winnerId: playerId,
          scores,
        };
      }

      const next = state.playerIds[0] === playerId ? state.playerIds[1] : state.playerIds[0];
      return { ...state, pieces, currentTurn: next };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    const lightPieces = state.pieces.filter((p) => !p.captured && p.color === "light");
    const darkPieces = state.pieces.filter((p) => !p.captured && p.color === "dark");
    if (lightPieces.length === 0) return { over: true, winnerId: state.playerIds[1] };
    if (darkPieces.length === 0) return { over: true, winnerId: state.playerIds[0] };
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      pieces: state.pieces,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      winnerId: state.winnerId,
      scores: state.scores,
      playerNames: state.playerNames,
      myId: playerId,
      myColor: state.playerIds[0] === playerId ? "light" : "dark",
    };
  },
};
