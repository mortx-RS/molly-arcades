import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

export interface ChessView {
  pieces: { color: string; type: string; r: number; c: number }[];
  myColor: string;
  turn: string;
  isMyTurn: boolean;
  lastMove: { from: [number, number]; to: [number, number] } | null;
  inCheck: boolean;
  legalMoves: Record<string, [number, number][]>;
  winnerId: string | null;
  result: string | null;
  whiteName: string;
  blackName: string;
  whiteId: string;
  blackId: string;
}

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  w: { K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659" },
  b: { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" }
};

// Classic wood/marble board palette — local to Chess, doesn't touch the app-wide theme
const WOOD = {
  frameOuter: "#241209",
  frameInner: "#3d2213",
  brass: "#c9a24d",
  brassDim: "#c9a24d55",
  brassFaint: "#c9a24d33",
  marbleLo: "#ded1b3",
  marbleHi: "#efe6d0",
  walnutLo: "#3e2415",
  walnutHi: "#5c371f",
  ivory: "#f5ecd9",
  ebony: "#211710",
  maroon: "#7a2530",
  maroonGlow: "rgba(122, 37, 48, 0.55)"
};

export function ChessFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: ChessView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showPromo, setShowPromo] = useState<[number, number] | null>(null);
  const [promoFrom, setPromoFrom] = useState<[number, number] | null>(null);

  const isMyTurn = gameState.isMyTurn;
  const flipBoard = gameState.myColor === "b";

  const handleSquareClick = (r: number, c: number) => {
    if (!isMyTurn || gameOver) return;

    if (showPromo) return;

    if (selected) {
      const key = `${selected[0]},${selected[1]}`;
      const legal = gameState.legalMoves[key] ?? [];
      const isValid = legal.some(([lr, lc]) => lr === r && lc === c);

      if (isValid) {
        const piece = gameState.pieces.find((p) => p.r === selected[0] && p.c === selected[1]);
        const isPromo = piece?.type === "P" && ((piece.color === "w" && r === 7) || (piece.color === "b" && r === 0));
        if (isPromo) {
          setShowPromo([r, c]);
          setPromoFrom(selected);
          return;
        }
        onSubmitAction({ type: "move", from: selected, to: [r, c] });
        setSelected(null);
        return;
      }
    }

    const piece = gameState.pieces.find((p) => p.r === r && p.c === c);
    if (piece && piece.color === gameState.myColor) {
      setSelected([r, c]);
    } else {
      setSelected(null);
    }
  };

  const handlePromo = (type: string) => {
    if (promoFrom && showPromo) {
      onSubmitAction({ type: "move", from: promoFrom, to: showPromo, promotion: type });
      setSelected(null);
      setShowPromo(null);
      setPromoFrom(null);
    }
  };

  const renderBoard = () => {
    const cells = [];
    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const r = flipBoard ? ri : 7 - ri;
        const c = flipBoard ? ci : 7 - ci;
        const isDark = (r + c) % 2 === 1;
        const isSelected = selected && selected[0] === r && selected[1] === c;
        const isLastMove = gameState.lastMove && (
          (gameState.lastMove.from[0] === r && gameState.lastMove.from[1] === c) ||
          (gameState.lastMove.to[0] === r && gameState.lastMove.to[1] === c)
        );
        const piece = gameState.pieces.find((p) => p.r === r && p.c === c);
        const key = `${selected?.[0]},${selected?.[1]}`;
        const legal = gameState.legalMoves[key] ?? [];
        const isLegalTarget = legal.some(([lr, lc]) => lr === r && lc === c);
        const isKingInCheck = piece?.type === "K" && piece.color === gameState.turn && gameState.inCheck;

        // Marble (light) vs. walnut (dark) square base, with grain/veining baked in via layered gradients
        const baseBg = isDark
          ? `linear-gradient(135deg, ${WOOD.walnutHi} 0%, ${WOOD.walnutLo} 45%, ${WOOD.walnutHi} 100%),
             repeating-linear-gradient(100deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 7px)`
          : `linear-gradient(135deg, ${WOOD.marbleHi} 0%, ${WOOD.marbleLo} 55%, ${WOOD.marbleHi} 100%),
             repeating-linear-gradient(70deg, rgba(120,105,75,0.08) 0px, rgba(120,105,75,0.08) 1px, transparent 1px, transparent 9px)`;

        const overlay = isSelected
          ? WOOD.brassDim
          : isLastMove
            ? WOOD.brassFaint
            : "transparent";

        // Edge coordinate labels (real board convention: files along the bottom, ranks along the left)
        const showRank = ci === 0;
        const showFile = ri === 7;
        const labelColor = isDark ? "rgba(239, 230, 208, 0.55)" : "rgba(62, 36, 21, 0.55)";

        cells.push(
          <div
            key={`${r}-${c}`}
            onClick={() => handleSquareClick(r, c)}
            style={{
              width: "100%",
              paddingBottom: "100%",
              position: "relative",
              background: `${overlay === "transparent" ? "" : `linear-gradient(${overlay}, ${overlay}),`} ${baseBg}`,
              boxShadow: isKingInCheck
                ? `inset 0 0 14px ${WOOD.maroonGlow}`
                : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 2px rgba(0,0,0,0.25)",
              cursor: isMyTurn && !gameOver ? "pointer" : "default"
            }}
          >
            {showRank && (
              <span style={{
                position: "absolute", top: 2, left: 4, fontSize: 9, fontFamily: T.fontMono ?? "monospace",
                fontWeight: 700, color: labelColor, userSelect: "none", zIndex: 3
              }}>{r + 1}</span>
            )}
            {showFile && (
              <span style={{
                position: "absolute", bottom: 2, right: 4, fontSize: 9, fontFamily: T.fontMono ?? "monospace",
                fontWeight: 700, color: labelColor, userSelect: "none", zIndex: 3
              }}>{String.fromCharCode(97 + c)}</span>
            )}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isLegalTarget && (
                <div style={{
                  width: piece ? "85%" : "30%",
                  height: piece ? "85%" : "30%",
                  borderRadius: piece ? "10px" : "50%",
                  background: piece ? `${WOOD.maroon}22` : `${WOOD.brass}66`,
                  border: piece ? `3px solid ${WOOD.brass}` : "none",
                  boxShadow: piece ? `0 0 12px ${WOOD.brass}55, inset 0 0 8px ${WOOD.brass}30` : "none",
                  position: "absolute",
                  zIndex: 1
                }} />
              )}
              {piece && (
                <span style={{
                  fontSize: "min(9vw, 48px)",
                  lineHeight: 1,
                  // Solid carved-material fill via gradient text-clip — no outline/hollow stroke
                  backgroundImage: piece.color === "w"
                    ? "linear-gradient(160deg, #fffaf2 0%, #ede0c4 45%, #cdb98f 100%)"
                    : "linear-gradient(160deg, #4d3a26 0%, #241a10 50%, #0c0805 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  WebkitTextFillColor: "transparent",
                  filter: piece.color === "w"
                    ? "drop-shadow(0 1px 0 rgba(255,255,255,0.5)) drop-shadow(0 4px 5px rgba(0,0,0,0.55))"
                    : "drop-shadow(0 1px 0 rgba(120,95,60,0.25)) drop-shadow(0 4px 6px rgba(0,0,0,0.75))",
                  position: "relative",
                  zIndex: 2,
                  userSelect: "none"
                }}>
                  {PIECE_UNICODE[piece.color]?.[piece.type] ?? "?"}
                </span>
              )}
            </div>
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bgDeep, display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={onLeave} style={{ ...T.glass(), color: T.chalk, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: "0.02em", margin: 0 }}>{gameName}</h1>
        </div>
        <button onClick={() => setShowInfo(!showInfo)} style={{ ...T.glass(), color: T.chalkDim, width: 44, height: 44, borderRadius: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>i</button>
      </div>

      {/* Player info */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", padding: "0 16px 12px", gap: 12 }}>
        <div style={{ flex: 1, padding: "12px 14px", borderRadius: 14, background: gameState.turn === "b" ? `${WOOD.brass}14` : `${T.chalk}04`, border: `1px solid ${gameState.turn === "b" ? `${WOOD.brass}55` : T.line}`, transition: "all 0.2s ease" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: gameState.turn === "b" ? WOOD.brass : T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {gameState.blackName} {gameState.myColor === "b" ? "(you)" : ""}
          </div>
          <div style={{ fontSize: 14, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>{"\u265A"} Black</div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", borderRadius: 14, background: gameState.turn === "w" ? `${WOOD.brass}14` : `${T.chalk}04`, border: `1px solid ${gameState.turn === "w" ? `${WOOD.brass}55` : T.line}`, transition: "all 0.2s ease" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: gameState.turn === "w" ? WOOD.brass : T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {gameState.whiteName} {gameState.myColor === "w" ? "(you)" : ""}
          </div>
          <div style={{ fontSize: 14, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>{"\u2654"} White</div>
        </div>
      </div>

      {/* Status */}
      {gameState.inCheck && !gameOver && (
        <div style={{ flexShrink: 0, textAlign: "center", padding: "8px", margin: "0 16px 8px", fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, color: "#e07d88", letterSpacing: "0.06em", textTransform: "uppercase", background: `${WOOD.maroon}22`, borderRadius: 10, border: `1px solid ${WOOD.maroon}55` }}>
          Check!
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
        <div style={{ height: "100%", aspectRatio: "1", maxHeight: "min(80vh, 100vw)" }}>
          <div style={{
            width: "100%",
            height: "100%",
            padding: "10px",
            borderRadius: 10,
            background: `linear-gradient(155deg, ${WOOD.frameInner}, ${WOOD.frameOuter})`,
            border: `2px solid ${WOOD.frameOuter}`,
            boxShadow: `0 6px 28px rgba(0,0,0,0.45), inset 0 0 0 1px ${WOOD.brassDim}`
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              width: "100%",
              height: "100%",
              borderRadius: 3,
              overflow: "hidden",
              border: `1px solid ${WOOD.brass}`,
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)"
            }}>
              {renderBoard()}
            </div>
          </div>
        </div>
      </div>

      {/* Turn indicator */}
      {!gameOver && (
        <div style={{ flexShrink: 0, textAlign: "center", padding: "10px", fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: isMyTurn ? WOOD.brass : T.chalkDim, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {isMyTurn ? "Your turn" : "Waiting\u2026"}
        </div>
      )}

      {/* Promotion picker */}
      <BottomDrawer open={!!showPromo} onClose={() => { setShowPromo(null); setPromoFrom(null); setSelected(null); }} title="Promote pawn to">
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {["Q", "R", "B", "N"].map((type) => (
            <button key={type} onClick={() => handlePromo(type)} style={{
              width: 64, height: 64, borderRadius: 14,
              background: `linear-gradient(155deg, ${WOOD.frameInner}, ${WOOD.frameOuter})`,
              border: `1px solid ${WOOD.brass}`,
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s"
            }}>
              <span style={{
                fontSize: 36,
                backgroundImage: gameState.myColor === "w"
                  ? "linear-gradient(160deg, #fffaf2 0%, #ede0c4 45%, #cdb98f 100%)"
                  : "linear-gradient(160deg, #4d3a26 0%, #241a10 50%, #0c0805 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                WebkitTextFillColor: "transparent",
                filter: gameState.myColor === "w"
                  ? "drop-shadow(0 1px 0 rgba(255,255,255,0.5)) drop-shadow(0 3px 4px rgba(0,0,0,0.55))"
                  : "drop-shadow(0 1px 0 rgba(120,95,60,0.25)) drop-shadow(0 3px 5px rgba(0,0,0,0.75))"
              }}>
                {PIECE_UNICODE[gameState.myColor]?.[type]}
              </span>
            </button>
          ))}
        </div>
      </BottomDrawer>

      {/* Game over */}
      {gameOver && (
        <div style={{ position: "absolute", inset: 0, background: T.overlayBg, backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{gameOver.winnerId === youId ? "\uD83C\uDFC6" : "\uD83C\uDF89"}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 800, color: gameOver.winnerId === youId ? WOOD.brass : "#e07d88", marginBottom: 8 }}>
              {gameOver.winnerId === youId ? "You Win!" : "You Lose"}
            </div>
            {gameState.result && (
              <div style={{ fontFamily: T.fontMono, fontSize: 13, color: T.chalkDim, marginBottom: 24 }}>{gameState.result}</div>
            )}
            <button onClick={onLeave} style={{ padding: "12px 36px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        </div>
      )}

      {/* Info */}
      <BottomDrawer open={showInfo} onClose={() => setShowInfo(false)} title={gameName}>
        <p style={{ color: T.chalkDim, fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>Click a piece to select it, then click a highlighted square to move. Capture the opponent's king to win.</p>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted }}>Room {room.id}</div>
      </BottomDrawer>
    </div>
  );
}
