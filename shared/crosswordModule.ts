import type { GameModule, Player } from "./types";

export interface CrosswordClue {
  number: number;
  direction: "across" | "down";
  row: number;
  col: number;
  word: string;
  clue: string;
}

export interface CrosswordState {
  playerIds: string[];
  playerNames: Record<string, string>;
  grid: string[][];
  clues: CrosswordClue[];
  scores: Record<string, number>;
  solvedClues: Record<number, { playerId: string; guess: string; correct: boolean }>;
  currentTurn: string;
  round: number;
  maxRounds: number;
  winnerId: string | null;
  result: string | null;
  message: string | null;
  lastAction: { clueNumber: number; playerId: string; guess: string; correct: boolean } | null;
}

export type CrosswordAction =
  | { type: "guess"; clueNumber: number; guess: string }
  | { type: "pass" };

const GRID_SIZE = 7;

interface CrosswordPuzzle {
  grid: string[][];
  clues: CrosswordClue[];
}

const PUZZLES: CrosswordPuzzle[] = [
  // Puzzle 1
  (() => {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(""));
    const clues: CrosswordClue[] = [];

    const placeWord = (num: number, dir: "across" | "down", r: number, c: number, word: string, clue: string) => {
      for (let i = 0; i < word.length; i++) {
        if (dir === "across") grid[r]![c + i] = word[i]!;
        else grid[r + i]![c] = word[i]!;
      }
      clues.push({ number: num, direction: dir, row: r, col: c, word, clue });
    };

    placeWord(1, "across", 0, 0, "REACT", "JavaScript UI library");
    placeWord(2, "down", 0, 0, "RUST", "Systems language with ownership");
    placeWord(3, "down", 0, 4, "HOOK", "React function starting with use");
    placeWord(4, "across", 2, 2, "NODE", "JavaScript server runtime");
    placeWord(5, "down", 2, 2, "DEEP", "Not shallow, or a copy method");
    placeWord(6, "across", 4, 0, "VITE", "Fast frontend build tool");
    placeWord(7, "down", 0, 2, "ETO", "Unix timestamp suffix");
    placeWord(8, "across", 6, 0, "ECHO", "Sound reflection or a shell command");

    return { grid, clues };
  })(),
  // Puzzle 2
  (() => {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(""));
    const clues: CrosswordClue[] = [];

    const placeWord = (num: number, dir: "across" | "down", r: number, c: number, word: string, clue: string) => {
      for (let i = 0; i < word.length; i++) {
        if (dir === "across") grid[r]![c + i] = word[i]!;
        else grid[r + i]![c] = word[i]!;
      }
      clues.push({ number: num, direction: dir, row: r, col: c, word, clue });
    };

    placeWord(1, "across", 0, 0, "STACK", "Data structure: last in, first out");
    placeWord(2, "down", 0, 0, "SLUG", "URL-friendly string");
    placeWord(3, "across", 2, 1, "ARRAY", "Indexed collection of elements");
    placeWord(4, "down", 0, 4, "KERN", "Part of an operating system");
    placeWord(5, "across", 4, 0, "CLOUD", "Remote computing platform");
    placeWord(6, "down", 2, 2, "RUBY", "Programming language named for a gem");
    placeWord(7, "across", 6, 0, "QUERY", "Database lookup request");

    return { grid, clues };
  })(),
  // Puzzle 3
  (() => {
    const grid: string[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(""));
    const clues: CrosswordClue[] = [];

    const placeWord = (num: number, dir: "across" | "down", r: number, c: number, word: string, clue: string) => {
      for (let i = 0; i < word.length; i++) {
        if (dir === "across") grid[r]![c + i] = word[i]!;
        else grid[r + i]![c] = word[i]!;
      }
      clues.push({ number: num, direction: dir, row: r, col: c, word, clue });
    };

    placeWord(1, "across", 0, 0, "PYTHON", "Snake or programming language");
    placeWord(2, "down", 0, 3, "LOOP", "Repeated execution");
    placeWord(3, "across", 2, 1, "PARSE", "Analyze string structure");
    placeWord(4, "down", 0, 1, "OPEN", "Not closed, or a file operation");
    placeWord(5, "across", 4, 0, "FLOAT", "Decimal number type");
    placeWord(6, "down", 0, 5, "TREE", "Hierarchical data structure");
    placeWord(7, "across", 6, 0, "CACHE", "Fast temporary storage");

    return { grid, clues };
  })()
];

function pickPuzzle(playerIds: string[]): CrosswordPuzzle {
  const idx = Math.floor(Math.random() * PUZZLES.length);
  return PUZZLES[idx]!;
}

function scoreForWord(word: string, correct: boolean): number {
  if (!correct) return 0;
  return word.length * 10;
}

const MAX_ROUNDS = 12;

