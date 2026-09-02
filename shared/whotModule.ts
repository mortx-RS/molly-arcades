import type { GameModule, Player } from "./types";

export type WhotSymbol = "circle" | "triangle" | "square" | "cross" | "star";
export type WhotEffect = "draw2" | "draw4" | "hold" | "suspension" | "general_market" | "whot" | "none";

export interface WhotCard {
  id: string;
  symbol: WhotSymbol;
  value: number;
  effect: WhotEffect;
}

export interface WhotState {
  playerIds: string[];
  playerNames: Record<string, string>;
  hands: Record<string, WhotCard[]>;
  drawPile: WhotCard[];
  discardPile: WhotCard[];
  currentTurn: string;
  activeSymbol: WhotSymbol;
  winnerId: string | null;
  scores: Record<string, number>;
}

type WhotAction =
  | { type: "play"; card: WhotCard; chosenSymbol?: WhotSymbol }
  | { type: "draw" };

const SYMBOLS: WhotSymbol[] = ["circle", "triangle", "square", "cross", "star"];

function createDeck(): WhotCard[] {
  const deck: WhotCard[] = [];
  let id = 0;
  for (const symbol of SYMBOLS) {
    for (let v = 1; v <= 14; v++) {
      const effect: WhotEffect = v === 1 ? "general_market" : v === 2 ? "draw2" : v === 14 ? "whot" : "none";
      deck.push({ id: String(id++), symbol, value: v, effect });
    }
  }
  for (let i = 0; i < 5; i++) {
    deck.push({ id: String(id++), symbol: "star", value: 0, effect: "hold" });
    deck.push({ id: String(id++), symbol: "star", value: 0, effect: "suspension" });
    deck.push({ id: String(id++), symbol: "star", value: 0, effect: "draw4" });
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

function isPlayable(card: WhotCard, topCard: WhotCard, activeSymbol: WhotSymbol): boolean {
  if (card.effect === "whot") return true;
  if (card.symbol === activeSymbol) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function nextTurn(current: string, players: string[]): string {
  const idx = players.indexOf(current);
  return players[(idx + 1) % players.length]!;
}

export const whotModule: GameModule<WhotState, WhotAction> = {
  id: "whot",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 6,

  createInitialState(players: Player[]) {
    const deck = createDeck();
    const hands: Record<string, WhotCard[]> = {};
    for (const p of players) {
      hands[p.id] = deck.splice(0, 5);
    }
    let topCard = deck.pop()!;
    while (topCard.effect === "whot") {
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
      activeSymbol: topCard.symbol,
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
      if (drawPile.length > 0) {
        hand.push(drawPile.shift()!);
      }
      const next = nextTurn(playerId, state.playerIds);
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        drawPile,
        currentTurn: next,
      };
    }

    if (action.type === "play") {
      const hand = [...(state.hands[playerId] ?? [])];
      const cardIdx = hand.findIndex((c) => c.id === action.card.id);
      if (cardIdx === -1) return state;
      const topCard = state.discardPile[state.discardPile.length - 1]!;
      if (!isPlayable(action.card, topCard, state.activeSymbol)) return state;

      hand.splice(cardIdx, 1);
      const discardPile = [...state.discardPile, action.card];
      let activeSymbol = state.activeSymbol;

      if (action.card.effect === "whot" && action.chosenSymbol) {
        activeSymbol = action.chosenSymbol;
      } else if (action.card.symbol !== "star") {
        activeSymbol = action.card.symbol;
      }

      let winnerId = state.winnerId;
      if (hand.length === 0) {
        winnerId = playerId;
      }

      const next = nextTurn(playerId, state.playerIds);
      return {
        ...state,
        hands: { ...state.hands, [playerId]: hand },
        discardPile,
        activeSymbol,
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
    return { over: false };
  },

  getViewFor(state, playerId) {
    return {
      hand: state.hands[playerId] ?? [],
      topCard: state.discardPile[state.discardPile.length - 1] ?? null,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      activeSymbol: state.activeSymbol,
      drawCount: state.drawPile.length,
      scores: state.scores,
      winnerId: state.winnerId,
      playerNames: state.playerNames,
      myId: playerId,
    };
  },
};
