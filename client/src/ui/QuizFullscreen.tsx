import { useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

export interface QuizView {
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

export function QuizFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: {
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
