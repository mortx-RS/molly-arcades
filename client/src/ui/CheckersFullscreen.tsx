import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface CheckersPiece {
  id: number;
  row: number;
  col: number;
  color: "light" | "dark";
  king: boolean;
  captured?: boolean;
}

export interface CheckersView {
  pieces: CheckersPiece[];
  currentTurn: string;
  isMyTurn: boolean;
  winnerId: string | null;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
  myColor: "light" | "dark";
}

const BOARD_SIZE = 8;
const CELL_SIZE = 40;

export function CheckersFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: CheckersView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null);
  const myName = room.players.find((p) => p.id === youId)?.name ?? "You";
  const oppName = room.players.find((p) => p.id !== youId)?.name ?? "Opponent";

  const handleCellClick = (row: number, col: number) => {
    if (!gameState.isMyTurn || gameOver) return;
    const piece = gameState.pieces.find((p) => p.row === row && p.col === col && !p.captured);
    if (piece && piece.color === gameState.myColor) {
      setSelectedPiece(piece.id);
      return;
    }
    if (selectedPiece !== null) {
      onSubmitAction({ type: "move", pieceId: selectedPiece, toRow: row, toCol: col });
      setSelectedPiece(null);
    }
  };

  const getPieceAt = (row: number, col: number) => {
    return gameState.pieces.find((p) => p.row === row && p.col === col && !p.captured);
  };

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: T.bgDeep,
      color: T.chalk,
      fontFamily: T.fontBody,
      overflow: "hidden"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        flexShrink: 0
      }}>
        <button onClick={onLeave} style={{
          background: T.charcoal,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: T.chalk,
          fontSize: 20
        }}>&#8249;</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700 }}>{gameName}</div>
          <div style={{ fontSize: 11, color: T.chalkMuted }}>Capture all opponent pieces</div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Scoreboard */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 24,
        padding: "8px 16px",
        flexShrink: 0
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{myName}</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, fontWeight: 800, color: accent }}>{gameState.scores[youId] ?? 0}</div>
        </div>
        <div style={{ width: 1, background: T.line }} />
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{oppName}</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 24, fontWeight: 800, color: T.chalk }}>{gameState.scores[room.players.find((p) => p.id !== youId)?.id ?? ""] ?? 0}</div>
        </div>
      </div>

      {/* Turn indicator */}
      {gameOver ? (
        <div style={{
          padding: "12px 16px",
          textAlign: "center",
          background: gameOver.winnerId === youId ? T.greenDim : T.pinkDim,
          borderTop: `1px solid ${gameOver.winnerId === youId ? T.green : T.pink}30`
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: gameOver.winnerId === youId ? T.green : T.pink }}>
            {gameOver.winnerId === youId ? "You win!" : "You lose!"}
          </span>
        </div>
      ) : gameState.isMyTurn ? (
        <div style={{
          padding: "12px 16px",
          textAlign: "center",
          background: T.greenDim,
          borderTop: `1px solid ${T.green}30`
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>
            {selectedPiece ? "Click destination square" : "Select a piece to move"}
          </span>
        </div>
      ) : (
        <div style={{
          padding: "12px 16px",
          textAlign: "center",
          background: T.neonDim,
          borderTop: `1px solid ${T.lineAccent}`
        }}>
          <span style={{ fontSize: 13, color: T.neon }}>Opponent's turn...</span>
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${BOARD_SIZE}, ${CELL_SIZE}px)`,
          border: `2px solid ${T.line}`,
          borderRadius: 8,
          overflow: "hidden",
        }}>
          {Array.from({ length: BOARD_SIZE }).map((_, row) =>
            Array.from({ length: BOARD_SIZE }).map((_, col) => {
              const isDark = (row + col) % 2 === 1;
              const piece = getPieceAt(row, col);
              const isSelected = piece?.id === selectedPiece;
              return (
                <div
                  key={`${row}-${col}`}
                  onClick={() => handleCellClick(row, col)}
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    background: isDark ? "#4a5568" : "#e2e8f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: gameState.isMyTurn && !gameOver ? "pointer" : "default",
                    position: "relative",
                  }}
                >
                  {piece && (
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: piece.color === "light" ? "#fbbf24" : "#1e293b",
                        border: `2px solid ${isSelected ? accent : piece.color === "light" ? "#f59e0b" : "#0f172a"}`,
                        boxShadow: isSelected ? `0 0 8px ${accent}` : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: piece.color === "light" ? "#1e293b" : "#fbbf24",
                      }}
                    >
                      {piece.king ? "K" : ""}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
