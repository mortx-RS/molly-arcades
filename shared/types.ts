export type RoomId = string;

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  cumulativeScore: number;
}

export interface RoundScore {
  playerId: string;
  score: number;
}

export interface GameSession {
  gameId: string;
  rounds: RoundScore[][];
  currentRound: number;
  maxRounds: number;
  status: "waiting" | "playing" | "finished";
  startedAt: number;
  finishedAt?: number;
}

export interface Room {
  id: RoomId;
  gameType: string;
  players: Player[];
  status: "lobby" | "in-progress" | "finished";
  gameState: unknown;
  createdAt: number;
  hostId: string;
  currentGame: GameSession | null;
  gameHistory: GameSession[];
}

export type GameMode = "turn-based" | "realtime";

export interface GameModule<TState = unknown, TAction = never, TInput = never> {
  id: string;
  mode: GameMode;
  minPlayers: number;
  maxPlayers: number;
  createInitialState(players: Player[]): TState;
  reduce?(state: TState, playerId: string, action: TAction): TState;
  tick?(state: TState, dt: number, inputs: Record<string, TInput>): TState;
  checkGameOver(state: TState): { over: boolean; winnerId?: string };
  getViewFor(state: TState, playerId: string): unknown;
}

export interface GameCatalogEntry {
  id: string;
  name: string;
  mode: GameMode;
  minPlayers: number;
  maxPlayers: number;
  tagline: string;
  icon?: string;
  estimatedMinutes?: number;
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: "chess",
    name: "Chess",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Classic strategy — checkmate the king.",
    icon: "♟️",
    estimatedMinutes: 20
  },
  {
    id: "checkers",
    name: "Checkers",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Jump and capture — king your pieces.",
    icon: "🔴",
    estimatedMinutes: 10
  },
  {
    id: "ludo",
    name: "Ludo",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 4,
    tagline: "Roll the dice — race your tokens home.",
    icon: "🎲",
    estimatedMinutes: 15
  },
  {
    id: "snake_ladder",
    name: "Snake & Ladder",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 4,
    tagline: "Climb ladders, slide down snakes.",
    icon: "🐍",
    estimatedMinutes: 10
  },
  {
    id: "connect4",
    name: "Connect 4",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Drop four in a row to win.",
    icon: "🔴",
    estimatedMinutes: 5
  },
  {
    id: "flappy_bird",
    name: "Flappy Bird",
    mode: "realtime",
    minPlayers: 2,
    maxPlayers: 4,
    tagline: "Last bird standing — flap or perish!",
    icon: "🐦",
    estimatedMinutes: 3
  },
  {
    id: "crazy8",
    name: "Crazy 8",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 4,
    tagline: "Classic shedding card game — 8s are wild.",
    icon: "🃏",
    estimatedMinutes: 10
  },
  {
    id: "whot",
    name: "Whot",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 6,
    tagline: "Nigerian card game — match symbol or number.",
    icon: "🂠",
    estimatedMinutes: 10
  },
  {
    id: "ayo",
    name: "Ayo",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Oware strategy — capture the most seeds.",
    icon: " seeds",
    estimatedMinutes: 15
  }
];
