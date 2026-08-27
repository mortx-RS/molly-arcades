import { useCallback, useEffect, useRef, useState } from "react";
import type { GameCatalogEntry } from "../../../shared/types";
import type { Room } from "../../../shared/types";
import type { NetStatus } from "../net/useRoom";
import type { Profile } from "../net/profile";
import { copyText } from "./clipboard";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

interface ChessView {
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

interface QuizView {
  round: number;
  totalRounds: number;
  prompt: string;
  myAnswer: string | null;
  opponentAnswer: string | null;
  mySubmitted: boolean;
  opponentSubmitted: boolean;
  revealed: boolean;
  myPrevious: string[];
  opponentPrevious: string[];
  roundScores: number[];
  compatibilityScore: number;
  waitingOn: "opponent" | "you" | null;
}

interface Crazy8Card {
  id: string;
  suit: string;
  rank: string;
}

interface Crazy8View {
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

interface CrosswordView {
  grid: string[][];
  revealedGrid: (string | null)[][];
  clues: { number: number; direction: string; row: number; col: number; clue: string; solved: boolean; solvedBy: string | null; guessedWord: string | null }[];
  scores: Record<string, number>;
  myScore: number;
  opponents: { id: string; name: string }[];
  currentTurn: string;
  isMyTurn: boolean;
  round: number;
  maxRounds: number;
  totalClues: number;
  solvedCount: number;
  winnerId: string | null;
  result: string | null;
  message: string | null;
  lastAction: { clueNumber: number; playerId: string; guess: string; correct: boolean } | null;
  myId: string;
  playerNames: Record<string, string>;
}

interface Props {
  room: Room | null;
  youId: string | null;
  gameState: unknown;
  gameOver: { winnerId?: string } | null;
  status: NetStatus;
  games: GameCatalogEntry[];
  profile: Profile;
  onLeave(): void;
  onStartGame(): void;
  onSubmitAction(action: unknown): void;
}

export function RoomScreen({ room, youId, gameState, gameOver, status, games, profile, onLeave, onStartGame, onSubmitAction }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const accent = profile.color;

  const game = games.find((g) => g.id === (room?.gameType ?? ""));
  const isInProgress = room?.status === "in-progress" && gameState;

  if (isInProgress && room?.gameType === "chess" && youId) {
    return (
      <ChessFullscreen
        gameState={gameState as ChessView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Chess"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "quiz" && youId) {
    return (
      <QuizFullscreen
        gameState={gameState as QuizView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Compatibility Quiz"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "crazy8" && youId) {
    return (
      <Crazy8Fullscreen
        gameState={gameState as Crazy8View}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Crazy 8"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "crossword" && youId) {
    return (
      <CrosswordFullscreen
        gameState={gameState as CrosswordView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Crossword Clash"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="topbar animate-in" style={{ flexShrink: 0, background: "rgba(8, 8, 15, 0.6)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: `1px solid ${T.line}`, borderRadius: "0 0 20px 20px", padding: "12px 16px" }}>
        <button className="back-btn" aria-label="Leave room" onClick={onLeave} style={{ background: T.charcoal, borderColor: T.lineStrong, width: 44, height: 44, fontSize: 20 }}>&#8249;</button>
        <h1 className="room-title" style={{ fontSize: 18 }}>{game ? game.name : room?.id ?? "Room"}</h1>
        <span className={`status-pill${status === "connected" ? " ok" : status === "offline" ? "" : " warn"}`}>
          {status === "connected" ? "Live" : status === "reconnecting" ? "Reconnecting\u2026" : status === "connecting" ? "Connecting\u2026" : "Offline"}
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 0" }}>

      {status === "reconnecting" && (
        <div className="banner animate-in" style={{ margin: "12px 16px 0", borderRadius: 12, background: T.yellowDim, borderColor: "rgba(221, 200, 48, 0.2)", animation: "slideDown 0.3s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
            </svg>
            <span>Connection dropped \u2014 restoring your seat\u2026</span>
          </div>
        </div>
      )}

      <section className="card animate-in animate-in-delay-1" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${accent}12 0%, transparent 50%)`, opacity: 0.5, pointerEvents: "none" }} />
        <h2>Room code</h2>
        {room ? (
          <>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
              <p className="code-display" style={{ margin: 0, userSelect: "all", fontSize: 36, letterSpacing: "0.25em" }}>{room.id}</p>
              <button onClick={() => copy("code")} style={{ width: 44, height: 44, borderRadius: 12, ...T.glass(), color: copied === "code" ? T.green : accent, borderColor: copied === "code" ? "rgba(0, 232, 123, 0.3)" : `${accent}30`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" }} aria-label="Copy room code">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            <p className="code-hint" style={{ margin: "0 0 16px" }}>Share this code or link to invite friends.</p>
            <div className="row">
              <button className="btn small secondary" onClick={() => copy("code")} style={{ flex: 1 }}>
                {copied === "code" ? "Copied \u2713" : "Copy code"}
              </button>
              <button className="btn small secondary" onClick={() => copy("link")} style={{ flex: 1 }}>
                {copied === "link" ? "Copied \u2713" : "Copy link"}
              </button>
            </div>
          </>
        ) : <p className="muted">Connecting\u2026</p>}
      </section>

      <section className="card animate-in animate-in-delay-2">
        <h2>Players <span style={{ fontWeight: 400, color: T.chalkMuted, fontSize: 12, marginLeft: 8 }}>{room?.players.length ?? 0} / {game?.maxPlayers ?? "?"}</span></h2>
        <ul className="player-list">
          {(room?.players ?? []).map((p, idx) => (
            <li className="player-row" key={p.id} style={{ animationDelay: `${0.06 * (idx + 1)}s` }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: p.connected ? `linear-gradient(135deg, ${accent} 0%, ${T.violet} 100%)` : T.surface,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.fontDisplay,
                fontSize: 14,
                fontWeight: 700,
                color: p.connected ? T.bgDeep : T.chalkMuted,
                boxShadow: p.connected ? `0 0 12px ${accent}40` : "none",
                flexShrink: 0,
                border: p.isHost ? `2px solid ${accent}` : "none",
                position: "relative"
              }}>
                {p.isHost && (
                  <span style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: accent,
                    border: `2px solid ${T.bgDeep}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </span>
                )}
                {!p.connected && (
                  <span style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    background: "rgba(4,4,10,0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.red }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="15" y1="9" x2="9" y2="15"></line>
                      <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span className="player-name" style={{ display: "block", fontWeight: 500 }}>{p.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: p.connected ? T.green : T.red,
                    boxShadow: p.connected ? `0 0 6px ${T.greenGlow}` : `0 0 6px ${T.pinkGlow}`
                  }} />
                  <span style={{ fontSize: 11, fontFamily: T.fontMono, color: p.connected ? T.green : T.chalkMuted, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {p.connected ? "Online" : "Away"}
                  </span>
                  {p.id === youId && (
                    <span className="badge" style={{ background: `${accent}15`, color: accent, borderColor: `${accent}25` }}>You</span>
                  )}
                  {p.isHost && p.id !== youId && (
                    <span className="badge host" style={{ background: T.neonDim, color: T.neon, borderColor: T.lineAccent }}>Host</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {room?.status === "lobby" && (
        <section className="card animate-in animate-in-delay-3" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px", fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, letterSpacing: "0.01em" }}>
                {game?.name ?? "Select a game"}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: T.chalkDim, lineHeight: 1.5 }}>
                {game?.tagline ?? "Choose a game from the catalog to play with friends."}
              </p>
            </div>
            {game && (
              <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: `${accent}12`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {game.icon ?? "🎮"}
              </div>
            )}
          </div>

          {game && (
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <span className="badge" style={{ background: `${accent}12`, color: accent, borderColor: `${accent}25` }}>
                {game.minPlayers}–{game.maxPlayers} players
              </span>
              <span className="badge" style={{ background: `${T.chalk}06`, color: T.chalkDim, borderColor: T.line }}>
                ~{game.estimatedMinutes} min
              </span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {room.players.length >= (game?.minPlayers ?? 2) && room.hostId === youId ? (
              <button
                className="btn primary"
                onClick={onStartGame}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: "14px 24px",
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  boxShadow: `0 4px 24px ${accent}30, 0 2px 8px rgba(0,0,0,0.3)`,
                  position: "relative",
                  overflow: "hidden"
                }}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "pulse 1.5s ease-in-out infinite" }}>
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Start Game
                  <span style={{ fontFamily: T.fontMono, fontSize: 12, opacity: 0.9, background: "rgba(0,0,0,0.15)", padding: "2px 8px", borderRadius: 999 }}>
                    {room.players.length} ready
                  </span>
                </span>
              </button>
            ) : room.players.length < (game?.minPlayers ?? 2) ? (
              <>
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: T.yellowDim, border: `1px solid rgba(221, 200, 48, 0.2)`, borderRadius: 12, color: T.yellow, fontSize: 13, fontWeight: 600 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Need {game?.minPlayers ?? 2} players to start ({room.players.length}/{game?.minPlayers ?? 2})
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 13, fontWeight: 600 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
                  </svg>
                  Waiting for host to start…
                </div>
              </>
            )}
          </div>

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 11, fontFamily: T.fontMono, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Room: {room?.id ?? "—"}</span>
            <span>{room?.players.length ?? 0} / {game?.maxPlayers ?? "?"}</span>
          </div>
        </section>
      )}

      {gameOver && (
        <section className="card animate-in" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: gameOver.winnerId === youId ? `radial-gradient(ellipse at center, ${T.greenDim} 0%, transparent 70%)` : `radial-gradient(ellipse at center, ${T.pinkDim} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 56, marginBottom: 8, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))" }}>
              {gameOver.winnerId === youId ? "🏆" : "💥"}
            </div>
            <h2 style={{ margin: "0 0 4px", fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 800, color: gameOver.winnerId === youId ? T.green : T.red, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {gameOver.winnerId === youId ? "Victory!" : "Defeat"}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: T.chalkDim }}>
              {gameOver.winnerId === youId ? "Well played! Ready for a rematch?" : "Better luck next time!"}
            </p>
            <button className="btn primary" onClick={onLeave} style={{ padding: "16px 32px", fontSize: 15, fontWeight: 700 }}>
              Back to Lobby
            </button>
          </div>
        </section>
      )}

      <button
        className="btn secondary animate-in animate-in-delay-3"
        onClick={onLeave}
        style={{
          padding: "14px 28px",
          fontSize: 14,
          fontWeight: 600,
          borderColor: T.lineStrong,
          background: T.surface
        }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Leave room
        </span>
      </button>

      </div>
    </div>
  );

  async function copy(kind: "code" | "link") {
    if (!room) return;
    const value = kind === "code" ? room.id : `${location.origin}/?room=${room.id}`;
    const ok = await copyText(value);
    setCopied(ok ? kind : null);
    if (ok) setTimeout(() => setCopied(null), 1600);
  }
}

const PIECE_UNICODE: Record<string, Record<string, string>> = {
  w: { K: "\u2654", Q: "\u2655", R: "\u2656", B: "\u2657", N: "\u2658", P: "\u2659" },
  b: { K: "\u265A", Q: "\u265B", R: "\u265C", B: "\u265D", N: "\u265E", P: "\u265F" }
};

function ChessFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
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
        const r = flipBoard ? 7 - ri : ri;
        const c = flipBoard ? 7 - ci : ci;
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

        const bg = isSelected
          ? `${accent}40`
          : isLastMove
            ? `${accent}12`
            : isDark
              ? "#1a1a2e"
              : "#2a2a3e";

        cells.push(
          <div
            key={`${r}-${c}`}
            onClick={() => handleSquareClick(r, c)}
            style={{
              width: "100%",
              paddingBottom: "100%",
              position: "relative",
              background: bg,
              cursor: isMyTurn && !gameOver ? "pointer" : "default",
              boxShadow: isKingInCheck ? "inset 0 0 12px rgba(238, 51, 85, 0.5)" : "none"
            }}
          >
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isLegalTarget && (
                <div style={{
                  width: piece ? "80%" : "30%",
                  height: piece ? "80%" : "30%",
                  borderRadius: piece ? "8px" : "50%",
                  background: piece ? "transparent" : `${T.green}55`,
                  border: piece ? "3px solid rgba(232, 0, 92, 0.5)" : "none",
                  position: "absolute",
                  zIndex: 1
                }} />
              )}
              {piece && (
                <span style={{
                  fontSize: "min(9vw, 48px)",
                  lineHeight: 1,
                  filter: piece.color === gameState.myColor ? "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" : "none",
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

  const isFlipped = gameState.myColor === "b";

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
        <div style={{ flex: 1, padding: "12px 14px", borderRadius: 14, background: gameState.turn === "b" ? `${T.green}10` : `${T.chalk}04`, border: `1px solid ${gameState.turn === "b" ? `${T.green}30` : T.line}`, transition: "all 0.2s ease" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: gameState.turn === "b" ? T.green : T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {gameState.blackName} {gameState.myColor === "b" ? "(you)" : ""}
          </div>
          <div style={{ fontSize: 14, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>{"\u265A"} Black</div>
        </div>
        <div style={{ flex: 1, padding: "12px 14px", borderRadius: 14, background: gameState.turn === "w" ? `${T.green}10` : `${T.chalk}04`, border: `1px solid ${gameState.turn === "w" ? `${T.green}30` : T.line}`, transition: "all 0.2s ease" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: gameState.turn === "w" ? T.green : T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {gameState.whiteName} {gameState.myColor === "w" ? "(you)" : ""}
          </div>
          <div style={{ fontSize: 14, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>{"\u2654"} White</div>
        </div>
      </div>

      {/* Status */}
      {gameState.inCheck && !gameOver && (
        <div style={{ flexShrink: 0, textAlign: "center", padding: "8px", margin: "0 16px 8px", fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, color: T.pink, letterSpacing: "0.06em", textTransform: "uppercase", background: `${T.pink}10`, borderRadius: 10, border: `1px solid ${T.pink}20` }}>
          Check!
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px" }}>
        <div style={{ height: "100%", aspectRatio: "1", maxHeight: "min(80vh, 100vw)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", width: "100%", height: "100%", borderRadius: 12, overflow: "hidden", border: `2px solid ${T.lineStrong}`, boxShadow: "0 4px 24px rgba(0,0,0,0.3)" }}>
            {renderBoard()}
          </div>
        </div>
      </div>

      {/* Turn indicator */}
      {!gameOver && (
        <div style={{ flexShrink: 0, textAlign: "center", padding: "10px", fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: isMyTurn ? T.green : T.chalkDim, letterSpacing: "0.04em", textTransform: "uppercase" }}>
          {isMyTurn ? "Your turn" : "Waiting\u2026"}
        </div>
      )}

      {/* Promotion picker */}
      <BottomDrawer open={!!showPromo} onClose={() => { setShowPromo(null); setPromoFrom(null); setSelected(null); }} title="Promote pawn to">
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {["Q", "R", "B", "N"].map((type) => (
            <button key={type} onClick={() => handlePromo(type)} style={{ width: 64, height: 64, borderRadius: 14, ...T.glass(), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, cursor: "pointer", transition: "all 0.15s" }}>
              {PIECE_UNICODE[gameState.myColor]?.[type]}
            </button>
          ))}
        </div>
      </BottomDrawer>

      {/* Game over */}
      {gameOver && (
        <div style={{ position: "absolute", inset: 0, background: T.overlayBg, backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{gameOver.winnerId === youId ? "\uD83C\uDFC6" : "\uD83C\uDF89"}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 800, color: gameOver.winnerId === youId ? T.green : T.red, marginBottom: 8 }}>
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
      {/* Info */}
      <BottomDrawer open={showInfo} onClose={() => setShowInfo(false)} title={gameName}>
        <p style={{ color: T.chalkDim, fontSize: 13, lineHeight: 1.6, margin: "0 0 12px" }}>Click a piece to select it, then click a highlighted square to move. Capture the opponent's king to win.</p>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted }}>Room {room.id}</div>
      </BottomDrawer>
    </div>
  );
}

function QuizFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: QuizView;
  youId: string;
  gameOver: { winnerId?: string; reason?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const handleSubmit = () => {
    if (answer.trim() && !gameState.mySubmitted) {
      onSubmitAction({ type: "answer", answer: answer.trim() });
      setAnswer("");
    }
  };

  const handleNextRound = () => {
    onSubmitAction({ type: "next_round" });
  };

  const roundScore = gameState.roundScores[gameState.round - 1] ?? null;
  const isLastRound = gameState.round >= gameState.totalRounds - 1 && gameState.revealed;

  return (
    <div style={{ position: "fixed", inset: 0, background: `linear-gradient(160deg, ${T.bgDeep} 0%, ${T.charcoal} 50%, ${T.bgDeep} 100%)`, display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", paddingBottom: "env(safe-area-inset-bottom, 12px)" }}>
        <button onClick={onLeave} style={{ ...T.glass(), color: T.violet, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 18, textTransform: "uppercase", letterSpacing: "0.02em", color: T.violet }}>{gameName}</h1>
        <button onClick={() => setShowInfo(!showInfo)} style={{ ...T.glass(), color: T.chalkDim, width: 44, height: 44, borderRadius: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>i</button>
      </div>

      {/* Info */}
      <BottomDrawer open={showInfo} onClose={() => setShowInfo(false)} title={gameName}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: T.chalkDim }}>Answer prompts honestly \u2014 the more you match, the higher your compatibility score!</p>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted, marginTop: 12 }}>Room <span style={{ fontWeight: 700, color: T.violet }}>{room.id}</span></div>
      </BottomDrawer>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "20px", gap: "24px" }}>
        {gameOver ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "8px" }}>&#128150;</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 32, textTransform: "uppercase", color: T.violet, margin: "0 0 8px" }}>
              {gameState.compatibilityScore}% Match
            </h2>
            <p style={{ fontFamily: T.fontMono, fontSize: "13px", color: T.chalkDim, margin: "0 0 8px", letterSpacing: "0.05em" }}>Final Compatibility</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "12px" }}>
              {gameState.roundScores.map((s, i) => (
                <div key={i} style={{ width: "40px", height: "40px", borderRadius: "10px", background: s >= 7 ? `${T.green}15` : s >= 5 ? `${T.yellow}15` : `${T.red}15`, color: s >= 7 ? T.green : s >= 5 ? T.yellow : T.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontMono, fontWeight: 700, fontSize: "14px", border: `1px solid ${s >= 7 ? `${T.green}25` : s >= 5 ? `${T.yellow}25` : `${T.red}25`}` }}>
                  {s}
                </div>
              ))}
            </div>
            <button onClick={onLeave} style={{ marginTop: "24px", padding: "14px 36px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.chalkMuted, fontWeight: 600, marginBottom: "6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Round {gameState.round + 1} of {gameState.totalRounds}</div>
              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "8px" }}>
                {gameState.roundScores.map((s, i) => (
                  <div key={i} style={{ width: "28px", height: "28px", borderRadius: "8px", background: s >= 7 ? `${T.green}15` : s >= 5 ? `${T.yellow}15` : `${T.red}15`, color: s >= 7 ? T.green : s >= 5 ? T.yellow : T.red, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontMono, fontWeight: 700, fontSize: "12px", border: `1px solid ${s >= 7 ? `${T.green}20` : s >= 5 ? `${T.yellow}20` : `${T.red}20`}` }}>
                    {s}
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: T.fontMono, fontSize: "13px", color: T.chalkDim }}>Compatibility: <span style={{ color: T.violet, fontWeight: 700 }}>{gameState.compatibilityScore}%</span></div>
            </div>

            <div style={{ width: "100%", maxWidth: "400px" }}>
              <div style={{ padding: "20px", ...T.glass(T.charcoal), borderRadius: 16, marginBottom: "16px" }}>
                <h2 style={{ fontFamily: T.fontBody, fontSize: "18px", fontWeight: 600, color: T.chalk, margin: "0 0 16px", lineHeight: "1.4" }}>{gameState.prompt}</h2>

                {gameState.revealed ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div style={{ padding: "12px", background: `${T.green}10`, borderRadius: "12px", border: `1px solid ${T.green}20` }}>
                      <div style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.green, fontWeight: 700, marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>You</div>
                      <div style={{ fontSize: "15px", color: T.chalk }}>{gameState.myAnswer ?? "No answer"}</div>
                    </div>
                    <div style={{ padding: "12px", background: `${T.violet}10`, borderRadius: "12px", border: `1px solid ${T.violet}20` }}>
                      <div style={{ fontFamily: T.fontMono, fontSize: "10px", color: T.violet, fontWeight: 700, marginBottom: "4px", letterSpacing: "0.08em", textTransform: "uppercase" }}>Them</div>
                      <div style={{ fontSize: "15px", color: T.chalk }}>{gameState.opponentAnswer ?? "No answer"}</div>
                    </div>
                    {roundScore !== null && (
                      <div style={{ textAlign: "center", padding: "12px", borderRadius: "12px", background: roundScore >= 7 ? `${T.green}15` : roundScore >= 5 ? `${T.yellow}15` : `${T.red}15`, color: roundScore >= 7 ? T.green : roundScore >= 5 ? T.yellow : T.red, fontFamily: T.fontMono, fontWeight: 700, fontSize: "13px", border: `1px solid ${roundScore >= 7 ? `${T.green}20` : roundScore >= 5 ? `${T.yellow}20` : `${T.red}20`}` }}>
                        {roundScore >= 10 ? "Perfect Match!" : roundScore >= 7 ? "Great Match!" : roundScore >= 5 ? "Something in Common!" : "No Match"}
                      </div>
                    )}
                    {!isLastRound && (
                      <button onClick={handleNextRound} style={{ width: "100%", padding: "14px", ...T.btn, ...T.btnPrimary(accent), marginTop: "4px" }}>
                        Next Round
                      </button>
                    )}
                  </div>
                ) : gameState.mySubmitted ? (
                  <div style={{ textAlign: "center", padding: "16px", color: T.chalkDim }}>
                    <div style={{ fontFamily: T.fontMono, fontSize: "12px", marginBottom: "8px", letterSpacing: "0.05em" }}>Answer submitted!</div>
                    <div style={{ fontSize: "13px", color: T.chalkMuted }}>Waiting for {gameState.waitingOn === "opponent" ? "them to answer..." : "both answers..."}</div>
                    <div style={{ marginTop: "12px", display: "flex", gap: "12px", justifyContent: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: T.green }} />
                        <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.chalkDim }}>You</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: gameState.opponentSubmitted ? T.green : T.surface }} />
                        <span style={{ fontFamily: T.fontMono, fontSize: "11px", color: T.chalkDim }}>Them</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <input
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                      placeholder="Type your answer..."
                      maxLength={100}
                      style={{ width: "100%", padding: "14px 16px", background: `${T.charcoal}`, border: `1px solid ${T.lineStrong}`, borderRadius: "12px", color: T.chalk, fontSize: "16px", outline: "none", boxSizing: "border-box", fontFamily: T.fontBody }}
                      autoFocus
                    />
                    <button
                      onClick={handleSubmit}
                      disabled={!answer.trim()}
                      style={{ width: "100%", padding: "14px", ...T.btn, ...T.btnPrimary(accent), opacity: answer.trim() ? 1 : 0.5 }}
                    >
                      Submit Answer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const SUIT_SYMBOL: Record<string, string> = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };

function CardFace({ card, size, dimmed }: { card: Crazy8Card; size?: number; dimmed?: boolean }) {
  const w = size ?? 56;
  const h = Math.round(w * 1.45);
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const fontSize = Math.round(w * 0.22);
  const suitSize = Math.round(w * 0.45);
  return (
    <div style={{ width: w, height: h, borderRadius: Math.round(w * 0.12), background: "#fafaf9", border: "2px solid #e7e5e4", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, opacity: dimmed ? 0.35 : 1, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)" }}>
      <span style={{ fontSize, fontFamily: T.fontDisplay, color: isRed ? "#dc2626" : "#1c1917", lineHeight: 1 }}>{card.rank}</span>
      <span style={{ fontSize: suitSize, color: isRed ? "#dc2626" : "#1c1917", lineHeight: 1 }}>{SUIT_SYMBOL[card.suit] ?? "?"}</span>
    </div>
  );
}

function CardBack({ size }: { size?: number }) {
  const w = size ?? 56;
  const h = Math.round(w * 1.45);
  return (
    <div style={{ width: w, height: h, borderRadius: Math.round(w * 0.12), background: `linear-gradient(135deg, ${T.violet}, #6d28d9)`, border: `2px solid rgba(167, 139, 250, 0.4)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,0.35)" }}>
      <span style={{ fontFamily: T.fontDisplay, fontSize: Math.round(w * 0.28), color: "rgba(255,255,255,0.25)" }}>&#10084;</span>
    </div>
  );
}

interface FlyingCard {
  card: Crazy8Card;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromRotation: number;
  toRotation: number;
  key: number;
}

function Crazy8Fullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
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
  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);
  const flyKeyRef = useRef(0);

  const deckRef = useRef<HTMLDivElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const oppRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const isMyTurn = gameState.isMyTurn;
  const mustDraw = isMyTurn && gameState.pendingDraw > 0 && !gameState.drawnCardId;
  const canStack = isMyTurn && gameState.pendingDraw > 0 && gameState.myHand.some((c) => c.rank === "2");
  const myWinner = gameOver?.winnerId === youId;
  const oppWinner = gameOver && gameOver.winnerId !== youId;

  const selectedCard = selectedCardId ? gameState.myHand.find((c) => c.id === selectedCardId) : null;
  const isEight = selectedCard?.rank === "8";

  const lastActionRef = useRef(gameState.lastAction);
  useEffect(() => {
    const prev = lastActionRef.current;
    const curr = gameState.lastAction;
    lastActionRef.current = curr;
    if (!curr || curr === prev) return;

    const deckEl = deckRef.current;
    const discardEl = discardRef.current;
    if (!deckEl || !discardEl) return;

    const deckRect = deckEl.getBoundingClientRect();
    const discardRect = discardEl.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    if (curr.type === "play" && curr.playerId !== youId && curr.cardId) {
      const oppEl = oppRefs.current.get(curr.playerId);
      const oppRect = oppEl?.getBoundingClientRect();
      const fromX = oppRect ? oppRect.left + oppRect.width / 2 : centerX;
      const fromY = oppRect ? oppRect.top + oppRect.height / 2 : 100;
      flyKeyRef.current += 1;
      setFlyingCard({
        card: { id: curr.cardId, suit: "hearts", rank: "?" },
        fromX, fromY,
        toX: discardRect.left + discardRect.width / 2,
        toY: discardRect.top + discardRect.height / 2,
        fromRotation: (Math.random() - 0.5) * 30,
        toRotation: 0,
        key: flyKeyRef.current
      });
    } else if (curr.type === "draw" && curr.playerId !== youId) {
      flyKeyRef.current += 1;
      const oppEl = oppRefs.current.get(curr.playerId);
      const oppRect = oppEl?.getBoundingClientRect();
      const toX = oppRect ? oppRect.left + oppRect.width / 2 : centerX;
      const toY = oppRect ? oppRect.top + oppRect.height / 2 : 100;
      setFlyingCard({
        card: { id: "draw", suit: "spades", rank: "?" },
        fromX: deckRect.left + deckRect.width / 2,
        fromY: deckRect.top + deckRect.height / 2,
        toX, toY,
        fromRotation: 0,
        toRotation: (Math.random() - 0.5) * 20,
        key: flyKeyRef.current
      });
    }
  }, [gameState.lastAction, youId]);

  const handlePlay = () => {
    if (!selectedCardId) return;
    if (isEight) {
      setShowSuitPicker(true);
      return;
    }
    const cardEl = document.querySelector(`[data-card-id="${selectedCardId}"]`);
    const discardEl = discardRef.current;
    if (cardEl && discardEl) {
      const cardRect = cardEl.getBoundingClientRect();
      const discardRect = discardEl.getBoundingClientRect();
      flyKeyRef.current += 1;
      setFlyingCard({
        card: gameState.myHand.find((c) => c.id === selectedCardId)!,
        fromX: cardRect.left + cardRect.width / 2,
        fromY: cardRect.top + cardRect.height / 2,
        toX: discardRect.left + discardRect.width / 2,
        toY: discardRect.top + discardRect.height / 2,
        fromRotation: 0,
        toRotation: 0,
        key: flyKeyRef.current
      });
    }
    onSubmitAction({ type: "play", cardId: selectedCardId });
    setSelectedCardId(null);
  };

  const handleSuitChoice = (suit: string) => {
    onSubmitAction({ type: "play", cardId: selectedCardId, chosenSuit: suit });
    setSelectedCardId(null);
    setShowSuitPicker(false);
  };

  const handleDraw = () => {
    const deckEl = deckRef.current;
    if (deckEl) {
      const deckRect = deckEl.getBoundingClientRect();
      flyKeyRef.current += 1;
      setFlyingCard({
        card: { id: "draw", suit: "spades", rank: "?" },
        fromX: deckRect.left + deckRect.width / 2,
        fromY: deckRect.top + deckRect.height / 2,
        toX: window.innerWidth / 2,
        toY: window.innerHeight - 60,
        fromRotation: 0,
        toRotation: (Math.random() - 0.5) * 20,
        key: flyKeyRef.current
      });
    }
    onSubmitAction({ type: "draw" });
    setSelectedCardId(null);
  };

  const handlePass = () => {
    onSubmitAction({ type: "pass" });
    setSelectedCardId(null);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: `linear-gradient(180deg, ${T.bgDeep} 0%, ${T.charcoal} 50%, ${T.bgDeep} 100%)`, display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden", userSelect: "none" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={onLeave} style={{ ...T.glass("rgba(10,20,14,0.65)"), color: T.green, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <h1 style={{ fontFamily: T.fontDisplay, fontSize: 17, textTransform: "uppercase", letterSpacing: "0.02em", color: T.green, margin: 0 }}>{gameName}</h1>
        <button onClick={() => setShowInfo(!showInfo)} style={{ ...T.glass("rgba(10,20,14,0.65)"), color: T.chalkDim, width: 44, height: 44, borderRadius: 14, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>i</button>
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
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${gameState.opponents.length}, 1fr)`, gap: 10, padding: "4px 12px" }}>
        {gameState.opponents.map((opp) => {
          const isActive = gameState.currentTurn === opp.id;
          const fanCount = Math.min(opp.cardCount, 8);
          return (
            <div
              key={opp.id}
              ref={(el) => { if (el) oppRefs.current.set(opp.id, el); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 8px", borderRadius: 14, background: isActive ? `${T.green}10` : `${T.chalk}03`, border: `1px solid ${isActive ? `${T.green}30` : T.line}`, transition: "all 0.25s ease" }}
            >
              <div style={{ fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700, color: isActive ? T.green : T.chalkDim, marginBottom: 6, letterSpacing: "0.06em", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase" }}>
                {opp.name}
              </div>
              <div style={{ display: "flex", justifyContent: "center", height: 40, position: "relative", width: "100%" }}>
                {Array.from({ length: fanCount }).map((_, i) => {
                  const offset = i - (fanCount - 1) / 2;
                  const rotate = offset * 8;
                  const translateX = offset * 6;
                  return (
                    <div key={i} style={{ position: "absolute", left: "50%", transform: `translateX(calc(-50% + ${translateX}px)) rotate(${rotate}deg)`, transformOrigin: "bottom center" }}>
                      <CardBack size={28} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: isActive ? T.green : T.chalkMuted, boxShadow: isActive ? `0 0 8px ${T.green}40` : "none" }} />
                <span style={{ fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700, color: isActive ? T.green : T.chalkMuted, letterSpacing: "0.06em" }}>
                  {opp.cardCount}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message bar */}
      {gameState.message && !gameOver && (
        <div style={{ textAlign: "center", padding: "8px", fontFamily: T.fontMono, fontSize: "12px", color: T.green, fontWeight: 600, letterSpacing: "0.03em" }}>{gameState.message}</div>
      )}

      {/* Center play area */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 28, position: "relative" }}>
        {/* Draw pile */}
        <div ref={deckRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ position: "relative" }}>
            <CardBack size={64} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.fontMono, fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
              {gameState.deckCount}
            </div>
          </div>
          <span style={{ fontFamily: T.fontMono, fontSize: 10, color: T.chalkMuted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Draw</span>
        </div>

        {/* Discard / top card */}
        <div ref={discardRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          {gameState.topCard && <CardFace card={gameState.topCard} size={64} />}
          {gameState.wildSuit && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, background: `${T.yellow}12`, border: `1px solid ${T.yellow}25` }}>
              <span style={{ fontSize: 13 }}>{SUIT_SYMBOL[gameState.wildSuit]}</span>
              <span style={{ fontFamily: T.fontDisplay, fontSize: 10, color: T.yellow, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>Wild</span>
            </div>
          )}
        </div>

        {/* Turn indicator */}
        <div style={{ position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)", padding: "6px 18px", borderRadius: "20px", background: isMyTurn ? `${T.green}12` : `${T.chalk}04`, border: `1px solid ${isMyTurn ? `${T.green}30` : T.line}`, fontFamily: T.fontDisplay, fontSize: "11px", fontWeight: 700, color: isMyTurn ? T.green : T.chalkMuted, letterSpacing: "0.08em", whiteSpace: "nowrap", textTransform: "uppercase" }}>
          {gameOver ? (myWinner ? "You won!" : oppWinner ? "They won" : "Game Over") : isMyTurn ? "Your turn" : "Waiting\u2026"}
        </div>
      </div>

      {/* Pending draw indicator */}
      {gameState.pendingDraw > 0 && !gameOver && (
        <div style={{ textAlign: "center", padding: "8px 16px", margin: "0 16px 8px", fontFamily: T.fontDisplay, fontSize: "11px", color: T.yellow, fontWeight: 700, letterSpacing: "0.06em", background: `${T.yellow}10`, borderRadius: 12, textTransform: "uppercase", border: `1px solid ${T.yellow}20` }}>
          {canStack ? "Play a 2 or draw!" : `Draw ${gameState.pendingDraw} cards!`}
        </div>
      )}

      {/* Action buttons */}
      {isMyTurn && !gameOver && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, padding: "0 16px 12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          {gameState.drawnCardId ? (
            <button onClick={handlePass} style={{ padding: "12px 32px", ...T.glass(), color: T.chalk, borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
              Pass
            </button>
          ) : gameState.pendingDraw > 0 ? (
            <button onClick={handleDraw} style={{ padding: "12px 32px", ...T.glass(), color: T.yellow, borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
              Draw {gameState.pendingDraw} Cards
            </button>
          ) : (
            <button onClick={handleDraw} style={{ padding: "12px 32px", ...T.glass(), color: T.chalk, borderRadius: "12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: T.fontMono, letterSpacing: "0.04em" }}>
              Draw Card
            </button>
          )}
          {selectedCardId && (
            <button onClick={handlePlay} style={{ padding: "12px 32px", ...T.btn, ...T.btnPrimary(accent) }}>
              {isEight ? "Play 8 (Wild)" : "Play Card"}
            </button>
          )}
        </div>
      )}

      {/* Flying card animation */}
      {flyingCard && (
        <FlyingCardAnim
          key={flyingCard.key}
          card={flyingCard.card}
          fromX={flyingCard.fromX}
          fromY={flyingCard.fromY}
          toX={flyingCard.toX}
          toY={flyingCard.toY}
          fromRotation={flyingCard.fromRotation}
          toRotation={flyingCard.toRotation}
          onComplete={() => setFlyingCard(null)}
        />
      )}

      {/* Suit picker */}
      <BottomDrawer open={showSuitPicker} onClose={() => setShowSuitPicker(false)} title="Choose a suit">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {(["hearts", "diamonds", "clubs", "spades"] as const).map((s) => (
            <button key={s} onClick={() => handleSuitChoice(s)} style={{ padding: "16px 12px", ...T.glass(), borderRadius: "14px", fontSize: "20px", cursor: "pointer", color: (s === "hearts" || s === "diamonds") ? "#dc2626" : T.chalk, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 28 }}>{SUIT_SYMBOL[s]}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, textTransform: "capitalize", letterSpacing: "0.06em" }}>{s}</span>
            </button>
          ))}
        </div>
      </BottomDrawer>

      {/* Game over overlay */}
      {gameOver && (
        <div style={{ position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
          <div style={{ textAlign: "center", padding: "40px" }}>
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>{myWinner ? "\uD83C\uDFC6" : "\uD83C\uDF89"}</div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 32, textTransform: "uppercase", color: myWinner ? T.green : T.violet, margin: "0 0 8px" }}>
              {myWinner ? "You Win!" : "They Win!"}
            </h2>
            <p style={{ fontFamily: T.fontMono, fontSize: "12px", color: T.chalkDim, margin: "0 0 28px", letterSpacing: "0.05em" }}>
              {myWinner ? "Clean sweep!" : "Better luck next time!"}
            </p>
            <button onClick={onLeave} style={{ padding: "14px 36px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        </div>
      )}

      {/* Player hand */}
      <div style={{ padding: "8px 12px 16px", paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}>
        <div style={{ display: "flex", justifyContent: gameState.myHand.length > 8 ? "flex-start" : "center", overflowX: "auto", paddingBottom: 4, minHeight: 88, gap: gameState.myHand.length > 8 ? 0 : undefined }}>
          {gameState.myHand.map((card, i) => {
            const isSelected = selectedCardId === card.id;
            const is2WhenBlocked = mustDraw && card.rank !== "2";
            const isPlayable = gameState.playableCardIds.includes(card.id);
            const playable = isMyTurn && !gameOver && !is2WhenBlocked && isPlayable;
            const total = gameState.myHand.length;
            const offset = i - (total - 1) / 2;
            const rotate = offset * (total > 6 ? 4 : 5);
            const translateY = Math.abs(offset) * (total > 6 ? 2 : 3);
            return (
              <div
                key={card.id}
                data-card-id={card.id}
                onClick={() => playable && setSelectedCardId(isSelected ? null : card.id)}
                style={{
                  cursor: playable ? "pointer" : "default",
                  marginLeft: i === 0 ? 0 : -8,
                  flexShrink: 0,
                  transform: isSelected
                    ? `translateY(-20px) rotate(0deg) scale(1.1)`
                    : `translateY(${translateY}px) rotate(${rotate}deg)`,
                  transformOrigin: "bottom center",
                  transition: "transform 0.18s ease, filter 0.18s ease",
                  filter: isSelected ? "drop-shadow(0 8px 20px rgba(0, 232, 123, 0.4))" : "none",
                  zIndex: isSelected ? 10 : i,
                  position: "relative"
                }}
              >
                <CardFace card={card} size={54} dimmed={!playable} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CrosswordFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
  gameState: CrosswordView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}) {
  const [selectedClue, setSelectedClue] = useState<number | null>(null);
  const [guessInput, setGuessInput] = useState("");
  const [showAll, setShowAll] = useState(false);

  const isMyTurn = gameState.isMyTurn;
  const revealed = gameState.revealedGrid;
  const grid = gameState.grid;
  const gridSize = grid.length;

  const unsolvedClues = gameState.clues.filter((c) => !c.solved);

  const handleGuess = () => {
    if (selectedClue === null || !guessInput.trim()) return;
    onSubmitAction({ type: "guess", clueNumber: selectedClue, guess: guessInput.trim() });
    setGuessInput("");
    setSelectedClue(null);
  };

  const handlePass = () => {
    onSubmitAction({ type: "pass" });
  };

  const handleClueClick = (num: number) => {
    if (!isMyTurn || gameOver) return;
    setSelectedClue(num);
    setGuessInput("");
  };

  const selectedClueData = gameState.clues.find((c) => c.number === selectedClue);

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
        <button onClick={onLeave} style={{ ...T.glass(), color: T.chalk, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.chalk }}>{gameName}</div>
          <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted, marginTop: 2 }}>
            Round {gameState.round + 1}/{gameState.maxRounds} · {gameState.solvedCount}/{gameState.totalClues} solved
          </div>
        </div>
        <div style={{
          background: gameState.isMyTurn ? `${T.neon}15` : `${T.chalk}06`,
          color: gameState.isMyTurn ? T.neon : T.chalkMuted,
          fontSize: 11,
          fontWeight: 600,
          padding: "6px 12px",
          borderRadius: 12,
          fontFamily: T.fontDisplay
        }}>
          {gameOver ? "Done" : isMyTurn ? "Your turn" : "Opponent's turn"}
        </div>
      </div>

      {/* Message banner */}
      {gameState.message && (
        <div style={{
          padding: "10px 16px",
          fontSize: 13,
          textAlign: "center",
          background: gameState.lastAction?.correct ? `${T.green}10` : `${T.red}10`,
          color: gameState.lastAction?.correct ? T.green : T.red,
          flexShrink: 0,
          fontFamily: T.fontDisplay,
          fontWeight: 600
        }}>
          {gameState.message}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Scoreboard */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <div style={{
            background: `${T.chalk}04`,
            borderRadius: 12,
            padding: "10px 18px",
            textAlign: "center",
            flex: 1,
            border: gameState.isMyTurn ? `1px solid ${T.neon}30` : `1px solid ${T.line}`
          }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 10, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>You</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.chalk, marginTop: 2 }}>{gameState.myScore}</div>
          </div>
          {gameState.opponents.map((opp) => (
            <div key={opp.id} style={{
              background: `${T.chalk}04`,
              borderRadius: 12,
              padding: "10px 18px",
              textAlign: "center",
              flex: 1,
              border: !isMyTurn ? `1px solid ${T.neon}30` : `1px solid ${T.line}`
            }}>
              <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>{opp.name}</div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.chalk, marginTop: 2 }}>{gameState.scores[opp.id] ?? 0}</div>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gap: 2,
            width: "100%",
            maxWidth: 320,
            aspectRatio: "1",
            borderRadius: 8,
            overflow: "hidden"
          }}>
            {Array.from({ length: gridSize }, (_, r) =>
              Array.from({ length: gridSize }, (_, c) => {
                const answer = grid[r]?.[c] ?? "";
                const revealed = gameState.revealedGrid[r]?.[c];
                const hasLetter = answer !== "";

                return (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      aspectRatio: "1",
                      background: hasLetter ? T.charcoal : T.surface,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "min(4.5vw, 20px)",
                      fontWeight: 700,
                      color: revealed ? T.neon : "transparent",
                      borderRadius: 4,
                      position: "relative",
                      border: hasLetter ? `1px solid ${T.lineStrong}` : "none"
                    }}
                  >
                    {revealed || (showAll ? answer : "")}
                    {/* Show clue number for start of words */}
                    {hasLetter && gameState.clues.some((cl) => {
                      if (cl.row !== r || cl.col !== c) return false;
                      if (cl.direction === "across" && c > 0) return false;
                      if (cl.direction === "down" && r > 0) return false;
                      return true;
                    }) && (
                      <span style={{
                        position: "absolute",
                        top: 1,
                        left: 3,
                        fontSize: "min(2.5vw, 9px)",
                        color: T.chalkMuted,
                        fontWeight: 600
                      }}>
                        {gameState.clues.find((cl) => cl.row === r && cl.col === c)?.number}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Clues */}
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            Clues
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gameState.clues.map((clue) => (
              <button
                key={clue.number}
                onClick={() => !clue.solved && handleClueClick(clue.number)}
                disabled={clue.solved || !isMyTurn || !!gameOver}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  background: clue.solved
                    ? `${T.neon}08`
                    : selectedClue === clue.number
                      ? `${T.neon}15`
                      : `${T.chalk}04`,
                  border: selectedClue === clue.number
                    ? `1px solid ${T.neon}40`
                    : `1px solid ${T.line}`,
                  borderRadius: 10,
                  cursor: clue.solved || !isMyTurn || gameOver ? "default" : "pointer",
                  textAlign: "left",
                  width: "100%",
                  color: clue.solved ? T.neon : T.chalk,
                  fontSize: 13,
                  opacity: clue.solved ? 0.7 : 1,
                  transition: "all 0.15s ease"
                }}
              >
                <span style={{
                  minWidth: 26,
                  height: 26,
                  borderRadius: 7,
                  background: clue.solved ? `${T.neon}15` : `${T.chalk}08`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: clue.solved ? T.neon : T.chalkMuted,
                  flexShrink: 0
                }}>
                  {clue.number}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                    {clue.direction}
                  </div>
                  <div>{clue.clue}</div>
                </div>
                {clue.solved && (
                  <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.neon, flexShrink: 0 }}>
                    {clue.guessedWord}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Guess input */}
        {isMyTurn && !gameOver && selectedClue !== null && (
          <div style={{
            background: `${T.charcoal}`,
            borderRadius: 12,
            padding: 16,
            border: `1px solid ${T.neon}25`
          }}>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkMuted, marginBottom: 10, letterSpacing: "0.03em" }}>
              {selectedClueData?.direction.toUpperCase()} {selectedClue}: {selectedClueData?.clue}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleGuess()}
                placeholder="Type your answer..."
                autoFocus
                style={{
                  flex: 1,
                  background: T.surface,
                  border: `1px solid ${T.lineStrong}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  color: T.chalk,
                  fontSize: 15,
                  fontFamily: T.fontMono,
                  letterSpacing: 2,
                  outline: "none"
                }}
              />
              <button
                onClick={handleGuess}
                disabled={!guessInput.trim()}
                style={{
                  ...T.btn,
                  ...T.btnPrimary(accent),
                  opacity: guessInput.trim() ? 1 : 0.5
                }}
              >
                Guess
              </button>
            </div>
          </div>
        )}

        {/* Pass button */}
        {isMyTurn && !gameOver && (
          <button
            onClick={handlePass}
            style={{
              ...T.glass(),
              borderRadius: 12,
              padding: "12px 16px",
              color: T.chalkDim,
              fontSize: 13,
              cursor: "pointer",
              width: "100%",
              fontFamily: T.fontDisplay,
              fontWeight: 600
            }}
          >
            Skip turn
          </button>
        )}

        {/* Game over */}
        {gameOver && (
          <div style={{
            textAlign: "center",
            padding: 24,
            background: `${T.chalk}04`,
            borderRadius: 14,
            border: `1px solid ${T.line}`
          }}>
            <div style={{
              fontFamily: T.fontDisplay,
              fontSize: 28,
              fontWeight: 800,
              color: gameOver.winnerId === youId ? T.green : T.red,
              marginBottom: 12
            }}>
              {gameOver.winnerId === youId ? "You Win!" : gameState.result ?? "Game Over"}
            </div>
            <button onClick={onLeave} style={{ ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        )}

        {/* Reveal toggle (for debugging or post-game) */}
        {gameOver && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              ...T.glass(),
              borderRadius: 10,
              padding: "10px 16px",
              color: T.chalkDim,
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            {showAll ? "Hide answers" : "Reveal all answers"}
          </button>
        )}
      </div>
    </div>
  );
}

function FlyingCardAnim({ card, fromX, fromY, toX, toY, fromRotation, toRotation, onComplete }: {
  card: Crazy8Card;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  fromRotation: number;
  toRotation: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<"start" | "fly" | "end">("start");

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase("fly")));
    const t = setTimeout(() => setPhase("end"), 450);
    const t2 = setTimeout(onComplete, 550);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [onComplete]);

  const dx = toX - fromX;
  const dy = toY - fromY;
  const midY = Math.min(fromY, toY) - 60;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: fromX - 28,
          top: phase === "start" ? fromY - 40 : phase === "fly" ? midY : toY - 40,
          transform: `translate(${phase === "fly" ? dx : 0}px, ${phase === "end" ? dy - (midY - fromY) : 0}px) rotate(${phase === "start" ? fromRotation : toRotation}deg) scale(${phase === "end" ? 0.8 : 1})`,
          opacity: phase === "end" ? 0 : 1,
          transition: phase === "fly" ? "all 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)" : "opacity 0.1s ease",
        }}
      >
        {card.suit === "spades" && card.rank === "?" ? (
          <CardBack size={56} />
        ) : (
          <CardFace card={card} size={56} />
        )}
      </div>
    </div>
  );
}
