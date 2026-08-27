import type { GameModule, Player } from "./types";

export type Color = "w" | "b";
export type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type Piece = { color: Color; type: PieceType };
export type Board = (Piece | null)[][];

export interface ChessState {
  board: Board;
  turn: Color;
  playerIds: string[];
  playerNames: Record<string, string>;
  whiteId: string;
  blackId: string;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: [number, number] | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  winnerId: string | null;
  result: string | null;
  lastMove: { from: [number, number]; to: [number, number] } | null;
  inCheck: boolean;
}

export type ChessAction =
  | { type: "move"; from: [number, number]; to: [number, number]; promotion?: PieceType }
  | { type: "resign" };

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function pieceAt(board: Board, r: number, c: number): Piece | null {
  return inBounds(r, c) ? (board[r]?.[c] ?? null) : null;
}

function initialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    board[0]![c] = { color: "w", type: backRank[c]! };
    board[1]![c] = { color: "w", type: "P" };
    board[6]![c] = { color: "b", type: "P" };
    board[7]![c] = { color: "b", type: backRank[c]! };
  }
  return board;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function findKing(board: Board, color: Color): [number, number] | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r]![c];
      if (p && p.type === "K" && p.color === color) return [r, c];
    }
  }
  return null;
}

function isAttackedBy(board: Board, r: number, c: number, byColor: Color): boolean {
  // Check knight attacks
  const knightMoves: [number, number][] = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  for (const [dr, dc] of knightMoves) {
    const p = pieceAt(board, r + dr, c + dc);
    if (p && p.color === byColor && p.type === "N") return true;
  }
  // Check king attacks
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const p = pieceAt(board, r + dr, c + dc);
      if (p && p.color === byColor && p.type === "K") return true;
    }
  }
  // Check pawn attacks
  const pawnDir = byColor === "w" ? 1 : -1;
  for (const dc of [-1, 1]) {
    const p = pieceAt(board, r + pawnDir, c + dc);
    if (p && p.color === byColor && p.type === "P") return true;
  }
  // Check sliding attacks (Rook/Queen for straight, Bishop/Queen for diagonal)
  const directions: [number, number][] = [
    [-1, 0], [1, 0], [0, -1], [0, 1], // straight
    [-1, -1], [-1, 1], [1, -1], [1, 1] // diagonal
  ];
  for (const [dr, dc] of directions) {
    for (let i = 1; i < 8; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (!inBounds(nr, nc)) break;
      const p = board[nr]?.[nc] ?? null;
      if (p) {
        if (p.color === byColor) {
          const isDiag = dr !== 0 && dc !== 0;
          if (p.type === "Q") return true;
          if (isDiag && p.type === "B") return true;
          if (!isDiag && p.type === "R") return true;
        }
        break;
      }
    }
  }
  return false;
}

function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  const enemy = color === "w" ? "b" : "w";
  return isAttackedBy(board, king[0], king[1], enemy);
}

function pseudoLegalMoves(state: ChessState, r: number, c: number): [number, number][] {
  const { board, turn, castling, enPassant } = state;
  const piece = board[r]![c];
  if (!piece || piece.color !== turn) return [];
  const moves: [number, number][] = [];
  const enemy = turn === "w" ? "b" : "w";

  const addIfValid = (nr: number, nc: number) => {
    if (!inBounds(nr, nc)) return false;
    const target = board[nr]![nc];
    if (target && target.color === turn) return false;
    moves.push([nr, nc]);
    return !target; // continue sliding if empty
  };

  switch (piece.type) {
    case "P": {
      const dir = turn === "w" ? 1 : -1;
      const startRow = turn === "w" ? 1 : 6;
      const promoRow = turn === "w" ? 7 : 0;
      // Forward
      if (inBounds(r + dir, c) && !board[r + dir]![c]) {
        moves.push([r + dir, c]);
        // Double push from start
        if (r === startRow && !board[r + dir * 2]![c]) {
          moves.push([r + dir * 2, c]);
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const target = board[nr]![nc];
        if (target && target.color === enemy) {
          moves.push([nr, nc]);
        }
        // En passant
        if (enPassant && enPassant[0] === nr && enPassant[1] === nc) {
          moves.push([nr, nc]);
        }
      }
      break;
    }
    case "N": {
      for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as [number, number][]) {
        addIfValid(r + dr, c + dc);
      }
      break;
    }
    case "B": {
      for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as [number, number][]) {
        for (let i = 1; i < 8; i++) {
          if (!addIfValid(r + dr * i, c + dc * i)) break;
        }
      }
      break;
    }
    case "R": {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as [number, number][]) {
        for (let i = 1; i < 8; i++) {
          if (!addIfValid(r + dr * i, c + dc * i)) break;
        }
      }
      break;
    }
    case "Q": {
      for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as [number, number][]) {
        for (let i = 1; i < 8; i++) {
          if (!addIfValid(r + dr * i, c + dc * i)) break;
        }
      }
      break;
    }
    case "K": {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          addIfValid(r + dr, c + dc);
        }
      }
      // Castling
      if (turn === "w" && r === 0 && c === 4) {
        if (castling.wK && !board[0]![5] && !board[0]![6] && board[0]![7]?.type === "R" && board[0]![7]?.color === "w") {
          if (!isInCheck(board, "w") && !isAttackedBy(board, 0, 5, "b") && !isAttackedBy(board, 0, 6, "b")) {
            moves.push([0, 6]);
          }
        }
        if (castling.wQ && !board[0]![3] && !board[0]![2] && !board[0]![1] && board[0]![0]?.type === "R" && board[0]![0]?.color === "w") {
          if (!isInCheck(board, "w") && !isAttackedBy(board, 0, 3, "b") && !isAttackedBy(board, 0, 2, "b")) {
            moves.push([0, 2]);
          }
        }
      }
      if (turn === "b" && r === 7 && c === 4) {
        if (castling.bK && !board[7]![5] && !board[7]![6] && board[7]![7]?.type === "R" && board[7]![7]?.color === "b") {
          if (!isInCheck(board, "b") && !isAttackedBy(board, 7, 5, "w") && !isAttackedBy(board, 7, 6, "w")) {
            moves.push([7, 6]);
          }
        }
        if (castling.bQ && !board[7]![3] && !board[7]![2] && !board[7]![1] && board[7]![0]?.type === "R" && board[7]![0]?.color === "b") {
          if (!isInCheck(board, "b") && !isAttackedBy(board, 7, 3, "w") && !isAttackedBy(board, 7, 2, "w")) {
            moves.push([7, 2]);
          }
        }
      }
      break;
    }
  }
  return moves;
}

