import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AckResult, ClientMessage, CreatedRoomPayload, JoinedRoomPayload } from "../../../shared/protocol";
import type { Room } from "../../../shared/types";
import { RoomSocket, type SockStatus } from "./RoomSocket";
import { clearSession, loadSession, saveSession, type Session } from "./session";

export type NetStatus = "offline" | "connecting" | "connected" | "reconnecting";

interface RoomApi {
  session: Session | null;
  room: Room | null;
  you: string | null;
  gameState: unknown;
  gameOver: { winnerId?: string } | null;
  status: NetStatus;
  notice: string | null;
  dismissNotice(): void;
  createRoom(gameType: string, playerName: string): Promise<boolean>;
  joinRoom(roomCode: string, playerName: string): Promise<boolean>;
  leaveRoom(): void;
  startGame(): void;
  submitAction(action: unknown): void;
}

export function useRoom(): RoomApi {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [room, setRoom] = useState<Room | null>(null);
  const [you, setYou] = useState<string | null>(null);
  const [sockStatus, setSockStatus] = useState<SockStatus>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [gameOver, setGameOver] = useState<{ winnerId?: string } | null>(null);
  const sessionRef = useRef<Session | null>(session);
  const sockRef = useRef<RoomSocket | null>(null);

  function applyCleared(): void {
    sessionRef.current = null;
    setSession(null);
    setRoom(null);
    setYou(null);
  }

  if (!sockRef.current) {
    sockRef.current = new RoomSocket(
      () => sessionRef.current,
      {
        onRoomState(next, youId) {
          setRoom(next);
          setYou(youId);
          if (next.status !== "in-progress") {
            setGameState(null);
            setGameOver(null);
          }
          const s = sessionRef.current;
          if (s && s.gameType !== next.gameType) {
            const updated = { ...s, gameType: next.gameType };
            sessionRef.current = updated;
            setSession(updated);
          }
        },
        onPlayerLeft() {},
        onGameState(state, youId) {
          setGameState(state);
          setYou(youId);
        },
        onGameOver(winnerId) {
          setGameOver({ winnerId });
        },
        onSessionDead(reason) {
          applyCleared();
          setNotice(describeDeath(reason));
        },
        onRoomClosed(reason) {
          applyCleared();
          setNotice(reason === "idle-timeout" ? "The room expired after 30 minutes idle." : "The room was closed.");
        },
        onError(message) {
          setNotice(message);
        },
        onStatus(status) {
          setSockStatus(status);
        }
      }
    );
  }

  useEffect(() => {
    sessionRef.current = session;
    if (session) saveSession(session);
    else clearSession();
  }, [session]);

  useEffect(() => {
    const sock = sockRef.current!;
    sock.start();
    const poke = () => sock.poke();
    const onVisibility = () => {
      if (!document.hidden) poke();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", poke);
    window.addEventListener("online", poke);
    window.addEventListener("pageshow", poke);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", poke);
      window.removeEventListener("online", poke);
      window.removeEventListener("pageshow", poke);
    };
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  const createRoom = useCallback(async (gameType: string, playerName: string): Promise<boolean> => {
    const name = playerName.trim() || "Player";
    let result: AckResult<CreatedRoomPayload>;
    try {
      result = await requestWhenOpen<CreatedRoomPayload>({ type: "room:create", gameType, playerName: name });
    } catch {
      setNotice("Could not reach the server. Try again.");
      return false;
    }
    if (!result.ok || !isCreatedPayload(result.data)) {
      setNotice(result.ok ? "Unexpected server response." : describeAckError(result.error));
      return false;
    }
    applySession({
      roomId: result.data.roomId,
      playerId: result.data.playerId,
      gameType: result.data.gameType,
      playerName: name
    });
    return true;
  }, []);

  const joinRoom = useCallback(async (roomCode: string, playerName: string): Promise<boolean> => {
    const name = playerName.trim() || "Player";
    const code = roomCode.trim().toUpperCase();
    if (!code) {
      setNotice("Enter a room code first.");
      return false;
    }
    let result: AckResult<JoinedRoomPayload>;
    try {
      result = await requestWhenOpen<JoinedRoomPayload>({ type: "room:join", roomId: code, playerName: name });
    } catch {
      setNotice("Could not reach the server. Try again.");
      return false;
    }
    if (!result.ok || !isJoinedPayload(result.data)) {
      setNotice(result.ok ? "Unexpected server response." : describeAckError(result.error));
      return false;
    }
    applySession({
      roomId: result.data.roomId,
      playerId: result.data.playerId,
      gameType: "",
      playerName: name
    });
    return true;
  }, []);

  function applySession(next: Session): void {
    sessionRef.current = next;
    setSession(next);
  }

  async function requestWhenOpen<T>(msg: ClientMessage): Promise<AckResult<T>> {
    return sockRef.current!.requestWhenOpen<T>(msg);
  }

  const leaveRoom = useCallback((): void => {
    if (sessionRef.current) {
      sockRef.current!.requestWhenOpen({ type: "room:leave" }).catch(() => {});
    }
    applyCleared();
  }, []);

  const startGame = useCallback((): void => {
    sockRef.current!.requestWhenOpen({ type: "game:start" }).catch(() => {});
  }, []);

  const submitAction = useCallback((action: unknown): void => {
    const s = sessionRef.current;
    if (!s) return;
    sockRef.current!.requestWhenOpen({ type: "game:action", roomId: s.roomId, action }).catch(() => {});
  }, []);

  const status: NetStatus = useMemo(() => {
    if (!session) return "offline";
    if (sockStatus === "open") return "connected";
    if (sockStatus === "connecting") return "connecting";
    return "reconnecting";
  }, [session, sockStatus]);

  return { session, room, you, gameState, gameOver, status, notice, dismissNotice, createRoom, joinRoom, leaveRoom, startGame, submitAction };
}

function isCreatedPayload(d: unknown): d is CreatedRoomPayload {
  const p = d as Partial<CreatedRoomPayload> | undefined;
  return !!p && typeof p.roomId === "string" && typeof p.playerId === "string" && typeof p.gameType === "string";
}

function isJoinedPayload(d: unknown): d is JoinedRoomPayload {
  const p = d as Partial<JoinedRoomPayload> | undefined;
  return !!p && typeof p.roomId === "string" && typeof p.playerId === "string";
}

function describeAckError(code: string): string {
  switch (code) {
    case "room_not_found": return "That room doesn't exist (or it expired).";
    case "room_full": return "That room is full.";
    case "room_in_progress": return "That match already started.";
    case "player_unknown": return "Your seat in that room is gone.";
    default: return `Something went wrong (${code}).`;
  }
}

function describeDeath(code: string): string {
  switch (code) {
    case "room_not_found": return "Your room no longer exists.";
    case "player_unknown": return "Your seat was reclaimed by someone else.";
    default: return `Disconnected permanently (${code}).`;
  }
}
