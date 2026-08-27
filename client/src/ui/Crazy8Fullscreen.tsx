import { useState, useEffect, useMemo, useRef } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

interface Crazy8Card {
  id: string;
  suit: string;
  rank: string;
}

export interface Crazy8View {
  myHand: Crazy8Card[];
  opponents: { id: string; name: string; cardCount: number }[];
  topCard: Crazy8Card;
  wildSuit: string | null;
  currentTurn: string;
  isMyTurn: boolean;
  deckCount: number;
  drawnCardId: string | null;
  winnerId: string | null;
  message: string | null;
  lastAction: { type: "play" | "draw" | "pass"; playerId: string; cardId?: string } | null;
  pendingDraw: number;
  direction: 1 | -1;
  playableCardIds: string[];
}

const SUIT_SYMBOL: Record<string, string> = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };
const RED = "#e11d48";
const BLACK = "#1c1917";

const isRedSuit = (s: string) => s === "hearts" || s === "diamonds";

/** Deterministic pseudo-random rotation from an id, so piles look organic but stable. */
function hashRot(seed: string, span = 14): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return (((h >>> 0) % 1000) / 1000) * span - span / 2;
}

function vibrate(ms: number) {
  try { navigator.vibrate?.(ms); } catch { /* noop */ }
}

/* ------------------------------------------------------------------ */
/* Styles (injected once; interpolates theme tokens into keyframes)    */
/* ------------------------------------------------------------------ */

function GameStyles() {
  const css = `
@keyframes c8-deal-in {
  0% { transform: translateY(70px) rotate(12deg) scale(0.55); opacity: 0; }
  65% { opacity: 1; }
  100% { transform: none; opacity: 1; }
}
@keyframes c8-flip-in {
  0% { transform: perspective(700px) rotateY(90deg) scale(1.18); }
  100% { transform: perspective(700px) rotateY(0deg) scale(1); }
}
@keyframes c8-slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: none; }
}
@keyframes c8-pop {
  0% { transform: scale(1.6); }
  100% { transform: scale(1); }
}
@keyframes c8-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
}
@keyframes c8-ring {
  0% { box-shadow: 0 0 0 0 ${T.green}; }
  100% { box-shadow: 0 0 0 10px transparent; }
}
@keyframes c8-breathe {
  0%, 100% { border-color: ${T.green}30; }
  50% { border-color: ${T.green}75; }
}
@keyframes c8-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes c8-spin { to { transform: rotate(360deg); } }
@keyframes c8-overlay-pop {
  0% { transform: scale(0.85) translateY(24px); opacity: 0; }
  60% { transform: scale(1.03) translateY(0); opacity: 1; }
  100% { transform: none; opacity: 1; }
}
@keyframes c8-confetti {
  0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
  100% { transform: translateY(108vh) rotate(720deg); opacity: 0.6; }
}
.c8-btn { transition: transform 0.12s ease, filter 0.12s ease; }
.c8-btn:active { transform: scale(0.94); filter: brightness(1.2); }
.c8-deal { animation: c8-deal-in 0.38s cubic-bezier(0.34, 1.3, 0.64, 1) backwards; }
.c8-flip { animation: c8-flip-in 0.3s cubic-bezier(0.34, 1.4, 0.64, 1) 0.35s backwards; }
.c8-slide-up { animation: c8-slide-up 0.3s ease both; }
.c8-pop { animation: c8-pop 0.35s cubic-bezier(0.34, 1.5, 0.64, 1); display: inline-block; }
.c8-shake { animation: c8-shake 0.5s ease; }
.c8-turn-active { animation: c8-ring 1.8s ease-out infinite; }
.c8-seat-active { animation: c8-breathe 2s ease-in-out infinite; }
.c8-float { animation: c8-float 3s ease-in-out infinite; }
.c8-spin { display: inline-block; animation: c8-spin 5s linear infinite; }
.c8-overlay { animation: c8-overlay-pop 0.45s cubic-bezier(0.34, 1.3, 0.64, 1) both; }
.c8-confetti { position: absolute; top: 0; border-radius: 2px; animation-name: c8-confetti; animation-timing-function: linear; animation-fill-mode: both; }
@media (prefers-reduced-motion: reduce) {
  .c8-deal, .c8-flip, .c8-slide-up, .c8-pop, .c8-shake, .c8-turn-active,
  .c8-seat-active, .c8-float, .c8-spin, .c8-overlay, .c8-confetti { animation: none !important; }
}
`;
  return <style>{css}</style>;
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function CardFace({ card, size = 56, dimmed, ringColor }: { card: Crazy8Card; size?: number; dimmed?: boolean; ringColor?: string }) {
  const w = size;
  const h = Math.round(w * 1.45);
  const color = isRedSuit(card.suit) ? RED : BLACK;
  const sym = SUIT_SYMBOL[card.suit] ?? "?";
  const shadow = dimmed
    ? "none"
    : `0 ${Math.round(w * 0.05)}px ${Math.round(w * 0.16)}px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3)`;
  const ring = ringColor ? `, 0 0 0 2px ${ringColor}, 0 0 16px ${ringColor}66` : "";
  const corner = (style: React.CSSProperties) => (
    <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1, fontFamily: T.fontDisplay, fontWeight: 700, color, ...style }}>
      <span style={{ fontSize: Math.round(w * 0.24) }}>{card.rank}</span>
      <span style={{ fontSize: Math.round(w * 0.17), marginTop: 1 }}>{sym}</span>
    </div>
  );
  return (
    <div style={{
      width: w, height: h, borderRadius: Math.round(w * 0.1),
      background: "linear-gradient(165deg, #fffefb 0%, #f3eee4 100%)",
      border: "1px solid rgba(28,25,23,0.22)",
      boxShadow: shadow + ring,
      position: "relative", flexShrink: 0, overflow: "hidden",
      opacity: dimmed ? 0.45 : 1,
      filter: dimmed ? "saturate(0.35)" : "none",
    }}>
      {/* inner frame */}
      <div style={{ position: "absolute", inset: Math.round(w * 0.07), borderRadius: Math.round(w * 0.05), border: `1px solid ${color}1f`, pointerEvents: "none" }} />
      {corner({ top: Math.round(w * 0.09), left: Math.round(w * 0.1) })}
      {corner({ bottom: Math.round(w * 0.09), right: Math.round(w * 0.1), transform: "rotate(180deg)" })}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: Math.round(w * 0.5), color, lineHeight: 1, opacity: 0.92 }}>{sym}</span>
      </div>
    </div>
  );
}

