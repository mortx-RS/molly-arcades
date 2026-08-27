export type RoomId = string;

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
}

export interface Room {
  id: RoomId;
  gameType: string;
  players: Player[];
  status: "lobby" | "in-progress" | "finished";
  gameState: unknown;
  createdAt: number;
  hostId: string;
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
    estimatedMinutes: 10
  },
  {
    id: "crazy8",
    name: "Crazy 8",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 4,
    tagline: "Classic shedding card game — match suit or rank, 8s are wild.",
    icon: "🃏",
    estimatedMinutes: 5
  },
  {
    id: "pool",
    name: "8-Ball Pool",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Classic billiards — sink all your balls then the 8.",
    icon: "🎱",
    estimatedMinutes: 10
  },
  {
    id: "crossword",
    name: "Crossword Clash",
    mode: "turn-based",
    minPlayers: 2,
    maxPlayers: 2,
    tagline: "Race to solve clues — every word earns points.",
    icon: "🧩",
    estimatedMinutes: 8
  }
];
