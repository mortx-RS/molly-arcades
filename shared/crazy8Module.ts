import type { GameModule, Player } from "./types";

export interface Crazy8Card {
  suit: "hearts" | "diamonds" | "clubs" | "spades";
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
}

export interface Crazy8State {
  playerIds: string[];
  playerNames: Record<string, string>;
  hands: Record<string, Crazy8Card[]>;
  drawPile: Crazy8Card[];
  discardPile: Crazy8Card[];
  currentTurn: string;
  direction: 1 | -1;
  currentSuit: string;
  winnerId: string | null;
  scores: Record<string, number>;
}

type Crazy8Action =
  | { type: "play"; card: Crazy8Card; chosenSuit?: string }
  | { type: "draw" }
  | { type: "pass" };

const SUITS: Array<Crazy8Card["suit"]> = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Array<Crazy8Card["rank"]> = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): Crazy8Card[] {
  const deck: Crazy8Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function cardValue(card: Crazy8Card): number {
  if (card.rank === "8") return 50;
  if (card.rank === "A") return 1;
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  return parseInt(card.rank);
}

function isPlayable(card: Crazy8Card, topCard: Crazy8Card, currentSuit: string): boolean {
  if (card.rank === "8") return true;
  if (card.suit === currentSuit) return true;
  if (card.rank === topCard.rank) return true;
  return false;
}

function nextTurn(current: string, players: string[], direction: 1 | -1): string {
  const idx = players.indexOf(current);
  const next = idx + direction;
  if (next >= players.length) return players[0]!;
  if (next < 0) return players[players.length - 1]!;
  return players[next]!;
}

export const crazy8Module: GameModule<Crazy8State, Crazy8Action> = {
  id: "crazy8",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 4,

  createInitialState(players: Player[]) {
    const deck = createDeck();
    const hands: Record<string, Crazy8Card[]> = {};
    for (const p of players) {
      hands[p.id] = deck.splice(0, 5);
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
      drawPile: deck,
      discardPile: [topCard],
      currentTurn: players[0]!.id,
      direction: 1,
      currentSuit: topCard.suit,
      winnerId: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "draw") {
      const hand = [...(state.hands[playerId] ?? [])];
      const drawPile = [...state.drawPile];
      if (drawPile.length === 0) {
        const discardPile = [...state.discardPile];
        const topCard = discardPile.pop()!;
        const newDeck = shuffle(discardPile);
        drawPile.push(...newDeck);
        drawPile.splice(0, 0, topCard);
      }
      if (drawPile.length > 0) {
        hand.push(drawPile.shift()!);
      }
      const topCard = state.discardPile[state.discardPile.length - 1]!;
      const canPlay = hand.some((c) => isPlayable(c, topCard, state.currentSuit));
      const next = nextTurn(playerId, state.playerIds, state.direction);
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        drawPile,
        currentTurn: canPlay ? playerId : next,
      };
    }

    if (action.type === "play") {
      const hand = [...(state.hands[playerId] ?? [])];
      const cardIdx = hand.findIndex((c) => c.suit === action.card.suit && c.rank === action.card.rank);
      if (cardIdx === -1) return state;
      const topCard = state.discardPile[state.discardPile.length - 1]!;
      if (!isPlayable(action.card, topCard, state.currentSuit)) return state;
      hand.splice(cardIdx, 1);
      const discardPile = [...state.discardPile, action.card];
      let currentSuit = action.card.suit as Crazy8Card["suit"];
      if (action.card.rank === "8" && action.chosenSuit) {
        currentSuit = action.chosenSuit as Crazy8Card["suit"];
      }
      let winnerId = state.winnerId;
      if (hand.length === 0) {
        winnerId = playerId;
      }
      const next = nextTurn(playerId, state.playerIds, state.direction);
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        discardPile,
        currentSuit,
        currentTurn: winnerId ? playerId : next,
        winnerId,
      };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    for (const [pid, hand] of Object.entries(state.hands)) {
      if (hand.length === 0) return { over: true, winnerId: pid };
    }
    const totalCards = Object.values(state.hands).reduce((sum, h) => sum + h.length, 0);
    if (totalCards === 0 && state.drawPile.length === 0) return { over: true };
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      hand: state.hands[playerId] ?? [],
      topCard: state.discardPile[state.discardPile.length - 1] ?? null,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      currentSuit: state.currentSuit,
      drawCount: state.drawPile.length,
      scores: state.scores,
      winnerId: state.winnerId,
      playerNames: state.playerNames,
      myId: playerId,
    };
  },
};
