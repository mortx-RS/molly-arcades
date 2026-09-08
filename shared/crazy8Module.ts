import type { GameModule, Player } from "./types";

export interface Crazy8Card {
  id: string;
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
  pendingDraw: number;
  lastAction: { type: "play" | "draw" | "pass"; playerId: string; cardId?: string } | null;
  drawnCardIdThisTurn: string | null;
}

type Crazy8Action =
  | { type: "play"; cardId: string; chosenSuit?: string }
  | { type: "draw" }
  | { type: "pass" };

const SUITS: Array<Crazy8Card["suit"]> = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Array<Crazy8Card["rank"]> = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): Crazy8Card[] {
  const deck: Crazy8Card[] = [];
  let idx = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `c${idx++}`, suit, rank });
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
      direction: 1 as const,
      currentSuit: topCard.suit,
      winnerId: null,
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      pendingDraw: 0,
      lastAction: null,
      drawnCardIdThisTurn: null,
    };
  },

  reduce(state, playerId, action) {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "draw") {
      const hand = [...(state.hands[playerId] ?? [])];
      const drawPile = [...state.drawPile];
      const count = state.pendingDraw > 0 ? state.pendingDraw : 1;
      for (let i = 0; i < count; i++) {
        if (drawPile.length === 0) {
          const discardPile = [...state.discardPile];
          const top = discardPile.pop()!;
          const newDeck = shuffle(discardPile);
          drawPile.push(...newDeck);
          drawPile.splice(0, 0, top);
        }
        if (drawPile.length > 0) {
          hand.push(drawPile.shift()!);
        }
      }
      const drawnCard = hand[hand.length - 1];
      const topCard = state.discardPile[state.discardPile.length - 1]!;
      const canPlay = hand.some((c) => isPlayable(c, topCard, state.currentSuit));
      const next = nextTurn(playerId, state.playerIds, state.direction);
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        drawPile,
        currentTurn: canPlay ? playerId : next,
        pendingDraw: 0,
        drawnCardIdThisTurn: drawnCard?.id ?? null,
        lastAction: { type: "draw", playerId },
      };
    }

    if (action.type === "pass") {
      const next = nextTurn(playerId, state.playerIds, state.direction);
      return {
        ...state,
        currentTurn: next,
        drawnCardIdThisTurn: null,
        lastAction: { type: "pass", playerId },
      };
    }

    if (action.type === "play") {
      const hand = [...(state.hands[playerId] ?? [])];
      const cardIdx = hand.findIndex((c) => c.id === action.cardId);
      if (cardIdx === -1) return state;
      const card = hand[cardIdx]!;
      const topCard = state.discardPile[state.discardPile.length - 1]!;
      if (state.pendingDraw > 0 && card.rank !== "2") return state;
      if (state.pendingDraw === 0 && !isPlayable(card, topCard, state.currentSuit)) return state;
      hand.splice(cardIdx, 1);
      const discardPile = [...state.discardPile, card];
      let currentSuit = card.suit as Crazy8Card["suit"];
      if (card.rank === "8" && action.chosenSuit) {
        currentSuit = action.chosenSuit as Crazy8Card["suit"];
      }
      let pendingDraw = state.pendingDraw;
      if (card.rank === "2") {
        pendingDraw += 2;
      }
      let direction = state.direction;
      if (card.rank === "A") {
        direction = direction === 1 ? -1 : 1;
      }
      let winnerId = state.winnerId;
      if (hand.length === 0) {
        winnerId = playerId;
      }
      let next = nextTurn(playerId, state.playerIds, direction);
      if (card.rank === "Q") {
        next = nextTurn(next, state.playerIds, direction);
      }
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        discardPile,
        currentSuit,
        currentTurn: winnerId ? playerId : next,
        winnerId,
        pendingDraw,
        direction,
        drawnCardIdThisTurn: null,
        lastAction: { type: "play", playerId, cardId: card.id },
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
    const hand = state.hands[playerId] ?? [];
    const topCard = state.discardPile[state.discardPile.length - 1] ?? null;
    const opponents = state.playerIds
      .filter((id) => id !== playerId)
      .map((id) => ({
        id,
        name: state.playerNames[id] ?? id,
        cardCount: (state.hands[id] ?? []).length,
      }));
    let playableCardIds: string[] = [];
    if (topCard && state.pendingDraw === 0) {
      playableCardIds = hand.filter((c) => isPlayable(c, topCard, state.currentSuit)).map((c) => c.id);
    } else if (state.pendingDraw > 0) {
      playableCardIds = hand.filter((c) => c.rank === "2").map((c) => c.id);
    }
    return {
      myHand: hand,
      opponents,
      topCard,
      wildSuit: state.currentSuit !== topCard?.suit ? state.currentSuit : null,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      deckCount: state.drawPile.length,
      drawnCardId: state.drawnCardIdThisTurn,
      winnerId: state.winnerId,
      message: null,
      lastAction: state.lastAction,
      pendingDraw: state.pendingDraw,
      direction: state.direction,
      playableCardIds,
    };
  },
};