function CardBack({ size = 56 }: { size?: number }) {
  const w = size;
  const h = Math.round(w * 1.45);
  return (
    <div style={{
      width: w, height: h, borderRadius: Math.round(w * 0.1),
      background: `linear-gradient(150deg, ${T.violet}, #4c1d95)`,
      border: "1px solid rgba(167,139,250,0.45)",
      boxShadow: "0 3px 10px rgba(0,0,0,0.4)",
      position: "relative", overflow: "hidden", flexShrink: 0,
    }}>
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 4px, transparent 4px 9px)" }} />
      <div style={{ position: "absolute", inset: Math.round(w * 0.1), borderRadius: Math.round(w * 0.05), border: "1px solid rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: Math.round(w * 0.3), color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>&#9824;</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flying card (WAAPI, true arc path)                                  */
/* ------------------------------------------------------------------ */

interface Flight {
  card: Crazy8Card;
  isBack: boolean;
  fromX: number; fromY: number;
  toX: number; toY: number;
  fromRotation: number; toRotation: number;
  arc: number;
  duration: number;
  key: number;
}

function FlyingCard({ flight, onComplete }: { flight: Flight; onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let finished = false;
    const done = () => { if (!finished) { finished = true; doneRef.current(); } };

    if (typeof el.animate !== "function") {
      const t = setTimeout(done, flight.duration);
      return () => { finished = true; clearTimeout(t); };
    }

    // Quadratic bezier from -> to, control point lifted above the path.
    const cx = (flight.fromX + flight.toX) / 2 + (flight.toY - flight.fromY) * 0.1;
    const cy = Math.min(flight.fromY, flight.toY) - flight.arc;
    const N = 28;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const mt = 1 - t;
      const x = mt * mt * flight.fromX + 2 * mt * t * cx + t * t * flight.toX;
      const y = mt * mt * flight.fromY + 2 * mt * t * cy + t * t * flight.toY;
      const scale = 1 + 0.25 * Math.sin(Math.PI * t); // swells mid-flight
      frames.push({
        transform: `translate(${x - flight.fromX}px, ${y - flight.fromY}px) rotate(${flight.fromRotation + (flight.toRotation - flight.fromRotation) * t}deg) scale(${scale})`,
        opacity: t > 0.85 ? String(1 - ((t - 0.85) / 0.15) * 0.9) : "1",
        offset: t,
      });
    }
    const anim = el.animate(frames, {
      duration: flight.duration,
      easing: "cubic-bezier(0.3, 0.1, 0.3, 1)",
      fill: "forwards",
    });
    anim.onfinish = done;
    return () => { finished = true; anim.cancel(); };
  }, [flight]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
      <div ref={ref} style={{ position: "absolute", left: flight.fromX - 28, top: flight.fromY - 40, willChange: "transform, opacity" }}>
        {flight.isBack ? <CardBack size={56} /> : <CardFace card={flight.card} size={56} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti                                                            */
/* ------------------------------------------------------------------ */

function Confetti({ count = 46 }: { count?: number }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.9,
      dur: 2.2 + Math.random() * 1.8,
      w: 6 + Math.random() * 6,
      color: [T.green, T.yellow, T.violet, "#ffffff", RED][i % 5],
    })),
    [count]
  );
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="c8-confetti"
          style={{ left: `${p.left}%`, width: p.w, height: p.w * 0.55, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function Crazy8Fullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: Crazy8View;
  youId: string;
  gameOver: { winnerId?: string; reason?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [flyingCard, setFlyingCard] = useState<Flight | null>(null);
  const flyKeyRef = useRef(0);

  const deckRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const oppRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const prefersReduced = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    []
  );

  const isMyTurn = gameState.isMyTurn;
  const mustDraw = isMyTurn && gameState.pendingDraw > 0 && !gameState.drawnCardId;
  const canStack = isMyTurn && gameState.pendingDraw > 0 && gameState.myHand.some((c) => c.rank === "2");
  const drawAllowed = isMyTurn && !gameOver && !gameState.drawnCardId;
  const myWinner = gameOver?.winnerId === youId;
  const oppWinner = gameOver && gameOver.winnerId !== youId;

  const selectedCard = selectedCardId ? gameState.myHand.find((c) => c.id === selectedCardId) : null;
  const isEight = selectedCard?.rank === "8";
  const activeOpp = gameState.opponents.find((o) => o.id === gameState.currentTurn);

  const launch = (f: Omit<Flight, "key">) => {
    if (prefersReduced) return;
    flyKeyRef.current += 1;
    setFlyingCard({ ...f, key: flyKeyRef.current });
  };

  // Prune refs for opponents who left
  useEffect(() => {
    const ids = new Set(gameState.opponents.map((o) => o.id));
    for (const id of oppRefs.current.keys()) if (!ids.has(id)) oppRefs.current.delete(id);
  }, [gameState.opponents]);

  // Animate opponents' plays / draws (deduped by content, not identity)
  const lastActionKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const curr = gameState.lastAction;
    if (!curr) return;
    const key = `${curr.type}:${curr.playerId}:${curr.cardId ?? ""}`;
    if (key === lastActionKeyRef.current) return;
    lastActionKeyRef.current = key;

    const deckEl = deckRef.current;
    const discardEl = discardRef.current;
    if (!deckEl || !discardEl) return;

    const deckRect = deckEl.getBoundingClientRect();
    const discardRect = discardEl.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const oppRect = oppRefs.current.get(curr.playerId)?.getBoundingClientRect();

    if (curr.type === "play" && curr.playerId !== youId && curr.cardId) {
      launch({
        // Opponent's card is hidden info — always fly face-down; the discard
        // pile's flip-in animation handles the reveal.
        card: { id: curr.cardId, suit: "hearts", rank: "?" },
        isBack: true,
        fromX: oppRect ? oppRect.left + oppRect.width / 2 : centerX,
        fromY: oppRect ? oppRect.top + oppRect.height / 2 : 100,
        toX: discardRect.left + discardRect.width / 2,
        toY: discardRect.top + discardRect.height / 2,
        fromRotation: (Math.random() - 0.5) * 30,
        toRotation: hashRot(curr.cardId, 14),
        arc: 90,
        duration: 520,
      });
    } else if (curr.type === "draw" && curr.playerId !== youId) {
      launch({
        card: { id: "draw", suit: "spades", rank: "?" },
        isBack: true,
        fromX: deckRect.left + deckRect.width / 2,
        fromY: deckRect.top + deckRect.height / 2,
        toX: oppRect ? oppRect.left + oppRect.width / 2 : centerX,
        toY: oppRect ? oppRect.top + oppRect.height / 2 : 100,
        fromRotation: 0,
        toRotation: (Math.random() - 0.5) * 24,
        arc: 70,
        duration: 460,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.lastAction, youId]);

  const launchOwnPlay = (cardId: string) => {
    const card = gameState.myHand.find((c) => c.id === cardId);
    const cardEl = document.querySelector(`[data-card-id="${cardId}"]`);
    const discardEl = discardRef.current;
    if (!card || !cardEl || !discardEl) return;
    const r = cardEl.getBoundingClientRect();
    const d = discardEl.getBoundingClientRect();
    launch({
      card,
      isBack: false,
      fromX: r.left + r.width / 2,
      fromY: r.top + r.height / 2,
      toX: d.left + d.width / 2,
      toY: d.top + d.height / 2,
      fromRotation: 0,
      toRotation: hashRot(card.id, 14),
      arc: 80,
      duration: 480,
    });
  };

  const submitPlay = (cardId: string, chosenSuit?: string) => {
    onSubmitAction(chosenSuit ? { type: "play", cardId, chosenSuit } : { type: "play", cardId });
    setSelectedCardId(null);
    vibrate(12);
  };

  const handlePlay = () => {
    if (!selectedCardId) return;
    if (isEight) { setShowSuitPicker(true); return; }
    launchOwnPlay(selectedCardId);
    submitPlay(selectedCardId);
  };

  const handleSuitChoice = (suit: string) => {
    if (selectedCardId) launchOwnPlay(selectedCardId);
    submitPlay(selectedCardId!, suit);
    setShowSuitPicker(false);
  };

  const handleDraw = () => {
    const deckEl = deckRef.current;
    if (deckEl) {
      const d = deckEl.getBoundingClientRect();
      launch({
        card: { id: "draw", suit: "spades", rank: "?" },
        isBack: true,
        fromX: d.left + d.width / 2,
        fromY: d.top + d.height / 2,
        toX: window.innerWidth / 2,
        toY: window.innerHeight - 70,
        fromRotation: 0,
        toRotation: (Math.random() - 0.5) * 24,
        arc: 80,
        duration: 460,
      });
    }
    onSubmitAction({ type: "draw" });
    setSelectedCardId(null);
    vibrate(8);
  };

  const handlePass = () => {
    onSubmitAction({ type: "pass" });
    setSelectedCardId(null);
  };

  const DW = 64;
  const DH = Math.round(DW * 1.45);

  const turnLabel = gameOver
    ? (myWinner ? "You Won!" : oppWinner ? "They Won" : "Game Over")
    : isMyTurn
      ? "Your Turn"
      : activeOpp ? `${activeOpp.name}'s Turn` : "Waiting\u2026";

  return (
    <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse 120% 90% at 50% 28%, ${T.charcoal} 0%, ${T.bgDeep} 72%)`, display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden", userSelect: "none" }}>
      <GameStyles />

      {/* Soft felt glow behind the play area */}
      <div style={{ position: "absolute", left: "50%", top: "42%", width: "140%", height: 440, transform: "translate(-50%, -50%)", background: `radial-gradient(ellipse at center, ${T.green}0d 0%, transparent 62%)`, pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", position: "relative" }}>
        <button onClick={onLeave} className="c8-btn" style={{ ...T.glass("rgba(10,20,14,0.65)"), color: T.green, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.06em", color: T.green, margin: 0 }}>{gameName}</h1>
        <button onClick={() => setShowInfo(!showInfo)} className="c8-btn" style={{ ...T.glass("rgba(10,20,14,0.65)"), color: T.chalkDim, width: 44, height: 44, borderRadius: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>i</button>
      </div>

      {/* Info */}
      <BottomDrawer open={showInfo} onClose={() => setShowInfo(false)} title={gameName}>
        <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6, color: T.chalkDim }}>Match the top card by suit or rank. First to empty their hand wins!</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: T.chalkDim }}>
          <div><span style={{ color: T.yellow, fontWeight: 700 }}>2</span> Next player draws 2 (stacks!)</div>
          <div><span style={{ color: T.yellow, fontWeight: 700 }}>Q</span> Skip next player</div>
          <div><span style={{ color: T.yellow, fontWeight: 700 }}>A</span> Reverse direction</div>
          <div><span style={{ color: T.yellow, fontWeight: 700 }}>8</span> Wild — choose any suit</div>
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted, marginTop: 12 }}>Room <span style={{ fontWeight: 700, color: T.green }}>{room.id}</span></div>
      </BottomDrawer>

      {/* Opponent seats */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(gameState.opponents.length, 1)}, 1fr)`, gap: 10, padding: "4px 12px", position: "relative" }}>
        {gameState.opponents.map((opp) => {
          const isActive = gameState.currentTurn === opp.id && !gameOver;
          const fanCount = Math.min(opp.cardCount, 8);
          return (
            <div
              key={opp.id}
              ref={(el) => { if (el) oppRefs.current.set(opp.id, el); else oppRefs.current.delete(opp.id); }}
              className={isActive ? "c8-seat-active" : undefined}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", borderRadius: 14, background: isActive ? `${T.green}10` : `${T.chalk}03`, border: `1px solid ${isActive ? `${T.green}30` : T.line}`, transition: "background 0.25s ease" }}
            >
              <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: isActive ? T.green : T.chalkDim, marginBottom: 6, letterSpacing: "0.06em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase" }}>
                {opp.name}
              </div>
              <div style={{ display: "flex", justifyContent: "center", height: 40, position: "relative", width: "100%" }}>
                {Array.from({ length: fanCount }).map((_, i) => {
                  const offset = i - (fanCount - 1) / 2;
                  return (
                    <div key={i} style={{ position: "absolute", left: "50%", transform: `translateX(calc(-50% + ${offset * 6}px)) rotate(${offset * 8}deg)`, transformOrigin: "bottom center" }}>
                      <CardBack size={28} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? T.green : T.chalkMuted, boxShadow: isActive ? `0 0 8px ${T.green}` : "none" }} />
                {/* key re-triggers the pop whenever the count changes */}
                <span key={opp.cardCount} className="c8-pop" style={{ fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700, color: isActive ? T.green : T.chalkMuted, letterSpacing: "0.06em" }}>
                  {opp.cardCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message bar */}
      {gameState.message && !gameOver && (
        <div key={gameState.message} className="c8-slide-up" style={{ textAlign: "center", padding: "8px", fontFamily: T.fontMono, fontSize: "12px", color: T.green, fontWeight: 600, letterSpacing: "0.03em" }}>
          {gameState.message}
        </div>
      )}

      {/* Center play area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 34, position: "relative" }}>
        {/* Turn indicator */}
        <div
          className={isMyTurn && !gameOver ? "c8-turn-active" : undefined}
          style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", padding: "6px 18px", borderRadius: "20px", background: isMyTurn ? `${T.green}12` : `${T.chalk}04`, border: `1px solid ${isMyTurn ? `${T.green}30` : T.line}`, fontFamily: T.fontDisplay, fontSize: "11px", fontWeight: 700, color: isMyTurn ? T.green : T.chalkMuted, letterSpacing: "0.08em", whiteSpace: "nowrap", textTransform: "uppercase" }}
        >
          {turnLabel}
        </div>

        {/* Draw pile (tap to draw) */}
        <div
          ref={deckRef}
          onClick={drawAllowed ? handleDraw : undefined}
          className={`c8-btn ${drawAllowed ? "c8-float" : ""}`}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: drawAllowed ? "pointer" : "default", padding: 6, borderRadius: 12 }}
        >
          <div style={{ position: "relative", width: DW, height: DH }}>
            {[2, 1, 0].map((i) => (
              <div key={i} style={{ position: "absolute", inset: 0, transform: `translate(${-i * 2}px, ${i * 2}px)`, opacity: 1 - i * 0.28 }}>
                <CardBack size={DW} />
              </div>
            ))}
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontMono, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.45)", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
              {gameState.deckCount}
            </div>
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: drawAllowed ? T.green : T.chalkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {drawAllowed ? "Tap to Draw" : "Draw"}
          </span>
        </div>

        {/* Discard pile with flip-in reveal */}
        <div ref={discardRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative", width: DW, height: DH }}>
            {/* ghost cards under the top card */}
            {[0, 1].map((i) => (
              <div key={i} style={{ position: "absolute", inset: 0, borderRadius: Math.round(DW * 0.1), background: "rgba(250,250,249,0.1)", border: "1px solid rgba(250,250,249,0.14)", transform: `rotate(${hashRot(gameState.topCard.id + i, 14)}deg) translate(${(i + 1) * 2}px, ${(i + 1) * -2}px)` }} />
            ))}
            {gameState.topCard && (
              <div key={gameState.topCard.id} className="c8-flip" style={{ position: "absolute", inset: 0 }}>
                <div style={{ transform: `rotate(${hashRot(gameState.topCard.id, 12)}deg)`, width: "100%", height: "100%" }}>
                  <CardFace card={gameState.topCard} size={DW} />
                </div>
              </div>
            )}
          </div>
          {gameState.wildSuit && (
            <div className="c8-slide-up" key={gameState.wildSuit} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: `${T.yellow}12`, border: `1px solid ${T.yellow}25` }}>
              <span style={{ fontSize: 13, color: isRedSuit(gameState.wildSuit) ? RED : T.chalk }}>{SUIT_SYMBOL[gameState.wildSuit]}</span>
              <span style={{ fontFamily: T.fontDisplay, fontSize: 10, color: T.yellow, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wild</span>
            </div>
          )}
        </div>

        {/* Direction indicator */}
        {gameState.opponents.length > 1 && !gameOver && (
          <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 6, fontFamily: T.fontMono, fontSize: 10, color: T.chalkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <span className="c8-spin" style={{ animationDirection: gameState.direction === 1 ? "normal" : "reverse", color: T.chalkDim }}>&#10227;</span>
            {gameState.direction === 1 ? "Clockwise" : "Counter"}
          </div>
        )}
      </div>

      {/* Pending draw indicator */}
      {gameState.pendingDraw > 0 && !gameOver && (
        <div key={gameState.pendingDraw} className="c8-shake" style={{ textAlign: "center", padding: "8px 16px", margin: "0 16px 8px", fontFamily: T.fontDisplay, fontSize: "11px", color: T.yellow, fontWeight: 700, letterSpacing: "0.06em", background: `${T.yellow}10`, borderRadius: 12, textTransform: "uppercase", border: `1px solid ${T.yellow}20` }}>
          {canStack ? "Play a 2 or draw!" : `Draw ${gameState.pendingDraw} cards!`}
        </div>
      )}

      {/* Action buttons */}
      {isMyTurn && !gameOver && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "0 16px 12px" }}>
          {gameState.drawnCardId ? (
            <button onClick={handlePass} className="c8-btn" style={{ padding: "12px 32px", ...T.glass(), color: T.chalk, borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
              Pass
            </button>
          ) : (
            <button onClick={handleDraw} className="c8-btn" style={{ padding: "12px 32px", ...T.glass(), color: gameState.pendingDraw > 0 ? T.yellow : T.chalk, borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
              {gameState.pendingDraw > 0 ? `Draw ${gameState.pendingDraw} Cards` : "Draw Card"}
            </button>
          )}
          {selectedCardId && (
            <button onClick={handlePlay} className="c8-btn" style={{ padding: "12px 32px", ...T.btn, ...T.btnPrimary(accent) }}>
              {isEight ? "Play 8 (Wild)" : "Play Card"}
            </button>
          )}
        </div>
      )}

      {/* Flying card */}
      {flyingCard && (
        <FlyingCard key={flyingCard.key} flight={flyingCard} onComplete={() => setFlyingCard(null)} />
      )}

      {/* Suit picker */}
      <BottomDrawer open={showSuitPicker} onClose={() => setShowSuitPicker(false)} title="Choose a suit">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(["hearts", "diamonds", "clubs", "spades"] as const).map((s) => (
            <button key={s} onClick={() => handleSuitChoice(s)} className="c8-btn" style={{ padding: "16px 12px", ...T.glass(), borderRadius: "14px", fontSize: "20px", cursor: "pointer", color: isRedSuit(s) ? RED : T.chalk, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 30 }}>{SUIT_SYMBOL[s]}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, textTransform: "capitalize", letterSpacing: "0.06em" }}>{s}</span>
            </button>
          ))}
        </div>
      </BottomDrawer>

      {/* Game over overlay */}
      {gameOver && (
        <div style={{ position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          {myWinner && <Confetti />}
          <div className="c8-overlay" style={{ textAlign: "center", padding: "40px" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>{myWinner ? "\uD83C\uDFC6" : "\uD83C\uDF89"}</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 32, textTransform: "uppercase", color: myWinner ? T.green : T.violet, margin: "0 0 8px" }}>
              {myWinner ? "You Win!" : "They Win!"}
            </h2>
            <p style={{ fontFamily: T.fontMono, fontSize: "12px", color: T.chalkDim, margin: "0 0 28px", letterSpacing: "0.05em" }}>
              {myWinner ? "Clean sweep!" : "Better luck next time!"}
            </p>
            <button onClick={onLeave} className="c8-btn" style={{ padding: "14px 36px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        </div>
      )}

      {/* Player hand */}
      <div style={{ padding: "8px 12px 16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px 6px" }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, letterSpacing: "0.1em", color: T.chalkMuted, textTransform: "uppercase" }}>Your Hand</span>
          <span key={gameState.myHand.length} className="c8-pop" style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: T.chalkDim, letterSpacing: "0.08em" }}>
            {gameState.myHand.length} {gameState.myHand.length === 1 ? "CARD" : "CARDS"}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: gameState.myHand.length > 8 ? "flex-start" : "center", overflowX: "auto", paddingBottom: 4, minHeight: 92, gap: gameState.myHand.length > 8 ? 0 : undefined }}>
          {gameState.myHand.map((card, i) => {
            const isSelected = selectedCardId === card.id;
            const is2WhenBlocked = mustDraw && card.rank !== "2";
            const playable = isMyTurn && !gameOver && !is2WhenBlocked && gameState.playableCardIds.includes(card.id);
            const total = gameState.myHand.length;
            const offset = i - (total - 1) / 2;
            const rotate = offset * (total > 6 ? 4 : 5);
            const translateY = Math.abs(offset) * (total > 6 ? 2 : 3);
            const isJustDrawn = gameState.drawnCardId === card.id;
            return (
              <div
                key={card.id}
                data-card-id={card.id}
                onClick={() => {
                  if (!playable) return;
                  if (isSelected) { handlePlay(); } // tap selected card = play it
                  else { setSelectedCardId(card.id); vibrate(8); }
                }}
                style={{
                  cursor: playable ? "pointer" : "default",
                  marginLeft: i === 0 ? 0 : -8,
                  flexShrink: 0,
                  transform: isSelected
                    ? "translateY(-22px) rotate(0deg) scale(1.12)"
                    : `translateY(${translateY}px) rotate(${rotate}deg)`,
                  transformOrigin: "bottom center",
                  transition: "transform 0.2s cubic-bezier(0.34, 1.4, 0.64, 1)",
                  filter: isSelected ? `drop-shadow(0 10px 22px ${accent}55)` : "none",
                  zIndex: isSelected ? 10 : i,
                  position: "relative",
                }}
              >
                {/* inner wrapper carries the deal-in animation so it doesn't fight the fan transform */}
                <div className="c8-deal" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                  <CardFace
                    card={card}
                    size={54}
                    dimmed={!playable}
                    ringColor={isJustDrawn ? accent : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
