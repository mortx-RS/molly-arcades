import type { Player, RoundScore, GameSession } from "../shared/types";

export class ScoreManager {
  static updateCumulativeScores(
    players: Player[],
    roundScores: RoundScore[]
  ): Player[] {
    return players.map((player) => {
      const roundScore = roundScores.find((r) => r.playerId === player.id);
      return {
        ...player,
        cumulativeScore: player.cumulativeScore + (roundScore?.score ?? 0),
      };
    });
  }

  static createGameSession(
    gameId: string,
    maxRounds: number
  ): GameSession {
    return {
      gameId,
      rounds: [],
      currentRound: 1,
      maxRounds,
      status: "playing",
      startedAt: Date.now(),
    };
  }

  static recordRound(
    session: GameSession,
    roundScores: RoundScore[]
  ): GameSession {
    const updatedRounds = [...session.rounds, roundScores];
    const nextRound = session.currentRound + 1;
    const isFinished = nextRound > session.maxRounds;

    return {
      ...session,
      rounds: updatedRounds,
      currentRound: isFinished ? session.currentRound : nextRound,
      status: isFinished ? "finished" : "playing",
      finishedAt: isFinished ? Date.now() : undefined,
    };
  }

  static shouldContinue(session: GameSession): boolean {
    return session.currentRound <= session.maxRounds;
  }

  static getStandings(players: Player[]): Player[] {
    return [...players].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  }

  static getRoundWinner(
    players: Player[],
    roundScores: RoundScore[]
  ): { playerId: string; score: number } | null {
    if (roundScores.length === 0) return null;
    const sorted = [...roundScores].sort((a, b) => b.score - a.score);
    return sorted[0] ?? null;
  }

  static getGameWinner(
    players: Player[]
  ): { playerId: string; score: number } | null {
    const standings = this.getStandings(players);
    const top = standings[0];
    if (!top) return null;
    return { playerId: top.id, score: top.cumulativeScore };
  }

  static resetScores(players: Player[]): Player[] {
    return players.map((p) => ({ ...p, cumulativeScore: 0 }));
  }

  static getMaxRounds(gameId: string): number {
    const defaults: Record<string, number> = {
      chess: 1,
      crazy8: 5,
      pool: 1,
      crossword: 3,
    };
    return defaults[gameId] ?? 5;
  }
}
