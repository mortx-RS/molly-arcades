import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface Connect4View {
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

const ROWS = 6;
const COLS = 7;

export function Connect4Fullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: Connect4View;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const myName = room.players.find((p) => p.id === youId)?.name ?? "You";
  const oppName = room.players.find((p) => p.id !== youId)?.name ?? "Opponent";

  const handleColClick = (col: number) => {
    if (!gameState.isMyTurn || gameOver) return;
    onSubmitAction({ type: "drop", col });
  };

  const getWinLine = (row: number, col: number) => {
    if (!gameState.winnerLine) return false;
    return gameState.winnerLine.some(([r, c]) => r === row && c === col);
  };

  const getPlayerColor = (playerId: string) => {
    return playerId === youId ? accent : T.chalk;
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
          <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Your turn — drop a piece</span>
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
          display: "flex",
          flexDirection: "column",
          gap: 4,
          width: "100%",
          maxWidth: 350,
        }}>
          {/* Column hover indicators */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
            {Array.from({ length: COLS }).map((_, col) => (
              <div
                key={col}
                style={{
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: hoverCol === col && gameState.isMyTurn && !gameOver ? 1 : 0,
                  transition: "opacity 0.2s ease",
                }}
              >
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: accent,
                  opacity: 0.6,
                }} />
              </div>
            ))}
          </div>

          {/* Board grid */}
          <div style={{
            background: "#1a3a8a",
            borderRadius: 12,
            padding: 8,
            border: `2px solid #2563eb`,
          }}>
            {gameState.board.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 4 }}>
                {row.map((cell, colIdx) => (
                  <div
                    key={`${rowIdx}-${colIdx}`}
                    onClick={() => handleColClick(colIdx)}
                    onMouseEnter={() => setHoverCol(colIdx)}
                    onMouseLeave={() => setHoverCol(null)}
                    style={{
                      aspectRatio: "1",
                      borderRadius: "50%",
                      background: cell ? getPlayerColor(cell) : T.bgDeep,
                      border: `2px solid ${getWinLine(rowIdx, colIdx) ? "#fbbf24" : "transparent"}`,
                      cursor: gameState.isMyTurn && !gameOver ? "pointer" : "default",
                      transition: "all 0.2s ease",
                      opacity: cell ? 1 : 0.3,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
