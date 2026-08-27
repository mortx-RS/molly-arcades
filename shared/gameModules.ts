import type { GameModule, Player } from "./types";
export { chessModule } from "./chessModule";
export { crosswordModule } from "./crosswordModule";

export interface ArcheryAction {
  angle: number;
  power: number;
}

export interface ArcheryState {
  turnId: string;
  scores: Record<string, number>;
  lastShot: { x: number; y: number; score: number; playerId: string } | null;
}

const WINNING_SCORE = 50;

const CANVAS_W = 400;
const CANVAS_H = 400;
const GROUND_Y = 340;
const ARCHER_X = 60;
const ARCHER_Y = GROUND_Y;
const TARGET_X = 320;
const TARGET_Y = GROUND_Y - 60;
const TARGET_R = 50;

const RINGS = [
  { r: TARGET_R, points: 1 },
  { r: TARGET_R * 0.8, points: 3 },
  { r: TARGET_R * 0.6, points: 5 },
  { r: TARGET_R * 0.4, points: 8 },
  { r: TARGET_R * 0.2, points: 10 }
];

function simulate(angleDeg: number, power: number): { x: number; y: number; score: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const vx = power * Math.cos(rad) * 5;
  const vy = power * Math.sin(rad) * 5;
  const G = 0.5;
  let t = 0;
  const dt = 0.1;
  let x = ARCHER_X;
  let y = ARCHER_Y;
  while (y >= 0 && x <= CANVAS_W + 50) {
    x = ARCHER_X + vx * t;
    y = ARCHER_Y - (vy * t - 0.5 * G * t * t);
    t += dt;
  }
  const dx = x - TARGET_X;
  const dy = y - TARGET_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let score = 0;
  for (const ring of RINGS) {
    if (dist <= ring.r) {
      score = ring.points;
    }
  }
  return { x: Math.min(x, CANVAS_W), y: Math.max(y, 0), score };
}

function otherPlayerId(scores: Record<string, number>, currentId: string): string {
  const ids = Object.keys(scores);
  return ids.find((id) => id !== currentId) ?? ids[0] ?? currentId;
}

export const archeryModule: GameModule<ArcheryState, ArcheryAction> = {
  id: "archery",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState(players: Player[]) {
    return {
      turnId: players[0]!.id,
      scores: { [players[0]!.id]: 0, [players[1]!.id]: 0 },
      lastShot: null
    };
  },
  reduce(state, playerId, action: ArcheryAction) {
    if (state.turnId !== playerId) return state;
    const { x, y, score } = simulate(action.angle, action.power);
    const newScores = { ...state.scores, [playerId]: (state.scores[playerId] ?? 0) + score };
    const nextTurn = otherPlayerId(newScores, playerId);
    return {
      turnId: nextTurn,
      scores: newScores,
      lastShot: { x, y, score, playerId }
    };
  },
  checkGameOver(state) {
    for (const [pid, s] of Object.entries(state.scores)) {
      if (s >= WINNING_SCORE) return { over: true, winnerId: pid };
    }
    return { over: false };
  },
  getViewFor(state, playerId) {
    const opp = otherPlayerId(state.scores, playerId);
    const isOpponentShot = state.lastShot && state.lastShot.playerId !== playerId;
    return {
      turn: state.turnId,
      myScore: state.scores[playerId] ?? 0,
      opponentScore: state.scores[opp] ?? 0,
      isMyTurn: state.turnId === playerId,
      lastShot: isOpponentShot ? state.lastShot : null
    };
  }
};

const QUIZ_PROMPTS = [
  "What's your ideal Sunday morning?",
  "Pick a superpower: flight, invisibility, or time travel?",
  "Your go-to comfort food?",
  "Beach vacation or mountain cabin?",
  "Cats or dogs?",
  "How do you spend a rainy day?",
  "Favorite season?",
  "Early bird or night owl?",
  "Sweet or savory?",
  "What's your love language?"
];

const ROUNDS = 5;

function matchScore(a: string, b: string): number {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (na === nb) return 10;
  if (na.includes(nb) || nb.includes(na)) return 7;
  const wa = na.split(/\s+/);
  const wb = nb.split(/\s+/);
  const shared = wa.filter((w) => wb.includes(w));
  if (shared.length > 0) return 5;
  return 0;
}

