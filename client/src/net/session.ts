export interface Session {
  roomId: string;
  playerId: string;
  playerName: string;
  gameType: string;
}

const KEY = "molly.session.v1";
const NAME_KEY = "molly.playerName";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Session>;
    if (
      typeof s.roomId !== "string" ||
      typeof s.playerId !== "string" ||
      typeof s.gameType !== "string"
    ) {
      return null;
    }
    return {
      roomId: s.roomId,
      playerId: s.playerId,
      gameType: s.gameType,
      playerName: typeof s.playerName === "string" ? s.playerName : "Player"
    };
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearSession(): void {
  localStorage.removeItem(KEY);
}

export function loadLastName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function saveLastName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
