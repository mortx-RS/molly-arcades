import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface CrosswordView {
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

export function CrosswordFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
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
  const grid = gameState.grid;
  const gridSize = grid.length;

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
