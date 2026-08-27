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

export type PoolAction =
  | { type: "turn_result"; pocketedIds: number[]; cuePocketed: boolean; firstHit: number | null }
  | { type: "place_cue"; x: number; y: number };

export interface PoolState {
  playerIds: [string, string];
  playerNames: Record<string, string>;
  currentTurn: string;
  assignments: [string | null, string | null];
  turnPocketed: number[];
  foul: string | null;
  winnerId: string | null;
  message: string;
  breakShot: boolean;
}

export const poolModule: GameModule<PoolState, PoolAction> = {
  id: "pool",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,
  createInitialState(players: Player[]) {
    return {
      playerIds: [players[0]!.id, players[1]!.id],
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      currentTurn: players[0]!.id,
      assignments: [null, null],
      turnPocketed: [],
      foul: null,
      winnerId: null,
      message: `${players[0]!.name}'s break`,
      breakShot: true,
    };
  },
  reduce(state, playerId, action: PoolAction) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;
    if (state.foul === "placing-cue") return state;

    const otherPlayer = state.playerIds[0] === playerId ? state.playerIds[1]! : state.playerIds[0]!;
    const currentPlayerIdx = state.playerIds.indexOf(playerId);
    const otherPlayerIdx = state.playerIds.indexOf(otherPlayer);

    if (action.type === "place_cue") {
      return {
        ...state,
        foul: null,
        message: `${state.playerNames[playerId]}'s turn`,
      };
    }

    const { pocketedIds, cuePocketed, firstHit } = action;
    const currentAssignment = state.assignments[currentPlayerIdx];
    let newAssignments = [...state.assignments] as [string | null, string | null];
    let foul: string | null = null;
    let switchTurn = true;
    let winnerId: string | null = null;
    let message = "";

    // Check 8-ball pocketed
    if (pocketedIds.includes(8)) {
      const hasAssignment = currentAssignment !== null;
      const allOwnPocketed = hasAssignment
        ? pocketedIds.filter((id) => id !== 0 && id !== 8).length >= 7
        : false;

      if (!hasAssignment || cuePocketed || !allOwnPocketed) {
        winnerId = otherPlayer;
        message = `${state.playerNames[otherPlayer]} wins! (${state.playerNames[playerId]} sank the 8-ball illegally)`;
      } else {
        winnerId = playerId;
        message = `${state.playerNames[playerId]} wins!`;
      }
      return {
        ...state,
        winnerId,
        message,
        foul: null,
        currentTurn: playerId,
        turnPocketed: pocketedIds,
        breakShot: false,
      };
    }

    // Foul checks
    if (cuePocketed) {
      foul = "Scratch! Cue ball pocketed";
    } else if (firstHit === null && !state.breakShot) {
      foul = "Foul! No ball hit";
    } else if (firstHit !== null && currentAssignment !== null && !state.breakShot) {
      const isSolid = firstHit >= 1 && firstHit <= 7;
      const isStripe = firstHit >= 9 && firstHit <= 15;
      if (currentAssignment === "solids" && !isSolid) {
        foul = "Foul! Must hit solid first";
      } else if (currentAssignment === "stripes" && !isStripe) {
        foul = "Foul! Must hit stripe first";
      }
    }

    // Assign solids/stripes after break
    if (state.breakShot && pocketedIds.length > 0 && !cuePocketed) {
      const firstPocketed = pocketedIds.find((id) => id !== 0 && id !== 8);
      if (firstPocketed !== undefined) {
        if (firstPocketed >= 1 && firstPocketed <= 7) {
          newAssignments = ["solids", "stripes"];
        } else if (firstPocketed >= 9 && firstPocketed <= 15) {
          newAssignments = ["stripes", "solids"];
        }
      }
    }

    // Determine if turn continues
    if (!foul && pocketedIds.length > 0) {
      const pocketedOwn = pocketedIds.some((id) => {
        if (id === 0 || id === 8) return false;
        if (newAssignments[currentPlayerIdx] === "solids") return id >= 1 && id <= 7;
        if (newAssignments[currentPlayerIdx] === "stripes") return id >= 9 && id <= 15;
        return true;
      });
      if (pocketedOwn) switchTurn = false;
    }

    if (foul) switchTurn = true;

    const nextPlayer = switchTurn ? otherPlayer : playerId;

    message = foul || `${state.playerNames[nextPlayer]}'s turn${!switchTurn ? " (continue)" : ""}`;

    return {
      ...state,
      currentTurn: nextPlayer,
      assignments: newAssignments,
      foul,
      message,
      breakShot: false,
      turnPocketed: pocketedIds,
    };
  },
  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    return { over: false };
  },
  getViewFor(state, playerId) {
    const currentPlayerIdx = state.playerIds.indexOf(state.currentTurn);
    const playerIdx = state.playerIds.indexOf(playerId);
    return {
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      assignments: state.assignments,
      myAssignment: state.assignments[playerIdx],
      foul: state.foul,
      winnerId: state.winnerId,
      message: state.message,
      playerNames: state.playerNames,
      playerIds: state.playerIds,
      breakShot: state.breakShot,
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
