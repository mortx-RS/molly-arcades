import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface SnakeLadderView {
  positions: Record<string, number>;
  currentTurn: string;
  isMyTurn: boolean;
  dice: number | null;
  winnerId: string | null;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
  snakes: Record<number, number>;
  ladders: Record<number, number>;
}

const BOARD_SIZE = 10;
const CELL_SIZE = 36;

function getCellPosition(square: number): { row: number; col: number } {
  if (square === 0) return { row: BOARD_SIZE, col: 0 };
  const adjusted = square - 1;
  const row = Math.floor(adjusted / BOARD_SIZE);
  const col = adjusted % BOARD_SIZE;
  const actualRow = BOARD_SIZE - 1 - row;
  const actualCol = (row % 2 === 0) ? col : BOARD_SIZE - 1 - col;
  return { row: actualRow, col: actualCol };
}

export function SnakeLadderFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: SnakeLadderView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [rolling, setRolling] = useState(false);
  const myName = room.players.find((p) => p.id === youId)?.name ?? "You";

  const handleRoll = () => {
    if (!gameState.isMyTurn || gameOver || rolling) return;
    setRolling(true);
    setTimeout(() => {
      onSubmitAction({ type: "roll" });
      setRolling(false);
    }, 500);
  };

  const getPlayerAtSquare = (square: number): string[] => {
    return Object.entries(gameState.positions)
      .filter(([, pos]) => pos === square)
      .map(([pid]) => pid);
  };

  const renderSquare = (square: number) => {
    const { row, col } = getCellPosition(square);
    const players = getPlayerAtSquare(square);
    const isSnake = square in gameState.snakes;
    const isLadder = square in gameState.ladders;

    return (
      <div
        key={square}
        style={{
          position: "absolute",
          left: col * CELL_SIZE,
          top: row * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
          background: isSnake ? "#fecaca" : isLadder ? "#bbf7d0" : (row + col) % 2 === 0 ? "#f8fafc" : "#e2e8f0",
          border: "1px solid #94a3b8",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: "#1e293b",
        }}
      >
        {square > 0 && <span>{square}</span>}
        {players.length > 0 && (
          <div style={{
            position: "absolute",
            bottom: 2,
            display: "flex",
            gap: 1,
          }}>
            {players.map((pid) => (
              <div
                key={pid}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: pid === youId ? accent : "#6366f1",
                  border: "1px solid #fff",
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
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
          <div style={{ fontSize: 11, color: T.chalkMuted }}>Race to 100!</div>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Scoreboard */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 16,
        padding: "8px 16px",
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        {room.players.map((p) => (
          <div key={p.id} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: T.chalkMuted, textTransform: "uppercase" }}>{p.name}</div>
            <div style={{ fontFamily: T.fontMono, fontSize: 14, fontWeight: 700, color: p.id === youId ? accent : T.chalk }}>
              {gameState.positions[p.id] ?? 0}
            </div>
          </div>
        ))}
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
            {gameState.dice ? `Rolled ${gameState.dice}!` : "Your turn — roll the dice"}
          </span>
        </div>
      ) : (
        <div style={{
          padding: "12px 16px",
          textAlign: "center",
          background: T.neonDim,
          borderTop: `1px solid ${T.lineAccent}`
        }}>
          <span style={{ fontSize: 13, color: T.neon }}>
            {gameState.dice ? `${myName} rolled ${gameState.dice}` : "Opponent's turn..."}
          </span>
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", overflow: "auto" }}>
        <div style={{
          position: "relative",
          width: BOARD_SIZE * CELL_SIZE,
          height: BOARD_SIZE * CELL_SIZE,
        }}>
          {Array.from({ length: 100 }, (_, i) => renderSquare(i + 1))}
        </div>
      </div>

      {/* Roll button */}
      <div style={{ padding: "12px 16px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))", flexShrink: 0 }}>
        {gameState.isMyTurn && !gameOver && (
          <button
            onClick={handleRoll}
            disabled={rolling || gameState.dice !== null}
            style={{
              width: "100%",
              padding: "14px",
              background: rolling ? T.chalkMuted : accent,
              color: T.bgDeep,
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: rolling ? "default" : "pointer",
              opacity: rolling || gameState.dice !== null ? 0.5 : 1,
            }}
          >
            {rolling ? "Rolling..." : gameState.dice ? `Rolled ${gameState.dice}` : "Roll Dice"}
          </button>
        )}
        {!gameState.isMyTurn && !gameOver && (
          <div style={{ padding: "14px", textAlign: "center", color: T.chalkMuted, fontSize: 13 }}>
            Waiting for opponent to roll...
          </div>
        )}
      </div>
    </div>
  );
}
