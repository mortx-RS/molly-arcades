import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface WhotCard {
  id: string;
  symbol: string;
  value: number;
  effect: string;
}

export interface WhotView {
  hand: WhotCard[];
  topCard: WhotCard | null;
  currentTurn: string;
  isMyTurn: boolean;
  activeSymbol: string;
  drawCount: number;
  scores: Record<string, number>;
  winnerId: string | null;
  playerNames: Record<string, string>;
  myId: string;
}

const SYMBOL_COLORS: Record<string, string> = {
  circle: "#ef4444",
  triangle: "#3b82f6",
  square: "#22c55e",
  cross: "#eab308",
  star: "#8b5cf6",
};

const SYMBOL_ICONS: Record<string, string> = {
  circle: "●",
  triangle: "▲",
  square: "■",
  cross: "✖",
  star: "★",
};

export function WhotFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: WhotView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [selectedCard, setSelectedCard] = useState<WhotCard | null>(null);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const myName = room.players.find((p) => p.id === youId)?.name ?? "You";

  const isPlayable = (card: WhotCard) => {
    if (!gameState.topCard || !gameState.isMyTurn || gameOver) return false;
    if (card.effect === "whot") return true;
    if (card.symbol === gameState.activeSymbol) return true;
    if (card.value === gameState.topCard.value) return true;
    return false;
  };

  const handlePlayCard = (card: WhotCard) => {
    if (!isPlayable(card)) return;
    if (card.effect === "whot") {
      setSelectedCard(card);
      setShowSymbolPicker(true);
      return;
    }
    onSubmitAction({ type: "play", card });
    setSelectedCard(null);
  };

  const handleSymbolChoice = (symbol: string) => {
    if (selectedCard) {
      onSubmitAction({ type: "play", card: selectedCard, chosenSymbol: symbol });
    }
    setShowSymbolPicker(false);
    setSelectedCard(null);
  };

  const handleDraw = () => {
    onSubmitAction({ type: "draw" });
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
          <div style={{ fontSize: 11, color: T.chalkMuted }}>Empty your hand to win!</div>
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
              {gameState.scores[p.id] ?? 0}
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
            Your turn — play a card or draw
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

      {/* Game area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", gap: 16 }}>
        {/* Top card and draw pile */}
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          {/* Draw pile */}
          <div style={{
            width: 80,
            height: 112,
            borderRadius: 8,
            background: T.charcoal,
            border: `2px solid ${T.line}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            color: T.chalkMuted,
          }}>
            {gameState.drawCount}
          </div>

          {/* Top card */}
          {gameState.topCard && (
            <div style={{
              width: 80,
              height: 112,
              borderRadius: 8,
              background: SYMBOL_COLORS[gameState.topCard.symbol] ?? T.charcoal,
              border: `2px solid ${T.chalk}30`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}>
              <div style={{ fontSize: 24 }}>{SYMBOL_ICONS[gameState.topCard.symbol] ?? "?"}</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{gameState.topCard.value}</div>
            </div>
          )}
        </div>

        {/* Active symbol */}
        <div style={{
          padding: "6px 12px",
          borderRadius: 8,
          background: `${SYMBOL_COLORS[gameState.activeSymbol] ?? T.charcoal}20`,
          border: `1px solid ${SYMBOL_COLORS[gameState.activeSymbol] ?? T.line}40`,
          fontSize: 12,
          fontWeight: 600,
          color: SYMBOL_COLORS[gameState.activeSymbol] ?? T.chalk,
        }}>
          Active: {gameState.activeSymbol.toUpperCase()} {SYMBOL_ICONS[gameState.activeSymbol] ?? ""}
        </div>
      </div>

      {/* Symbol picker modal */}
      {showSymbolPicker && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: T.charcoal,
            borderRadius: 16,
            padding: 24,
            border: `1px solid ${T.line}`,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Choose a symbol</div>
            <div style={{ display: "flex", gap: 12 }}>
              {Object.entries(SYMBOL_ICONS).map(([symbol, icon]) => (
                <button
                  key={symbol}
                  onClick={() => handleSymbolChoice(symbol)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: SYMBOL_COLORS[symbol],
                    border: `2px solid ${T.chalk}30`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    cursor: "pointer",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hand */}
      <div style={{
        padding: "12px 16px",
        paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        background: T.charcoal,
        borderTop: `1px solid ${T.line}`,
        flexShrink: 0,
      }}>
        <div style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 8,
        }}>
          {gameState.hand.map((card) => {
            const playable = isPlayable(card);
            return (
              <button
                key={card.id}
                onClick={() => handlePlayCard(card)}
                disabled={!gameState.isMyTurn || !!gameOver || !playable}
                style={{
                  minWidth: 60,
                  height: 84,
                  borderRadius: 8,
                  background: SYMBOL_COLORS[card.symbol] ?? T.charcoal,
                  border: `2px solid ${playable ? `${accent}60` : T.line}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  cursor: playable ? "pointer" : "default",
                  opacity: playable ? 1 : 0.5,
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 18 }}>{SYMBOL_ICONS[card.symbol] ?? "?"}</div>
                <div style={{ fontSize: 14, fontWeight: 800 }}>{card.value}</div>
              </button>
            );
          })}
        </div>

        {/* Draw button */}
        {gameState.isMyTurn && !gameOver && (
          <button
            onClick={handleDraw}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              border: `1px solid ${T.line}`,
              borderRadius: 12,
              color: T.chalkMuted,
              fontSize: 13,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Draw Card
          </button>
        )}
      </div>
    </div>
  );
}