function isLegalMove(state: ChessState, fr: number, fc: number, tr: number, tc: number): boolean {
  const { board, turn, castling, enPassant } = state;
  const piece = board[fr]![fc];
  if (!piece || piece.color !== turn) return false;

  const legal = pseudoLegalMoves(state, fr, fc);
  if (!legal.some(([r, c]) => r === tr && c === tc)) return false;

  // Simulate move and check for self-check
  const test = cloneBoard(board);
  test[tr]![tc] = test[fr]![fc] ?? null;
  test[fr]![fc] = null;

  // En passant capture
  if (piece.type === "P" && enPassant && tr === enPassant[0] && tc === enPassant[1]) {
    test[fr]![tc] = null;
  }

  // Castling - check rook isn't under attack path (already checked in pseudoLegalMoves for intermediate squares)
  // Just verify king not in check after move
  return !isInCheck(test, turn);
}

function hasLegalMoves(state: ChessState): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = state.board[r]![c];
      if (p && p.color === state.turn) {
        const moves = pseudoLegalMoves(state, r, c);
        for (const [tr, tc] of moves) {
          if (isLegalMove(state, r, c, tr, tc)) return true;
        }
      }
    }
  }
  return false;
}

function hasInsufficientMaterial(board: Board): boolean {
  const pieces: Piece[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r]![c]) pieces.push(board[r]![c]!);
    }
  }
  if (pieces.length === 2) return true; // K vs K
  if (pieces.length === 3) {
    const nonKing = pieces.find((p) => p.type !== "K");
    if (nonKing && (nonKing.type === "B" || nonKing.type === "N")) return true;
  }
  if (pieces.length === 4) {
    const bishops = pieces.filter((p) => p.type === "B");
    if (bishops.length === 2 && bishops[0]!.color !== bishops[1]!.color) {
      // K+B vs K+B on same color
      const sq1 = (() => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r]![c] === bishops[0]) return (r + c) % 2; return 0; })();
      const sq2 = (() => { for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r]![c] === bishops[1]) return (r + c) % 2; return 0; })();
      if (sq1 === sq2) return true;
    }
  }
  return false;
}

function toAlgebraic(r: number, c: number): string {
  return String.fromCharCode(97 + c) + (r + 1);
}

