import { useState, useEffect } from "react";
import type { GameCatalogEntry, Room, RoundScore, Player, GameSession } from "../../../shared/types";
import type { NetStatus } from "../net/useRoom";
import type { Profile } from "../net/profile";
import { copyText } from "./clipboard";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";
import { ChessFullscreen } from "./ChessFullscreen";
import type { ChessView } from "./ChessFullscreen";
import { Crazy8Fullscreen } from "./Crazy8Fullscreen";
import type { Crazy8View } from "./Crazy8Fullscreen";
import { TicTacToeFullscreen } from "./TicTacToeFullscreen";
import type { TicTacToeView } from "./TicTacToeFullscreen";
import { Connect4Fullscreen } from "./Connect4Fullscreen";
import type { Connect4View } from "./Connect4Fullscreen";
import { SnakeLadderFullscreen } from "./SnakeLadderFullscreen";
import type { SnakeLadderView } from "./SnakeLadderFullscreen";
import { CheckersFullscreen } from "./CheckersFullscreen";
import type { CheckersView } from "./CheckersFullscreen";
import { LudoFullscreen } from "./LudoFullscreen";
import type { LudoView } from "./LudoFullscreen";
import { WhotFullscreen } from "./WhotFullscreen";
import type { WhotView } from "./WhotFullscreen";
import { AyoFullscreen } from "./AyoFullscreen";
import type { AyoView } from "./AyoFullscreen";

interface Props {
  room: Room | null;
  youId: string | null;
  gameState: unknown;
  gameOver: { winnerId?: string } | null;
  roundComplete: { roundNumber: number; scores: RoundScore[]; cumulative: Player[] } | null;
  sessionOver: { session: GameSession; scoreboard: Player[] } | null;
  status: NetStatus;
  games: GameCatalogEntry[];
  profile: Profile;
  onLeave(): void;
  onSelectGame(gameId: string): void;
  onStartGame(): void;
  onSubmitAction(action: unknown): void;
  onFinishRound(scores: RoundScore[]): void;
  onRematch(): void;
  onNewGame(gameId: string): void;
  onClearRoundComplete(): void;
  onClearSessionOver(): void;
}

