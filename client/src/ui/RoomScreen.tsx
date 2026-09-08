import { useState, useEffect } from "react";
import type { GameCatalogEntry, Room, RoundScore, Player, GameSession } from "../../../shared/types";
import type { NetStatus } from "../net/useRoom";
import type { Profile } from "../net/profile";
import { copyText } from "./clipboard";
import { D, alpha } from "./design";
import {
  ShellStyles,
  Button,
  IconButton,
  Card,
  Avatar,
  Pill,
  Icon,
  Sheet,
  Spinner,
} from "./components";
import { ChessFullscreen } from "./ChessFullscreen";
import type { ChessView } from "./ChessFullscreen";
import { Crazy8Fullscreen } from "./Crazy8Fullscreen";
import type { Crazy8View } from "./Crazy8Fullscreen";
import { FlappyBirdFullscreen } from "./FlappyBirdFullscreen";
import type { FlappyBirdView } from "./FlappyBirdFullscreen";
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

const GOLD = "#dda01a";

/** Per-game accent used for the icon tile + selected state in the game list. */
const GAME_TINT: Record<string, string> = {
  chess: "#6366f1",
  checkers: "#ef4444",
  ludo: "#f59e0b",
  snake_ladder: "#10b981",
  connect4: "#3b82f6",
  flappy_bird: "#eab308",
  crazy8: "#8b5cf6",
  whot: "#ec4899",
  ayo: "#14b8a6",
  tic_tac_toe: "#0ea5e9",
  pool: "#22c55e",
};

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
  onSubmitInput(input: unknown): void;
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
  onSubmitInput,
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
  const isHost = room?.hostId === youId;

  /* ─── Fullscreen game delegation (legacy screens, revamp pending) ─── */

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

  if (isInProgress && room?.gameType === "flappy_bird" && youId) {
    return (
      <FlappyBirdFullscreen
        gameState={gameState as FlappyBirdView}
        youId={youId}
        gameOver={gameOver}
        room={room}
        gameName={game?.name ?? "Flappy Bird"}
        accent={accent}
        onLeave={onLeave}
        onSubmitInput={onSubmitInput}
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

  /* ─────────────────────────  Lobby  ───────────────────────── */

  const showLobbyPanel = !!(room && (room.status === "lobby" || (gameOver && dismissedGameOver)));
  const showActionBar = !!(showLobbyPanel && game && !showGamePicker && !showGameOver && !roundComplete && !sessionOver);
  const playersReady = !!(room && game && room.players.length >= (game.minPlayers ?? 2));

  const statusLabel =
    status === "connected" ? "Live"
    : status === "reconnecting" ? "Reconnecting…"
    : status === "connecting" ? "Connecting…"
    : "Offline";

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: D.canvas,
        color: D.ink,
        fontFamily: D.fontBody,
      }}
    >
      <ShellStyles />

      {/* Top bar */}
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: alpha("#ffffff", 0.85),
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${D.line}`,
        }}
      >
        <IconButton ariaLabel="Leave room" onClick={onLeave} size={42}>
          <Icon name="back" size={20} />
        </IconButton>
        <h1
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontFamily: D.fontDisplay,
            fontSize: 18,
            fontWeight: 750,
            letterSpacing: "-0.01em",
            color: D.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {game && !showGamePicker ? game.name : "Game lobby"}
        </h1>
        <Pill tone={status === "connected" ? "success" : status === "offline" ? "danger" : "warn"} mono>
          {status === "connected" && (
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: D.success, display: "inline-block" }} />
          )}
          {statusLabel}
        </Pill>
      </header>

      {/* Scroll body */}
      <div className="ma2-scroll" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {status === "reconnecting" && (
          <div
            className="ma2-in"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "12px 14px",
              borderRadius: D.rMd,
              background: D.warnSoft,
              border: `1px solid ${alpha(D.warn, 0.22)}`,
              color: D.warn,
              fontSize: 13,
              fontWeight: 550,
            }}
          >
            <Icon name="loader" size={16} className="ma2-spin" />
            Connection dropped — restoring your seat…
          </div>
        )}

        {/* Invite hero */}
        <Card className="ma2-in ma2-d1" style={{ textAlign: "center" }} padding={22}>
          <div
            style={{
              fontSize: 10.5,
              color: D.inkFaint,
              fontFamily: D.fontMono,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              marginBottom: 10,
            }}
          >
            Room code
          </div>
          <button
            onClick={() => copy("code")}
            className="ma2-press"
            aria-label="Copy room code"
            style={{
              background: "none",
              border: "none",
              cursor: room ? "pointer" : "default",
              padding: 0,
              width: "100%",
              fontFamily: D.fontMono,
              fontSize: 38,
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: room ? D.ink : D.inkFaint,
              lineHeight: 1,
            }}
          >
            {room ? room.id : "······"}
          </button>
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <Button
              block={false}
              variant="secondary"
              onClick={() => copy("code")}
              leftIcon={<Icon name={copied === "code" ? "check" : "copy"} size={16} strokeWidth={copied === "code" ? 2.5 : 2} />}
              style={{ flex: 1, color: copied === "code" ? D.success : D.ink, borderColor: copied === "code" ? alpha(D.success, 0.4) : D.lineStrong }}
            >
              {copied === "code" ? "Copied!" : "Copy code"}
            </Button>
            <Button
              block={false}
              variant="secondary"
              onClick={() => copy("link")}
              leftIcon={<Icon name={copied === "link" ? "check" : "link"} size={16} strokeWidth={copied === "link" ? 2.5 : 2} />}
              style={{ flex: 1, color: copied === "link" ? D.success : D.ink, borderColor: copied === "link" ? alpha(D.success, 0.4) : D.lineStrong }}
            >
              {copied === "link" ? "Copied!" : "Share link"}
            </Button>
          </div>
        </Card>

        {/* Players */}
        <Card className="ma2-in ma2-d2">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: D.ink, fontFamily: D.fontDisplay, letterSpacing: "-0.01em" }}>
              Players
            </span>
            <Pill tone="neutral" mono>
              {room?.players.length ?? 0} / {game?.maxPlayers ?? "?"}
            </Pill>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {(room?.players ?? []).map((p, idx) => (
              <div
                key={p.id}
                className="ma2-in"
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 60, animationDelay: `${0.05 * (idx + 1)}s` }}
              >
                <Avatar
                  content={p.name.slice(0, 1).toUpperCase()}
                  size={50}
                  dim={!p.connected}
                  bg={p.connected ? alpha(accent, 0.14) : D.surfaceAlt}
                  color={p.connected ? accent : D.inkFaint}
                  ring={p.isHost ? GOLD : p.id === youId ? accent : undefined}
                  badge={
                    p.isHost ? (
                      <span style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%", background: GOLD, border: `2px solid ${D.surface}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                        <Icon name="crown" size={10} fill="#fff" strokeWidth={0} />
                      </span>
                    ) : !p.connected ? (
                      <span style={{ position: "absolute", bottom: -3, right: -3, width: 18, height: 18, borderRadius: "50%", background: D.danger, border: `2px solid ${D.surface}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                        <Icon name="close" size={10} strokeWidth={3} />
                      </span>
                    ) : null
                  }
                />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: p.id === youId ? accent : D.inkSoft, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.id === youId ? "You" : p.name}
                </span>
              </div>
            ))}

            {/* Empty seats */}
            {room && game
              ? Array.from({ length: Math.max(0, (game.maxPlayers ?? 0) - room.players.length) }).slice(0, 6).map((_, i) => (
                  <div key={`empty-${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 60 }}>
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: D.rMd,
                        border: `1.5px dashed ${D.lineHeavy}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: D.inkFaint,
                      }}
                    >
                      <Icon name="plus" size={16} strokeWidth={2} />
                    </div>
                    <span style={{ fontSize: 11, color: D.inkFaint }}>Open</span>
                  </div>
                ))
              : null}

            {(!room || room.players.length === 0) && (
              <span style={{ color: D.inkFaint, fontSize: 13 }}>Waiting for players…</span>
            )}
          </div>

          {room && room.players.length <= 1 && (
            <div style={{ marginTop: 14, fontSize: 12.5, color: D.inkSoft, textAlign: "center" }}>
              Share the code above to invite friends.
            </div>
          )}
        </Card>

        {/* Game picker / selected */}
        {showLobbyPanel && (
          <Card className="ma2-in ma2-d2">
            {!game || showGamePicker ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
                  <h2 style={{ margin: 0, fontFamily: D.fontDisplay, fontSize: 17, fontWeight: 750, letterSpacing: "-0.01em", color: D.ink }}>
                    Choose a game
                  </h2>
                  {game && showGamePicker ? (
                    <button
                      onClick={() => setShowGamePicker(false)}
                      className="ma2-press"
                      style={{ background: "transparent", border: `1px solid ${D.lineStrong}`, borderRadius: D.rPill, padding: "6px 14px", color: D.inkSoft, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  ) : (
                    <span style={{ fontSize: 12, color: D.inkFaint, fontFamily: D.fontMono }}>{games.length} games</span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {games.map((g, idx) => {
                    const isReadOnly = !isHost;
                    const icon = g.icon ?? "\uD83C\uDFAE";
                    const selected = g.id === room?.gameType;
                    const tint = GAME_TINT[g.id] ?? D.brand;
                    return (
                      <button
                        key={g.id}
                        className="ma2-press ma2-in"
                        onClick={() => {
                          if (isHost) {
                            onSelectGame(g.id);
                            setShowGamePicker(false);
                          }
                        }}
                        disabled={isReadOnly}
                        aria-disabled={isReadOnly}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 13,
                          padding: "11px 13px",
                          background: selected ? alpha(tint, 0.08) : D.surface,
                          border: `1.5px solid ${selected ? alpha(tint, 0.45) : D.line}`,
                          borderRadius: D.rMd,
                          cursor: isHost ? "pointer" : "default",
                          textAlign: "left",
                          opacity: isHost ? 1 : 0.72,
                          animationDelay: `${0.03 * idx}s`,
                        }}
                      >
                        {/* Icon tile */}
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: D.rMd,
                            background: alpha(tint, 0.14),
                            border: `1px solid ${alpha(tint, 0.26)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 25,
                            flexShrink: 0,
                          }}
                        >
                          {icon}
                        </div>

                        {/* Text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: D.fontDisplay, fontSize: 15.5, fontWeight: 700, color: D.ink, letterSpacing: "-0.01em" }}>
                            {g.name}
                          </div>
                          <div style={{ fontSize: 12.5, color: D.inkSoft, lineHeight: 1.35, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {g.tagline}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6, color: D.inkFaint, fontFamily: D.fontMono, fontSize: 11 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon name="users" size={11} /> {g.minPlayers === g.maxPlayers ? g.minPlayers : `${g.minPlayers}–${g.maxPlayers}`}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <Icon name="clock" size={11} /> ~{g.estimatedMinutes}m
                            </span>
                          </div>
                        </div>

                        {/* Select indicator */}
                        {isHost ? (
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              flexShrink: 0,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: selected ? tint : "transparent",
                              border: selected ? "none" : `2px solid ${D.lineHeavy}`,
                              color: "#fff",
                            }}
                          >
                            {selected && <Icon name="check" size={14} strokeWidth={3} />}
                          </span>
                        ) : selected ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: tint,
                              fontFamily: D.fontMono,
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            Picked
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {!isHost && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: 12, background: D.surface, border: `1px solid ${D.line}`, borderRadius: D.rMd, color: D.inkFaint, fontSize: 13 }}>
                    <Icon name="info" size={18} />
                    <span style={{ flex: 1 }}>Only the host can pick a game.</span>
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <h2 style={{ margin: 0, fontFamily: D.fontDisplay, fontSize: 19, fontWeight: 750, letterSpacing: "-0.01em", color: D.ink }}>
                      {game.name}
                    </h2>
                    {isHost && (
                      <button
                        onClick={() => setShowGamePicker(true)}
                        className="ma2-press"
                        style={{ background: "transparent", border: `1px dashed ${D.lineHeavy}`, borderRadius: D.rPill, padding: "3px 11px", color: D.inkSoft, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, color: D.inkSoft, lineHeight: 1.5 }}>
                    {game.tagline}
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Pill tone="accent" accent={accent}>
                      {game.minPlayers}–{game.maxPlayers} players
                    </Pill>
                    <Pill tone="neutral">~{game.estimatedMinutes} min</Pill>
                    {!playersReady && <Pill tone="warn">Need {game.minPlayers ?? 2} to start</Pill>}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    width: 58,
                    height: 58,
                    borderRadius: D.rLg,
                    background: alpha(GAME_TINT[game.id] ?? D.brand, 0.14),
                    border: `1px solid ${alpha(GAME_TINT[game.id] ?? D.brand, 0.26)}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 27,
                  }}
                >
                  {game.icon ?? "\uD83C\uDFAE"}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Game over */}
        {showGameOver && (
          <Card className="ma2-in" style={{ textAlign: "center", overflow: "hidden" }}>
            <div style={{ fontSize: 52, marginBottom: 6 }}>
              {gameOver.winnerId === youId ? "\uD83C\uDFC6" : "\uD83D\uDC4F"}
            </div>
            <h2 style={{ margin: "0 0 4px", fontFamily: D.fontDisplay, fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", color: gameOver.winnerId === youId ? D.success : D.ink }}>
              {gameOver.winnerId === youId ? "You won!" : "Good game"}
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: D.inkSoft }}>
              {gameOver.winnerId === youId ? "Nicely played." : "Better luck next round!"}
            </p>
            {isHost ? (
              <Button size="lg" onClick={() => setDismissedGameOver(true)}>
                Continue
              </Button>
            ) : (
              <div style={{ padding: 14, background: D.brandSoft, border: `1px solid ${alpha(D.brand, 0.2)}`, borderRadius: D.rMd, color: D.brand, fontSize: 13, fontWeight: 600 }}>
                Waiting for host to continue…
              </div>
            )}
          </Card>
        )}

        {/* Leave */}
        <button
          onClick={onLeave}
          className="ma2-press"
          style={{ alignSelf: "center", background: "transparent", border: "none", color: D.inkFaint, fontSize: 13, fontWeight: 550, cursor: "pointer", padding: "6px 16px", marginTop: 2 }}
        >
          Leave room
        </button>
      </div>

      {/* Sticky action bar */}
      {showActionBar && game && room && (
        <div
          style={{
            flexShrink: 0,
            background: alpha("#ffffff", 0.9),
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop: `1px solid ${D.line}`,
            padding: "14px 16px calc(14px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {playersReady && isHost ? (
            <Button
              size="lg"
              onClick={onStartGame}
              leftIcon={<Icon name="play" size={17} fill="currentColor" strokeWidth={0} />}
              rightIcon={
                <span style={{ fontFamily: D.fontMono, fontSize: 12, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: D.rPill }}>
                  {room.players.length} ready
                </span>
              }
            >
              Start game
            </Button>
          ) : !playersReady ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: D.warnSoft, border: `1px solid ${alpha(D.warn, 0.22)}`, borderRadius: D.rMd, color: D.warn, fontSize: 13, fontWeight: 600 }}>
              <Icon name="alert" size={16} />
              Need {game.minPlayers ?? 2} players to start ({room.players.length}/{game.minPlayers ?? 2})
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, background: D.brandSoft, border: `1px solid ${alpha(D.brand, 0.2)}`, borderRadius: D.rMd, color: D.brand, fontSize: 13, fontWeight: 600 }}>
              <Spinner size={15} color={D.brand} />
              Waiting for host to start…
            </div>
          )}
        </div>
      )}

      {/* Round complete */}
      {roundComplete && (
        <Sheet open onClose={onClearRoundComplete} title={`Round ${roundComplete.roundNumber} complete`}>
          <div style={{ marginBottom: 22 }}>
            <SectionLabel>Round scores</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roundComplete.scores.map((score, idx) => {
                const player = room?.players.find((p) => p.id === score.playerId);
                return (
                  <ScoreRow
                    key={score.playerId}
                    rank={idx}
                    name={player?.name ?? "Unknown"}
                    highlight={idx === 0 ? accent : undefined}
                    value={`+${score.score}`}
                    isYou={score.playerId === youId}
                    accent={accent}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 22 }}>
            <SectionLabel>Overall standings</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...roundComplete.cumulative]
                .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                .map((player, idx) => (
                  <ScoreRow
                    key={player.id}
                    rank={idx}
                    name={player.name}
                    highlight={idx === 0 ? GOLD : undefined}
                    value={`${player.cumulativeScore}`}
                    isYou={player.id === youId}
                    accent={accent}
                  />
                ))}
            </div>
          </div>

          {isHost ? (
            <Button onClick={onClearRoundComplete}>Continue to next round</Button>
          ) : (
            <div style={{ padding: 14, background: D.brandSoft, border: `1px solid ${alpha(D.brand, 0.2)}`, borderRadius: D.rMd, color: D.brand, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              Waiting for host to continue…
            </div>
          )}
        </Sheet>
      )}

      {/* Session over */}
      {sessionOver && (
        <Sheet open onClose={onClearSessionOver} title="Game complete">
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <div style={{ fontSize: 54, marginBottom: 6 }}>
              {sessionOver.scoreboard[0]?.id === youId ? "\uD83C\uDFC6" : "\uD83C\uDFC5"}
            </div>
            <h2 style={{ margin: "0 0 4px", fontFamily: D.fontDisplay, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: D.ink }}>
              {sessionOver.scoreboard[0]?.id === youId ? "Champion!" : "Great game!"}
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: D.inkSoft }}>
              {sessionOver.session.maxRounds} rounds completed
            </p>
          </div>

          <div style={{ marginBottom: 22 }}>
            <SectionLabel center>Final standings</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sessionOver.scoreboard.map((player, idx) => (
                <ScoreRow
                  key={player.id}
                  rank={idx}
                  name={player.name}
                  highlight={idx === 0 ? GOLD : undefined}
                  value={`${player.cumulativeScore}`}
                  isYou={player.id === youId}
                  accent={accent}
                  large
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {isHost && <Button onClick={onRematch}>Play again</Button>}
            {isHost && (
              <div style={{ position: "relative" }}>
                <Button variant="secondary" onClick={() => setSelectedNewGame(selectedNewGame ? null : "new")}>
                  Choose another game
                </Button>
                {selectedNewGame && (
                  <div
                    className="ma2-scroll"
                    style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 8, background: D.surface, border: `1px solid ${D.lineStrong}`, borderRadius: D.rMd, boxShadow: D.shadowLg, padding: 8, display: "flex", flexDirection: "column", gap: 2, zIndex: 10, maxHeight: 280, overflowY: "auto" }}
                  >
                    {games.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          onNewGame(g.id);
                          setSelectedNewGame(null);
                        }}
                        className="ma2-press"
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "transparent", border: "none", borderRadius: D.rSm, cursor: "pointer", textAlign: "left", color: D.ink }}
                      >
                        <span style={{ fontSize: 20 }}>{g.icon}</span>
                        <div>
                          <div style={{ fontWeight: 650, fontSize: 14 }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: D.inkFaint }}>{g.minPlayers}-{g.maxPlayers} players</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isHost && (
              <div style={{ padding: 14, background: D.brandSoft, border: `1px solid ${alpha(D.brand, 0.2)}`, borderRadius: D.rMd, color: D.brand, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
                Waiting for host to choose next game…
              </div>
            )}
            <Button variant="ghost" onClick={onLeave}>
              Leave room
            </Button>
          </div>
        </Sheet>
      )}
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

/* ─────────────────────────  Local helpers  ───────────────────────── */

function SectionLabel({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <h3
      style={{
        margin: "0 0 12px",
        fontFamily: D.fontDisplay,
        fontSize: 12,
        fontWeight: 700,
        color: D.inkFaint,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        textAlign: center ? "center" : "left",
      }}
    >
      {children}
    </h3>
  );
}

function ScoreRow({
  rank,
  name,
  value,
  highlight,
  isYou,
  accent,
  large,
}: {
  rank: number;
  name: string;
  value: string;
  highlight?: string;
  isYou?: boolean;
  accent: string;
  large?: boolean;
}) {
  const medal = rank === 0 ? "\uD83E\uDD47" : rank === 1 ? "\uD83E\uDD48" : rank === 2 ? "\uD83E\uDD49" : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: large ? "14px 16px" : "12px 14px",
        background: highlight ? alpha(highlight, 0.1) : D.surfaceAlt,
        borderRadius: D.rMd,
        border: `1px solid ${highlight ? alpha(highlight, 0.28) : D.line}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ fontFamily: D.fontMono, fontSize: large ? 16 : 13, width: 24, textAlign: "center", color: D.inkSoft }}>
          {medal || `${rank + 1}`}
        </span>
        <span style={{ fontWeight: 650, color: D.ink, fontSize: large ? 15 : 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </span>
        {isYou && (
          <span style={{ fontSize: 10, color: accent, background: alpha(accent, 0.14), padding: "2px 7px", borderRadius: D.rPill, fontWeight: 700, flexShrink: 0 }}>
            YOU
          </span>
        )}
      </div>
      <span style={{ fontFamily: D.fontMono, fontWeight: 800, color: highlight ?? D.ink, fontSize: large ? 19 : 16, flexShrink: 0 }}>
        {value}
      </span>
    </div>
  );
}