function stateAfterMove(state: ChessState, fr: number, fc: number, tr: number, tc: number, promotion?: PieceType): ChessState {
  const board = cloneBoard(state.board);
  const piece = board[fr]![fc]!;
  const captured = board[tr]![tc];
  const newCastling = { ...state.castling };
  let newEnPassant: [number, number] | null = null;

  // Update castling rights
  if (piece.type === "K") {
    if (piece.color === "w") { newCastling.wK = false; newCastling.wQ = false; }
    else { newCastling.bK = false; newCastling.bQ = false; }
  }
  if (piece.type === "R") {
    if (piece.color === "w") {
      if (fr === 0 && fc === 0) newCastling.wQ = false;
      if (fr === 0 && fc === 7) newCastling.wK = false;
    } else {
      if (fr === 7 && fc === 0) newCastling.bQ = false;
      if (fr === 7 && fc === 7) newCastling.bK = false;
    }
  }
  // If rook captured, remove its castling
  if (tr === 0 && tc === 0) newCastling.wQ = false;
  if (tr === 0 && tc === 7) newCastling.wK = false;
  if (tr === 7 && tc === 0) newCastling.bQ = false;
  if (tr === 7 && tc === 7) newCastling.bK = false;

  // En passant capture
  if (piece.type === "P" && state.enPassant && tr === state.enPassant[0] && tc === state.enPassant[1]) {
    board[fr]![tc] = null;
  }

  // Set en passant square
  if (piece.type === "P" && Math.abs(tr - fr) === 2) {
    newEnPassant = [(fr + tr) / 2, fc];
  }

  // Move piece
  board[tr]![tc] = piece;
  board[fr]![fc] = null;

  // Promotion
  if (piece.type === "P" && (tr === 0 || tr === 7)) {
    board[tr]![tc] = { color: piece.color, type: promotion ?? "Q" };
  }

  // Castling rook move
  if (piece.type === "K") {
    if (tc - fc === 2) { // King-side castle
      board[tr]![5] = board[tr]![7] ?? null;
      board[tr]![7] = null;
    }
    if (fc - tc === 2) { // Queen-side castle
      board[tr]![3] = board[tr]![0] ?? null;
      board[tr]![0] = null;
    }
  }

  const nextTurn: Color = state.turn === "w" ? "b" : "w";
  const isCapture = captured || (piece.type === "P" && state.enPassant && tr === state.enPassant[0] && tc === state.enPassant[1]);
  const halfMoveClock = (piece.type === "P" || isCapture) ? 0 : state.halfMoveClock + 1;

  return {
    ...state,
    board,
    turn: nextTurn,
    castling: newCastling,
    enPassant: newEnPassant,
    halfMoveClock,
    fullMoveNumber: state.turn === "b" ? state.fullMoveNumber + 1 : state.fullMoveNumber,
    lastMove: { from: [fr, fc], to: [tr, tc] },
    inCheck: isInCheck(board, nextTurn)
  };
}

export const chessModule: GameModule<ChessState, ChessAction> = {
  id: "chess",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]): ChessState {
    const whiteId = players[0]!.id;
    const blackId = players[1]!.id;
    const board = initialBoard();
    return {
      board,
      turn: "w",
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      whiteId,
      blackId,
      castling: { wK: true, wQ: true, bK: true, bQ: true },
      enPassant: null,
      halfMoveClock: 0,
      fullMoveNumber: 1,
      winnerId: null,
      result: null,
      lastMove: null,
      inCheck: false
    };
  },

  reduce(state, playerId, action: ChessAction): ChessState {
    if (state.winnerId) return state;

    if (action.type === "resign") {
      const winnerId = playerId === state.whiteId ? state.blackId : state.whiteId;
      return { ...state, winnerId, result: `${state.playerNames[winnerId]} wins by resignation` };
    }

    if (action.type === "move") {
      const isWhiteTurn = state.turn === "w";
      const isWhitePlayer = playerId === state.whiteId;
      if (isWhiteTurn !== isWhitePlayer) return state;

      const [fr, fc] = action.from;
      const [tr, tc] = action.to;
      if (!isLegalMove(state, fr, fc, tr, tc)) return state;

      const newState = stateAfterMove(state, fr, fc, tr, tc, action.promotion);

      // Check game over
      if (!hasLegalMoves(newState)) {
        if (newState.inCheck) {
          const winnerId = newState.turn === "w" ? state.blackId : state.whiteId;
          return { ...newState, winnerId, result: `Checkmate — ${state.playerNames[winnerId]} wins` };
        }
        return { ...newState, winnerId: null, result: "Stalemate — Draw" };
      }

      if (newState.halfMoveClock >= 100) {
        return { ...newState, result: "Draw by 50-move rule" };
      }

      if (hasInsufficientMaterial(newState.board)) {
        return { ...newState, result: "Draw — Insufficient material" };
      }

      return newState;
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    if (state.result) return { over: true };
    return { over: false };
  },

  getViewFor(state, playerId) {
    const isWhite = playerId === state.whiteId;
    const myColor: Color = isWhite ? "w" : "b";
    const legalMoves: Record<string, [number, number][]> = {};

    // Compute legal moves for current player's pieces
    if (state.turn === myColor && !state.winnerId) {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = state.board[r]![c];
          if (p && p.color === myColor) {
            const moves = pseudoLegalMoves(state, r, c).filter(([tr, tc]) =>
              isLegalMove(state, r, c, tr, tc)
            );
            if (moves.length > 0) {
              legalMoves[`${r},${c}`] = moves;
            }
          }
        }
      }
    }

    // Build piece list with positions
    const pieces: { color: Color; type: PieceType; r: number; c: number }[] = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = state.board[r]![c];
        if (p) pieces.push({ color: p.color, type: p.type, r, c });
      }
    }

    return {
      pieces,
      myColor,
      turn: state.turn,
      isMyTurn: state.turn === myColor,
      lastMove: state.lastMove,
      inCheck: state.inCheck,
      legalMoves,
      winnerId: state.winnerId,
      result: state.result,
      whiteName: state.playerNames[state.whiteId],
      blackName: state.playerNames[state.blackId],
      whiteId: state.whiteId,
      blackId: state.blackId
    };
  }
};