export type QuizAction = {
  type: "answer";
  answer: string;
} | {
  type: "next_round";
}

export interface QuizState {
  round: number;
  prompts: string[];
  answers: Record<string, string[]>;
  submitted: Record<string, boolean>;
  revealed: boolean;
  roundScores: number[];
  compatibilityScore: number;
}

export const quizModule: GameModule<QuizState, QuizAction> = {
  id: "quiz",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState(players: Player[]) {
    const shuffled = [...QUIZ_PROMPTS].sort(() => Math.random() - 0.5);
    const prompts = shuffled.slice(0, ROUNDS);
    return {
      round: 0,
      prompts,
      answers: { [players[0]!.id]: [], [players[1]!.id]: [] },
      submitted: { [players[0]!.id]: false, [players[1]!.id]: false },
      revealed: false,
      roundScores: [],
      compatibilityScore: 0
    };
  },
  reduce(state, playerId, action: QuizAction) {
    if (action.type === "next_round") {
      if (!state.revealed) return state;
      const nextRound = state.round + 1;
      const ids = Object.keys(state.answers);
      return {
        ...state,
        round: nextRound,
        submitted: { [ids[0]!]: false, [ids[1]!]: false },
        revealed: false
      };
    }

    if (state.revealed) return state;
    if (state.submitted[playerId]) return state;

    const newAnswers = {
      ...state.answers,
      [playerId]: [...(state.answers[playerId] ?? []), action.answer]
    };
    const newSubmitted = { ...state.submitted, [playerId]: true };

    const allSubmitted = Object.values(newSubmitted).every(Boolean);

    if (!allSubmitted) {
      return {
        ...state,
        answers: newAnswers,
        submitted: newSubmitted
      };
    }

    const ids = Object.keys(state.answers);
    const a0 = newAnswers[ids[0]!] ?? [];
    const a1 = newAnswers[ids[1]!] ?? [];
    const currentA = a0[state.round] ?? "";
    const currentB = a1[state.round] ?? "";
    const score = matchScore(currentA, currentB);
    const newRoundScores = [...state.roundScores, score];
    const total = newRoundScores.reduce((s, v) => s + v, 0);
    const maxPossible = (state.round + 1) * 10;
    const compat = Math.round((total / maxPossible) * 100);

    return {
      ...state,
      answers: newAnswers,
      submitted: newSubmitted,
      revealed: true,
      roundScores: newRoundScores,
      compatibilityScore: compat
    };
  },
  checkGameOver(state) {
    if (state.round >= ROUNDS - 1 && state.revealed) {
      return { over: true };
    }
    return { over: false };
  },
  getViewFor(state, playerId) {
    const ids = Object.keys(state.answers);
    const oppId = ids.find((id) => id !== playerId) ?? "";
    const myAnswers = state.answers[playerId] ?? [];
    const oppAnswers = state.answers[oppId] ?? [];
    const mySubmitted = state.submitted[playerId] ?? false;
    const oppSubmitted = state.submitted[oppId] ?? false;
    const currentRound = state.round;

    const myCurrent = myAnswers[currentRound] ?? null;
    const oppCurrent = state.revealed ? (oppAnswers[currentRound] ?? null) : null;
    const myPrevious = myAnswers.slice(0, currentRound);
    const oppPrevious = state.revealed ? oppAnswers.slice(0, currentRound) : [];

    return {
      round: currentRound,
      totalRounds: ROUNDS,
      prompt: state.prompts[currentRound] ?? "",
      myAnswer: myCurrent,
      opponentAnswer: oppCurrent,
      mySubmitted,
      opponentSubmitted: oppSubmitted,
      revealed: state.revealed,
      myPrevious,
      opponentPrevious: oppPrevious,
      roundScores: state.roundScores,
      compatibilityScore: state.compatibilityScore,
      waitingOn: !oppSubmitted ? "opponent" : !mySubmitted ? "you" : null
    };
  }
};

type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

