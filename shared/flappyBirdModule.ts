import type { GameModule, Player } from "./types";

const CANVAS_W = 400;
const CANVAS_H = 600;
const GRAVITY = 1400;
const FLAP_VELOCITY = -420;
const PIPE_SPEED = 150;
const PIPE_WIDTH = 56;
const PIPE_GAP = 155;
const PIPE_INTERVAL = 1.6;
const BIRD_SIZE = 26;
const GROUND_H = 50;
const BIRD_X = 80;
const SCORE_PER_PIPE = 1;

export interface Bird {
  playerId: string;
  y: number;
  velocity: number;
  alive: boolean;
  score: number;
}

export interface Pipe {
  x: number;
  gapY: number;
  scored: Record<string, boolean>;
}

export interface FlappyBirdState {
  birds: Bird[];
  pipes: Pipe[];
  phase: "waiting" | "countdown" | "playing" | "gameover";
  countdown: number;
  tickRate: number;
  elapsed: number;
  nextPipeIn: number;
  playerNames: Record<string, string>;
  playerColors: Record<string, string>;
}

export type FlappyBirdAction =
  | { type: "flap" }
  | { type: "start_countdown" };

export type FlappyBirdInput =
  | { type: "flap" }
  | { type: "none" };

const PLAYER_COLORS = [
  "#00d4ff",
  "#e8005c",
  "#00e87b",
  "#ddc830",
];

function createBirds(players: Player[]): Bird[] {
  const spacing = Math.min(60, (CANVAS_H - GROUND_H - 80) / (players.length + 1));
  const startY = CANVAS_H / 2;
  return players.map((p, i) => ({
    playerId: p.id,
    y: startY,
    velocity: 0,
    alive: true,
    score: 0,
  }));
}

export const flappyBirdModule: GameModule<FlappyBirdState, FlappyBirdAction, FlappyBirdInput> = {
  id: "flappy_bird",
  mode: "realtime",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(players: Player[]) {
    const birds = createBirds(players);
    const playerNames: Record<string, string> = {};
    const playerColors: Record<string, string> = {};
    players.forEach((p, i) => {
      playerNames[p.id] = p.name;
      playerColors[p.id] = PLAYER_COLORS[i % PLAYER_COLORS.length]!;
    });
    return {
      birds,
      pipes: [],
      phase: "countdown",
      countdown: 3,
      tickRate: 20,
      elapsed: 0,
      nextPipeIn: PIPE_INTERVAL,
      playerNames,
      playerColors,
    };
  },

  reduce(state, playerId, action) {
    if (action.type === "start_countdown" && state.phase === "waiting") {
      return { ...state, phase: "countdown", countdown: 3 };
    }
    return state;
  },

  tick(state, dt, inputs) {
    if (state.phase === "waiting") return state;

    if (state.phase === "countdown") {
      const newCountdown = state.countdown - dt;
      if (newCountdown <= 0) {
        return { ...state, phase: "playing", countdown: 0, elapsed: 0 };
      }
      return { ...state, countdown: newCountdown };
    }

    if (state.phase === "gameover") return state;

    let birds = state.birds.map((b) => ({ ...b }));
    let pipes = state.pipes.map((p) => ({ ...p, scored: { ...p.scored } }));
    let nextPipeIn = state.nextPipeIn - dt;
    let elapsed = state.elapsed + dt;

    for (const bird of birds) {
      if (!bird.alive) continue;
      const inp = inputs[bird.playerId];
      if (inp && inp.type === "flap") {
        bird.velocity = FLAP_VELOCITY;
      }
    }

    for (const bird of birds) {
      if (!bird.alive) continue;
      bird.velocity += GRAVITY * dt;
      bird.y += bird.velocity * dt;
    }

    for (const pipe of pipes) {
      pipe.x -= PIPE_SPEED * dt;
    }

    pipes = pipes.filter((p) => p.x + PIPE_WIDTH > -10);

    while (nextPipeIn <= 0) {
      const minY = 80;
      const maxY = CANVAS_H - GROUND_H - PIPE_GAP - 80;
      const gapY = minY + Math.random() * (maxY - minY);
      pipes.push({ x: CANVAS_W + 10, gapY, scored: {} });
      nextPipeIn += PIPE_INTERVAL;
    }

    for (const bird of birds) {
      if (!bird.alive) continue;
      const birdTop = bird.y - BIRD_SIZE / 2;
      const birdBottom = bird.y + BIRD_SIZE / 2;
      const birdLeft = BIRD_X - BIRD_SIZE / 2;
      const birdRight = BIRD_X + BIRD_SIZE / 2;

      if (birdBottom >= CANVAS_H - GROUND_H || birdTop <= 0) {
        bird.alive = false;
        continue;
      }

      for (const pipe of pipes) {
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + PIPE_WIDTH;

        if (birdRight > pipeLeft && birdLeft < pipeRight) {
          const gapTop = pipe.gapY;
          const gapBottom = pipe.gapY + PIPE_GAP;
          if (birdTop < gapTop || birdBottom > gapBottom) {
            bird.alive = false;
            break;
          }
        }

        if (!pipe.scored[bird.playerId] && pipe.x + PIPE_WIDTH < BIRD_X) {
          pipe.scored[bird.playerId] = true;
          bird.score += SCORE_PER_PIPE;
        }
      }
    }

    const aliveCount = birds.filter((b) => b.alive).length;
    let phase: FlappyBirdState["phase"] = "playing";

    if (aliveCount === 0) {
      phase = "gameover";
    } else if (aliveCount === 1 && birds.length > 1) {
      phase = "gameover";
    }

    return {
      ...state,
      birds,
      pipes,
      phase,
      elapsed,
      nextPipeIn,
    };
  },

  checkGameOver(state) {
    if (state.phase !== "gameover") return { over: false };

    const sorted = [...state.birds].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.score - a.score;
    });

    const winner = sorted[0];
    if (winner && winner.alive) {
      return { over: true, winnerId: winner.playerId };
    }

    if (winner) {
      return { over: true, winnerId: winner.playerId };
    }

    return { over: true };
  },

  getViewFor(state, playerId) {
    const me = state.birds.find((b) => b.playerId === playerId);
    return {
      birds: state.birds.map((b) => ({
        playerId: b.playerId,
        y: b.y,
        velocity: b.velocity,
        alive: b.alive,
        score: b.score,
        name: state.playerNames[b.playerId] ?? "???",
        color: state.playerColors[b.playerId] ?? "#888",
      })),
      pipes: state.pipes.map((p) => ({ x: p.x, gapY: p.gapY })),
      phase: state.phase,
      countdown: state.countdown,
      myId: playerId,
      myAlive: me?.alive ?? false,
      myScore: me?.score ?? 0,
      playerNames: state.playerNames,
      playerColors: state.playerColors,
      canvasW: CANVAS_W,
      canvasH: CANVAS_H,
      pipeWidth: PIPE_WIDTH,
      pipeGap: PIPE_GAP,
      groundH: GROUND_H,
      birdSize: BIRD_SIZE,
      birdX: BIRD_X,
    };
  },
};