export function RoomScreen({
  room,
  youId,
  gameState,
  gameOver,
  roundComplete,
  sessionOver,
  status,
  games,
  profile,
  onLeave,
  onSelectGame,
  onStartGame,
  onSubmitAction,
  onFinishRound,
  onRematch,
  onNewGame,
  onClearRoundComplete,
  onClearSessionOver,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedNewGame, setSelectedNewGame] = useState<string | null>(null);
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [dismissedGameOver, setDismissedGameOver] = useState(false);
  const accent = profile.color;

  useEffect(() => {
    if (room?.status === "lobby" || room?.status === "in-progress") {
      setDismissedGameOver(false);
    }
  }, [room?.status]);

  const game = games.find((g) => g.id === (room?.gameType ?? ""));
  const isInProgress = room?.status === "in-progress" && gameState;
  const showGameOver = gameOver && !roundComplete && !sessionOver && !dismissedGameOver;

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

  if (isInProgress && room?.gameType === "tic_tac_toe" && youId) {
    return (
      <TicTacToeFullscreen
        gameState={gameState as TicTacToeView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Tic Tac Toe"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "connect4" && youId) {
    return (
      <Connect4Fullscreen
        gameState={gameState as Connect4View}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Connect 4"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "snake_ladder" && youId) {
    return (
      <SnakeLadderFullscreen
        gameState={gameState as SnakeLadderView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Snake & Ladder"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "checkers" && youId) {
    return (
      <CheckersFullscreen
        gameState={gameState as CheckersView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Checkers"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "ludo" && youId) {
    return (
      <LudoFullscreen
        gameState={gameState as LudoView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Ludo"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "whot" && youId) {
    return (
      <WhotFullscreen
        gameState={gameState as WhotView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Whot"}
        accent={accent}
        onLeave={onLeave}
        onSubmitAction={onSubmitAction}
      />
    );
  }

  if (isInProgress && room?.gameType === "ayo" && youId) {
    return (
      <AyoFullscreen
        gameState={gameState as AyoView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Ayo"}
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

      {room && (room.status === "lobby" || (gameOver && dismissedGameOver)) && (
        <section className="card animate-in animate-in-delay-3" style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 4px", fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, letterSpacing: "0.01em" }}>
                {game && !showGamePicker ? game.name : "Choose a Game"}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: T.chalkDim, lineHeight: 1.5 }}>
                {game && !showGamePicker ? game.tagline : "Select a game to play with friends."}
              </p>
            </div>
            {game && !showGamePicker && (
              <div style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 14, background: `${accent}12`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {game.icon ?? "\uD83C\uDFAE"}
              </div>
            )}
          </div>

          {!game || showGamePicker ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
              {games.map((g) => {
                const icon = g.icon ?? "\uD83C\uDFAE";
                const selected = g.id === room.gameType;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (room.hostId === youId) {
                        onSelectGame(g.id);
                        setShowGamePicker(false);
                      }
                    }}
                    disabled={room.hostId !== youId}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 8,
                      padding: "16px 12px",
                      background: selected ? `${accent}10` : T.charcoal,
                      border: `1.5px solid ${selected ? `${accent}40` : T.line}`,
                      borderRadius: 14,
                      cursor: room.hostId === youId ? "pointer" : "default",
                      textAlign: "center",
                      transition: "all 0.2s ease",
                      opacity: room.hostId === youId ? 1 : 0.6,
                    }}
                  >
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: selected ? `${accent}15` : `${T.chalk}06`,
                      border: `1px solid ${selected ? `${accent}30` : T.line}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                    }}>
                      {icon}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: T.fontDisplay,
                        fontSize: 13,
                        fontWeight: 600,
                        color: selected ? accent : T.chalk,
                        marginBottom: 2,
                      }}>{g.name}</div>
                      <div style={{ fontSize: 10, color: T.chalkMuted }}>
                        {g.minPlayers}-{g.maxPlayers}p · ~{g.estimatedMinutes}m
                      </div>
                    </div>
                    {selected && (
                      <div style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: accent,
                      }} />
                    )}
                  </button>
                );
              })}
              {room.hostId !== youId && !game && (
                <div style={{ gridColumn: "1 / -1", padding: "12px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  Waiting for host to choose a game...
                </div>
              )}
              {room.hostId !== youId && game && (
                <div style={{ gridColumn: "1 / -1", padding: "12px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 12, fontWeight: 600, textAlign: "center" }}>
                  Host is changing the game...
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <span className="badge" style={{ background: `${accent}12`, color: accent, borderColor: `${accent}25` }}>
                  {game.minPlayers}\u2013{game.maxPlayers} players
                </span>
                <span className="badge" style={{ background: `${T.chalk}06`, color: T.chalkDim, borderColor: T.line }}>
                  ~{game.estimatedMinutes} min
                </span>
              </div>

              {room.hostId === youId && (
                <button
                  onClick={() => setShowGamePicker(true)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    padding: "8px 12px",
                    background: "transparent",
                    border: `1px dashed ${T.chalkMuted}40`,
                    borderRadius: 8,
                    cursor: "pointer",
                    color: T.chalkMuted,
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 16,
                    width: "100%",
                    transition: "all 0.2s ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Change game
                </button>
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
                  <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: T.yellowDim, border: `1px solid rgba(221, 200, 48, 0.2)`, borderRadius: 12, color: T.yellow, fontSize: 13, fontWeight: 600 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    Need {game?.minPlayers ?? 2} players to start ({room.players.length}/{game?.minPlayers ?? 2})
                  </div>
                ) : (
                  <div style={{ flex: 1, minWidth: 200, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 13, fontWeight: 600 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25"></circle>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1"></path>
                    </svg>
                    Waiting for host to start\u2026
                  </div>
                )}
              </div>
            </>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 11, fontFamily: T.fontMono, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            <span>Room: {room?.id ?? "\u2014"}</span>
            <span>{room?.players.length ?? 0} / {game?.maxPlayers ?? "?"}</span>
          </div>
        </section>
      )}

      {showGameOver && (
        <section className="card animate-in" style={{ textAlign: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: gameOver.winnerId === youId ? `radial-gradient(ellipse at center, ${T.greenDim} 0%, transparent 70%)` : `radial-gradient(ellipse at center, ${T.pinkDim} 0%, transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 56, marginBottom: 8, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))" }}>
              {gameOver.winnerId === youId ? "\uD83C\uDFC6" : "\uD83D\uDCA5"}
            </div>
            <h2 style={{ margin: "0 0 4px", fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 800, color: gameOver.winnerId === youId ? T.green : T.red, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {gameOver.winnerId === youId ? "Victory!" : "Defeat"}
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: T.chalkDim }}>
              {gameOver.winnerId === youId ? "Well played!" : "Better luck next time!"}
            </p>
            {room?.hostId === youId ? (
              <button className="btn primary" onClick={() => setDismissedGameOver(true)} style={{ padding: "16px 32px", fontSize: 15, fontWeight: 700 }}>
                Continue
              </button>
            ) : (
              <div style={{ padding: "14px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 13, fontWeight: 600 }}>
                Waiting for host to continue...
              </div>
            )}
          </div>
        </section>
      )}

      {roundComplete && (
        <BottomDrawer open={true} onClose={onClearRoundComplete} title={`Round ${roundComplete.roundNumber} Complete`}>
          <div style={{ padding: "0 4px" }}>
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Round Scores
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {roundComplete.scores.map((score, idx) => {
                  const player = room?.players.find((p) => p.id === score.playerId);
                  const medal = idx === 0 ? "\uD83E\uDD47" : idx === 1 ? "\uD83E\uDD48" : idx === 2 ? "\uD83E\uDD49" : "";
                  return (
                    <div key={score.playerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: idx === 0 ? `${accent}10` : T.bg, borderRadius: 12, border: idx === 0 ? `1px solid ${accent}25` : `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.chalkMuted, width: 20 }}>{medal || `${idx + 1}.`}</span>
                        <span style={{ fontWeight: 600, color: T.chalk }}>{player?.name ?? "Unknown"}</span>
                      </div>
                      <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: idx === 0 ? accent : T.chalk, fontSize: 16 }}>+{score.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Overall Standings
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {roundComplete.cumulative
                  .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                  .map((player, idx) => {
                    const medal = idx === 0 ? "\uD83E\uDD47" : idx === 1 ? "\uD83E\uDD48" : idx === 2 ? "\uD83E\uDD49" : "";
                    return (
                      <div key={player.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: idx === 0 ? `${T.gold}10` : T.charcoal, borderRadius: 12, border: idx === 0 ? `1px solid ${T.gold}25` : `1px solid ${T.line}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: 14, width: 24 }}>{medal || `${idx + 1}.`}</span>
                          <span style={{ fontWeight: 600, color: T.chalk }}>{player.name}</span>
                          {player.id === youId && <span style={{ fontSize: 10, color: accent, background: `${accent}15`, padding: "2px 6px", borderRadius: 6 }}>YOU</span>}
                        </div>
                        <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: T.chalk, fontSize: 18 }}>{player.cumulativeScore}</span>
                      </div>
                    );
                  })}
              </div>
            </div>

            {room?.hostId === youId ? (
              <button className="btn primary" onClick={onClearRoundComplete} style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 700 }}>
                Continue to Next Round
              </button>
            ) : (
              <div style={{ padding: "14px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                Waiting for host to continue...
              </div>
            )}
          </div>
        </BottomDrawer>
      )}

      {sessionOver && (
        <BottomDrawer open={true} onClose={onClearSessionOver} title="Game Complete">
          <div style={{ padding: "0 4px" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 56, marginBottom: 8, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.3))" }}>
                {sessionOver.scoreboard[0]?.id === youId ? "\uD83C\uDFC6" : "\uD83C\uDFC5"}
              </div>
              <h2 style={{ margin: "0 0 4px", fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.chalk }}>
                {sessionOver.scoreboard[0]?.id === youId ? "Champion!" : "Great Game!"}
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: T.chalkDim }}>
                {sessionOver.session.maxRounds} rounds completed
              </p>
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ margin: "0 0 12px", fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, color: T.chalkMuted, textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>
                Final Standings
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sessionOver.scoreboard.map((player, idx) => {
                  const medal = idx === 0 ? "\uD83E\uDD47" : idx === 1 ? "\uD83E\uDD48" : idx === 2 ? "\uD83E\uDD49" : "";
                  return (
                    <div key={player.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: idx === 0 ? `linear-gradient(135deg, ${T.gold}15 0%, ${T.gold}05 100%)` : T.charcoal, borderRadius: 12, border: idx === 0 ? `1.5px solid ${T.gold}30` : `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontFamily: T.fontMono, fontSize: 16, width: 28, textAlign: "center" }}>{medal || `${idx + 1}.`}</span>
                        <span style={{ fontWeight: 700, color: T.chalk, fontSize: 16 }}>{player.name}</span>
                        {player.id === youId && <span style={{ fontSize: 10, color: accent, background: `${accent}15`, padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>YOU</span>}
                      </div>
                      <span style={{ fontFamily: T.fontMono, fontWeight: 800, color: idx === 0 ? T.gold : T.chalk, fontSize: 20 }}>{player.cumulativeScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {room?.hostId === youId && (
                <button className="btn primary" onClick={onRematch} style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 700 }}>
                  Play Again
                </button>
              )}
              {room?.hostId === youId && (
                <div style={{ position: "relative" }}>
                  <button
                    className="btn secondary"
                    onClick={() => setSelectedNewGame(selectedNewGame ? null : "new")}
                    style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 600 }}
                  >
                    Choose Another Game
                  </button>
                  {selectedNewGame && (
                    <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 8, background: T.charcoal, border: `1px solid ${T.line}`, borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 4, zIndex: 10 }}>
                      {games.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            onNewGame(g.id);
                            setSelectedNewGame(null);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "12px",
                            background: "transparent",
                            border: "none",
                            borderRadius: 8,
                            cursor: "pointer",
                            textAlign: "left",
                            color: T.chalk,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>{g.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{g.name}</div>
                            <div style={{ fontSize: 11, color: T.chalkMuted }}>{g.minPlayers}-{g.maxPlayers} players</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {room?.hostId !== youId && (
                <div style={{ padding: "14px", background: T.neonDim, border: `1px solid ${T.lineAccent}`, borderRadius: 12, color: T.neon, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                  Waiting for host to choose next game...
                </div>
              )}
              <button className="btn secondary" onClick={onLeave} style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 600 }}>
                Leave Room
              </button>
            </div>
          </div>
        </BottomDrawer>
      )}

      <button
        className="btn secondary animate-in animate-in-delay-3"
        onClick={onLeave}
        style={{
          padding: "14px 28px",
          fontSize: 14,
          fontWeight: 600,
          borderColor: T.lineStrong,
          background: T.surface,
          margin: "0 16px 16px"
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