interface Card {
  suit: Suit;
  rank: Rank;
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function cardId(c: Card): string {
  return `${c.rank}_${c.suit}`;
}

function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function canPlay(card: Card, topCard: Card, wildSuit: Suit | null): boolean {
  if (card.rank === "8") return true;
  const effectiveSuit = wildSuit ?? topCard.suit;
  if (card.suit === effectiveSuit) return true;
  if (card.rank === topCard.rank) return true;
  return false;
}

export type Crazy8Action =
  | { type: "play"; cardId: string; chosenSuit?: Suit }
  | { type: "draw" }
  | { type: "pass" };

export interface Crazy8State {
  playerIds: string[];
  playerNames: Record<string, string>;
  hands: Record<string, Card[]>;
  deck: Card[];
  discardPile: Card[];
  topCard: Card;
  currentTurn: string;
  wildSuit: Suit | null;
  drawnCardId: string | null;
  winnerId: string | null;
  message: string | null;
  lastAction: { type: "play" | "draw" | "pass"; playerId: string; cardId?: string } | null;
  direction: 1 | -1;
  pendingDraw: number;
}

function nextPlayerPid(playerIds: string[], currentId: string, direction: 1 | -1): string {
  const idx = playerIds.indexOf(currentId);
  const next = (idx + direction + playerIds.length) % playerIds.length;
  return playerIds[next]!;
}

export const crazy8Module: GameModule<Crazy8State, Crazy8Action> = {
  id: "crazy8",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 4,
  createInitialState(players: Player[]) {
    const deck = shuffle(createDeck());
    const hands: Record<string, Card[]> = {};
    for (const p of players) {
      hands[p.id] = deck.splice(0, 7);
    }
    let topCard = deck.pop()!;
    while (topCard.rank === "8") {
      deck.unshift(topCard);
      topCard = deck.pop()!;
    }
    return {
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      hands,
      deck,
      discardPile: [topCard],
      topCard,
      currentTurn: players[0]!.id,
      wildSuit: null,
      drawnCardId: null,
      winnerId: null,
      message: null,
      lastAction: null,
      direction: 1,
      pendingDraw: 0,
    };
  },
  reduce(state, playerId, action: Crazy8Action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    // Helper: draw N cards from deck into hand, return new state fragment
    const drawCards = (s: Crazy8State, pid: string, count: number): { deck: Card[]; hand: Card[]; drawnIds: string[] } => {
      const deck = [...s.deck];
      const hand = [...(s.hands[pid] ?? [])];
      const drawnIds: string[] = [];
      for (let i = 0; i < count; i++) {
        if (deck.length === 0) break;
        const card = deck.pop()!;
        hand.push(card);
        drawnIds.push(cardId(card));
      }
      return { deck, hand, drawnIds };
    };

    // Helper: reshuffle discard pile into deck (keep top card)
    const reshuffleIfNeeded = (s: Crazy8State): Card[] => {
      if (s.deck.length > 0) return s.deck;
      if (s.discardPile.length <= 1) return s.deck;
      const discardWithoutTop = s.discardPile.slice(0, -1);
      return shuffle(discardWithoutTop);
    };

    // DRAW action
    if (action.type === "draw") {
      if (state.drawnCardId) return state;
      const newDeck = reshuffleIfNeeded(state);
      if (newDeck.length === 0) {
        const next = nextPlayerPid(state.playerIds, playerId, state.direction);
        return { ...state, deck: [], currentTurn: next, drawnCardId: null, pendingDraw: 0, message: "Deck empty — turn passed", lastAction: { type: "pass", playerId } as const };
      }
      const deck = [...newDeck];
      const hand = [...(state.hands[playerId] ?? [])];
      const drawCount = state.pendingDraw > 0 ? state.pendingDraw : 1;
      const drawnIds: string[] = [];
      for (let i = 0; i < drawCount; i++) {
        if (deck.length === 0) break;
        const card = deck.pop()!;
        hand.push(card);
        drawnIds.push(cardId(card));
      }
      const drawnCardIdStr = drawnIds[drawnIds.length - 1];
      const drawnCards = hand.filter((c) => drawnIds.includes(cardId(c)));
      const canPlayOne = drawCount === 1 && drawnCards.length === 1 && canPlay(drawnCards[0]!, state.topCard, state.wildSuit);
      return {
        ...state,
        deck,
        hands: { ...state.hands, [playerId]: hand },
        drawnCardId: canPlayOne ? drawnCardIdStr ?? null : null,
        currentTurn: canPlayOne ? playerId : nextPlayerPid(state.playerIds, playerId, state.direction),
        pendingDraw: 0,
        message: canPlayOne ? "You drew a playable card!" : drawCount > 1 ? `Drew ${drawCount} cards` : "No match — turn passed",
        lastAction: { type: "draw", playerId, cardId: drawnCardIdStr }
      };
    }

    // PASS action
    if (action.type === "pass") {
      if (!state.drawnCardId) return state;
      return {
        ...state,
        currentTurn: nextPlayerPid(state.playerIds, playerId, state.direction),
        drawnCardId: null,
        message: null,
        lastAction: { type: "pass", playerId }
      };
    }

    // PLAY action
    if (action.type === "play") {
      const hand = state.hands[playerId] ?? [];
      const idx = hand.findIndex((c) => cardId(c) === action.cardId);
      if (idx === -1) return state;
      const card = hand[idx]!;
      if (!canPlay(card, state.topCard, state.wildSuit)) return state;

      // When pendingDraw > 0, only a 2 can be played (stacking)
      if (state.pendingDraw > 0 && card.rank !== "2") return state;

      const newHand = [...hand];
      newHand.splice(idx, 1);
      const newHands = { ...state.hands, [playerId]: newHand };
      const discardPile = [...state.discardPile, state.topCard];
      const wildSuit = card.rank === "8" ? (action.chosenSuit ?? "hearts") : null;

      // Check win
      if (newHand.length === 0) {
        return {
          ...state,
          hands: newHands,
          discardPile,
          topCard: card,
          wildSuit,
          drawnCardId: null,
          winnerId: playerId,
          message: "Winner!",
          lastAction: { type: "play", playerId, cardId: action.cardId }
        };
      }

      let direction = state.direction;
      let pendingDraw = 0;
      let nextTurn = nextPlayerPid(state.playerIds, playerId, direction);
      let message: string | null = null;

      if (card.rank === "2") {
        // 2: next player draws 2 (stacks with previous pendingDraw)
        pendingDraw = (state.pendingDraw || 0) + 2;
        // Check if next player can play a 2 from their hand (stacking)
        const nextHand = newHands[nextTurn] ?? [];
        const canStack = nextHand.some((c) => c.rank === "2");
        message = `${pendingDraw} cards pending`;
        // Next player gets the turn — they must draw 2 or stack a 2
        nextTurn = nextTurn;
      } else if (card.rank === "Q") {
        // Q: skip next player
        nextTurn = nextPlayerPid(state.playerIds, nextTurn, direction);
        message = "Skipped!";
      } else if (card.rank === "A") {
        // A: reverse direction (2-player = skip; 3+ = reverse)
        direction = (state.direction === 1 ? -1 : 1) as 1 | -1;
        if (state.playerIds.length === 2) {
          // In 2-player, Ace acts like skip
          nextTurn = nextPlayerPid(state.playerIds, nextTurn, direction);
        } else {
          nextTurn = nextPlayerPid(state.playerIds, playerId, direction);
        }
        message = "Reversed!";
      }

      return {
        ...state,
        hands: newHands,
        discardPile,
        topCard: card,
        wildSuit,
        currentTurn: nextTurn,
        drawnCardId: null,
        direction,
        pendingDraw,
        message,
        lastAction: { type: "play", playerId, cardId: action.cardId }
      };
    }

    return state;
  },
  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    return { over: false };
  },
  getViewFor(state, playerId) {
    const opponents = state.playerIds
      .filter((id) => id !== playerId)
      .map((id) => ({ id, name: state.playerNames[id] ?? "Player", cardCount: (state.hands[id] ?? []).length }));
    const myHand = (state.hands[playerId] ?? []);
    const playableCardIds = myHand
      .filter((c) => canPlay(c, state.topCard, state.wildSuit))
      .map((c) => cardId(c));
    return {
      myHand: myHand.map((c) => ({ id: cardId(c), suit: c.suit, rank: c.rank })),
      opponents,
      topCard: { id: cardId(state.topCard), suit: state.topCard.suit, rank: state.topCard.rank },
      wildSuit: state.wildSuit,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      deckCount: state.deck.length,
      drawnCardId: state.drawnCardId,
      winnerId: state.winnerId,
      message: state.message,
      lastAction: state.lastAction,
      pendingDraw: state.pendingDraw,
      direction: state.direction,
      playableCardIds,
    };
  }
};
