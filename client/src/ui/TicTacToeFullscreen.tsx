import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface TicTacToeView {
  board: (string | null)[][];
  currentTurn: string;
  isMyTurn: boolean;
  winnerId: string | null;
  winnerLine: [number, number][] | null;
  draw: boolean;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
}

export function TicTacToeFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: TicTacToeView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const myName = room.players.find((p) => p.id === youId)?.name ?? "You";
  const oppName = room.players.find((p) => p.id !== youId)?.name ?? "Opponent";

  const handleCellClick = (row: number, col: number) => {
    if (!gameState.isMyTurn || gameOver) return;
    if (gameState.board[row]?.[col] !== null) return;
    setLastMove([row, col]);
    onSubmitAction({ type: "move", row, col });
  };

  const getWinLine = (row: number, col: number) => {
    if (!gameState.winnerLine) return false;
    return gameState.winnerLine.some(([r, c]) => r === row && c === col);
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
          <div style={{ fontSize: 11, color: T.chalkMuted }}>First to 10 wins</div>
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
            {gameOver.winnerId === youId ? "You win!" : gameOver.winnerId ? "You lose!" : "Draw!"}
          </span>
        </div>
      ) : gameState.isMyTurn ? (
        <div style={{
          padding: "12px 16px",
          textAlign: "center",
          background: T.greenDim,
          borderTop: `1px solid ${T.green}30`
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Your turn — place X</span>
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
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
          width: "100%",
          maxWidth: 320,
          aspectRatio: "1",
        }}>
          {gameState.board.map((row, rowIdx) =>
            row.map((cell, colIdx) => (
              <button
                key={`${rowIdx}-${colIdx}`}
                onClick={() => handleCellClick(rowIdx, colIdx)}
                disabled={!gameState.isMyTurn || !!gameOver || cell !== null}
                style={{
                  background: getWinLine(rowIdx, colIdx) ? `${accent}20` : T.charcoal,
                  border: `2px solid ${getWinLine(rowIdx, colIdx) ? accent : T.line}`,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  fontWeight: 800,
                  fontFamily: T.fontDisplay,
                  color: cell === youId ? accent : cell ? T.chalk : "transparent",
                  cursor: cell || !gameState.isMyTurn || gameOver ? "default" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {cell === youId ? "X" : cell ? "O" : ""}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Resign button */}
      {gameState.isMyTurn && !gameOver && (
        <div style={{ padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
          <button
            onClick={() => onSubmitAction({ type: "resign" })}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              border: `1px solid ${T.line}`,
              borderRadius: 12,
              color: T.chalkMuted,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Resign
          </button>
        </div>
      )}
    </div>
  );
}