export const crosswordModule: GameModule<CrosswordState, CrosswordAction> = {
  id: "crossword",
  mode: "turn-based",
  minPlayers: 2,
  maxPlayers: 2,

  createInitialState(players: Player[]): CrosswordState {
    const puzzle = pickPuzzle(players.map((p) => p.id));
    return {
      playerIds: players.map((p) => p.id),
      playerNames: Object.fromEntries(players.map((p) => [p.id, p.name])),
      grid: puzzle.grid,
      clues: puzzle.clues,
      scores: { [players[0]!.id]: 0, [players[1]!.id]: 0 },
      solvedClues: {},
      currentTurn: players[0]!.id,
      round: 0,
      maxRounds: MAX_ROUNDS,
      winnerId: null,
      result: null,
      message: null,
      lastAction: null
    };
  },

  reduce(state, playerId, action: CrosswordAction): CrosswordState {
    if (state.winnerId) return state;
    if (state.currentTurn !== playerId) return state;

    if (action.type === "pass") {
      const nextIdx = (state.playerIds.indexOf(playerId) + 1) % state.playerIds.length;
      const nextPlayer = state.playerIds[nextIdx]!;
      return {
        ...state,
        currentTurn: nextPlayer,
        round: state.round + 1,
        message: null,
        lastAction: null
      };
    }

    if (action.type === "guess") {
      const clue = state.clues.find((c) => c.number === action.clueNumber);
      if (!clue) return state;
      if (state.solvedClues[clue.number]) return state;

      const guess = action.guess.trim().toUpperCase();
      const correct = guess === clue.word.toUpperCase();
      const points = scoreForWord(clue.word, correct);
      const newScores = {
        ...state.scores,
        [playerId]: (state.scores[playerId] ?? 0) + points
      };

      const newSolved = {
        ...state.solvedClues,
        [clue.number]: { playerId, guess: correct ? clue.word : guess, correct }
      };

      // Check if all clues solved
      const allSolved = state.clues.every((c) => newSolved[c.number]?.correct);
      const nextIdx = (state.playerIds.indexOf(playerId) + 1) % state.playerIds.length;
      const nextPlayer = state.playerIds[nextIdx]!;
      const newRound = state.round + 1;

      let winnerId: string | null = null;
      let result: string | null = null;

      if (allSolved || newRound >= state.maxRounds) {
        const [p1, p2] = state.playerIds;
        const s1 = newScores[p1!] ?? 0;
        const s2 = newScores[p2!] ?? 0;
        if (s1 > s2) { winnerId = p1!; result = `${state.playerNames[p1!]} wins with ${s1} points!`; }
        else if (s2 > s1) { winnerId = p2!; result = `${state.playerNames[p2!]} wins with ${s2} points!`; }
        else { result = `Tie game — ${s1} points each!`; }
      }

      return {
        ...state,
        scores: newScores,
        solvedClues: newSolved,
        currentTurn: nextPlayer,
        round: newRound,
        winnerId,
        result,
        message: correct ? `Correct! +${points} points` : `"${guess}" is not the answer`,
        lastAction: { clueNumber: clue.number, playerId, guess, correct }
      };
    }

    return state;
  },

  checkGameOver(state) {
    if (state.winnerId) return { over: true, winnerId: state.winnerId };
    if (state.result) return { over: true };
    return { over: false };
  },

  getViewFor(state, playerId) {
    const opponents = state.playerIds
      .filter((id) => id !== playerId)
      .map((id) => ({ id, name: state.playerNames[id] ?? "Player" }));

    // Build revealed grid (only show solved words)
    const revealedGrid: (string | null)[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    for (const clue of state.clues) {
      const solved = state.solvedClues[clue.number];
      if (solved?.correct) {
        for (let i = 0; i < clue.word.length; i++) {
          if (clue.direction === "across") revealedGrid[clue.row]![clue.col + i] = clue.word[i]!;
          else revealedGrid[clue.row + i]![clue.col] = clue.word[i]!;
        }
      }
    }

    return {
      grid: state.grid,
      revealedGrid,
      clues: state.clues.map((c) => ({
        number: c.number,
        direction: c.direction,
        row: c.row,
        col: c.col,
        clue: c.clue,
        solved: state.solvedClues[c.number]?.correct ?? false,
        solvedBy: state.solvedClues[c.number]?.playerId ?? null,
        guessedWord: state.solvedClues[c.number]?.guess ?? null
      })),
      scores: state.scores,
      myScore: state.scores[playerId] ?? 0,
      opponents,
      currentTurn: state.currentTurn,
      isMyTurn: state.currentTurn === playerId,
      round: state.round,
      maxRounds: state.maxRounds,
      totalClues: state.clues.length,
      solvedCount: Object.values(state.solvedClues).filter((s) => s.correct).length,
      winnerId: state.winnerId,
      result: state.result,
      message: state.message,
      lastAction: state.lastAction,
      myId: playerId,
      playerNames: state.playerNames
    };
  }
};
