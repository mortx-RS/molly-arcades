import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface AyoView {
  board: number[];
  captures: Record<string, number>;
  currentTurn: string;
  isMyTurn: boolean;
  winnerId: string | null;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
  myStart: number;
  myEnd: number;
  /** Optional: pit the most recent move was sown from. Lets the opponent's move
   *  animate on your screen. Without it the board still updates + pulses. */
  lastMove?: { pit: number; player: string } | null;
}

interface Props {
  gameState: AyoView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}

interface Pt { x: number; y: number }
interface Flight { id: number; x0: number; y0: number; x1: number; y1: number; dur: number; delay: number; sz: number }

const GAP = 6;
const MIN_PIT = 34;
const MAX_PIT = 56;

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* ignore */ } }

// deterministic scatter so seeds sit naturally in the pit, away from the count chip
function seedPos(pit: number, i: number, size: number) {
  const h = (s: number) => {
    const v = Math.sin(pit * 127.1 + i * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const ang = h(1) * Math.PI * 2;
  const rr = (0.3 + 0.7 * h(2)) * size * 0.3;
  return {
    dx: Math.cos(ang) * rr,
    dy: Math.sin(ang) * rr - size * 0.1,
    rot: Math.round(h(3) * 360),
  };
}

// ─── Audio (tiny WebAudio synth, no assets) ──────────────────────────

class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private blip(freq: number, dur: number, vol: number, delay = 0, type: OscillatorType = "triangle") {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(freq: number, dur: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const n = Math.max(8, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(ctx.destination);
    src.start();
  }

  pickup() { this.noise(900, 0.08, 0.22); }
  tick(i: number) { this.blip(430 + Math.min(i, 28) * 22, 0.05, 0.14); }
  capture() { this.blip(920, 0.08, 0.2); this.blip(700, 0.1, 0.18, 0.07); this.blip(1180, 0.14, 0.14, 0.13); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.16, 0.2, i * 0.12)); }
  lose() { this.blip(330, 0.2, 0.18); this.blip(247, 0.3, 0.16, 0.18); }
}

function AnimatedNumber({ value, color, fontSize }: { value: number; color?: string; fontSize?: number }) {
  const [k, setK] = useState(0);
  useEffect(() => { setK((v) => v + 1); }, [value]);
  return <span key={k} className="ayo-pop" style={{ color, fontSize }}>{value}</span>;
}

const SoundIcon = ({ off }: { off: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    {off ? (
      <>
        <line x1="16" y1="9" x2="21" y2="15" />
        <line x1="21" y1="9" x2="16" y2="15" />
      </>
    ) : (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </>
    )}
  </svg>
);

// ─── Component ───────────────────────────────────────────────────────

export function AyoFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: Props) {
  // identity (view-first, room fallback) — resolved once
  const ids = Object.keys(gameState.playerNames ?? {});
  const oppId = ids.find((id) => id !== youId) ?? room.players.find((p) => p.id !== youId)?.id ?? "";
  const myName = gameState.playerNames?.[youId] ?? room.players.find((p) => p.id === youId)?.name ?? "You";
  const oppName = gameState.playerNames?.[oppId] ?? room.players.find((p) => p.id !== youId)?.name ?? "Opponent";

  // board geometry — works for any contiguous my-row, not just 0..5
  const N = gameState.board?.length ?? 12;
  const myStart = gameState.myStart;
  const myEnd = gameState.myEnd;
  const myRow: number[] = [];
  for (let p = myStart; p <= myEnd; p++) myRow.push(p);
  const oppRow: number[] = [];
  for (let p = myEnd + 1; p < N; p++) oppRow.push(p);
  for (let p = 0; p < myStart; p++) oppRow.push(p);
  const oppRowDisplay = [...oppRow].reverse();

  // responsive sizing
  const [pitSize, setPitSize] = useState(46);
  useEffect(() => {
    const calc = () => {
      const vw = Math.min(window.innerWidth, 580);
      const rowCount = myEnd - myStart + 1 || 6;
      const size = Math.floor((vw - 32 - 24 - GAP * (rowCount - 1) - 4) / rowCount);
      setPitSize(clamp(size, MIN_PIT, MAX_PIT));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [myStart, myEnd]);
  const seedSize = clamp(Math.round(pitSize * 0.17), 5, 8);
  const storeSize = Math.round(pitSize * 1.55);

  // refs mirrored every render (used inside async animation flows)
  const gsRef = useRef(gameState); gsRef.current = gameState;
  const gameOverRef = useRef(gameOver); gameOverRef.current = gameOver;
  const youIdRef = useRef(youId); youIdRef.current = youId;
  const oppIdRef = useRef(oppId); oppIdRef.current = oppId;
  const NRef = useRef(N); NRef.current = N;
  const sizeRef = useRef({ pit: pitSize, seed: seedSize }); sizeRef.current = { pit: pitSize, seed: seedSize };

  // render state
  const [displayBoard, setDisplayBoard] = useState<number[]>(() => (gameState.board ?? []).slice());
  const displayBoardRef = useRef(displayBoard);
  const [pulses, setPulses] = useState<Record<number, number>>({});
  const [ring, setRing] = useState<{ pit: number; t: number } | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [busy, setBusy] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("ayo_muted") === "1"; } catch { return false; }
  });
  const [shownCaptures, setShownCaptures] = useState(() => ({
    me: gameState.captures?.[youId] ?? 0,
    opp: gameState.captures?.[oppId] ?? 0,
  }));

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();

  // animation machinery
  const busyRef = useRef(false);
  const phaseRef = useRef<"none" | "sowing" | "waiting">("none");
  const pendingRef = useRef<number[] | null>(null);
  const moverStoreRef = useRef<"me" | "opp">("me");
  const lastServerRef = useRef<number[]>((gameState.board ?? []).slice());
  const lastServerKeyRef = useRef(JSON.stringify(gameState.board ?? []));
  const lastCapsKeyRef = useRef(JSON.stringify(gameState.captures ?? {}));
  const flightIdRef = useRef(0);
  const aliveRef = useRef(true);
  const timersRef = useRef<Set<number>>(new Set());

  // element refs (positions for the flying seed)
  const boardRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const pitElRef = useRef(new Map<number, HTMLElement>());
  const storeMeRef = useRef<HTMLDivElement | null>(null);
  const storeOppRef = useRef<HTMLDivElement | null>(null);

  // ── helpers ───────────────────────────────────────────────────────

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      if (aliveRef.current) fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const waitMs = useCallback((ms: number) => new Promise<void>((res) => { later(res, ms); }), [later]);

  const setBoard = useCallback((b: number[]) => {
    displayBoardRef.current = b;
    setDisplayBoard(b);
  }, []);

  const pulse = useCallback((pit: number) => {
    setPulses((p) => ({ ...p, [pit]: performance.now() }));
  }, []);

  const syncShownCaptures = useCallback(() => {
    const gs = gsRef.current;
    setShownCaptures({
      me: gs.captures?.[youIdRef.current] ?? 0,
      opp: gs.captures?.[oppIdRef.current] ?? 0,
    });
  }, []);

  const regPit = useCallback((pit: number) => (el: HTMLButtonElement | null) => {
    if (el) pitElRef.current.set(pit, el);
    else pitElRef.current.delete(pit);
  }, []);

  const relCenter = (el: HTMLElement, panel: HTMLElement): Pt => {
    const r = el.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    return { x: r.left - pr.left + r.width / 2, y: r.top - pr.top + r.height / 2 };
  };

  const pitCenter = useCallback((pit: number): Pt | null => {
    const el = pitElRef.current.get(pit);
    const panel = boardRef.current;
    if (!el || !panel) return null;
    return relCenter(el, panel);
  }, []);

  const storeCenter = useCallback((side: "me" | "opp"): Pt | null => {
    const el = side === "me" ? storeMeRef.current : storeOppRef.current;
    const panel = boardRef.current;
    if (!el || !panel) return null;
    return relCenter(el, panel);
  }, []);

  const moveHand = useCallback((x: number, y: number, ms: number) => {
    const h = handRef.current;
    if (!h) return;
    h.style.transition = ms > 0
      ? `left ${ms}ms cubic-bezier(.35,.15,.45,1), top ${ms}ms cubic-bezier(.35,.15,.45,1)`
      : "none";
    h.style.left = `${x}px`;
    h.style.top = `${y}px`;
  }, []);

  const showHand = useCallback((on: boolean) => {
    const h = handRef.current;
    if (h) h.style.opacity = on ? "1" : "0";
  }, []);

  const flyCaptures = useCallback((from: number[], to: number[], side: "me" | "opp") => {
    const sc = storeCenter(side);
    if (!sc) return;
    const sz = sizeRef.current.seed;
    const list: Flight[] = [];
    let delay = 0;
    for (let i = 0; i < to.length; i++) {
      const amt = (from[i] ?? 0) - (to[i] ?? 0);
      if (amt <= 0) continue;
      const pc = pitCenter(i);
      if (!pc) continue;
      pulse(i);
      for (let k = 0; k < Math.min(amt, 5); k++) {
        list.push({ id: flightIdRef.current++, x0: pc.x, y0: pc.y, x1: sc.x, y1: sc.y, dur: 420, delay, sz });
        delay += 60;
      }
    }
    if (list.length === 0) return;
    setFlights((f) => [...f, ...list]);
    for (const fl of list) {
      later(() => setFlights((f) => f.filter((x) => x.id !== fl.id)), fl.delay + fl.dur + 80);
    }
  }, [storeCenter, pitCenter, pulse, later]);

  const consumePending = useCallback(() => {
    if (phaseRef.current !== "waiting") return;
    const target = pendingRef.current;
    if (!target) return;
    pendingRef.current = null;
    const cur = displayBoardRef.current;
    let captured = 0;
    for (let i = 0; i < target.length; i++) {
      const d = (cur[i] ?? 0) - (target[i] ?? 0);
      if (d > 0) captured += d;
    }
    if (captured > 0) {
      flyCaptures(cur, target, moverStoreRef.current);
      sfxRef.current!.capture();
      vibrate([15, 60, 20]);
    }
    setBoard(target.slice());
    syncShownCaptures();
    phaseRef.current = "none";
    busyRef.current = false;
    setBusy(false);
  }, [flyCaptures, setBoard, syncShownCaptures]);

  const runSow = useCallback(async (pit: number, startBoard: number[], mover: "me" | "opp") => {
    const n = startBoard[pit] ?? 0;
    if (n <= 0) return;
    busyRef.current = true;
    setBusy(true);
    phaseRef.current = "sowing";
    moverStoreRef.current = mover;
    setRing({ pit, t: performance.now() });

    // pick up
    const b = startBoard.slice();
    b[pit] = 0;
    setBoard(b);
    sfxRef.current!.pickup();
    vibrate(10);
    const c0 = pitCenter(pit);
    if (c0) { showHand(true); moveHand(c0.x, c0.y, 0); }
    await waitMs(180);
    if (!aliveRef.current) return;

    // distribute one-by-one around the board
    const per = Math.max(70, Math.min(160, Math.round(1500 / n)));
    const Nn = NRef.current;
    let cur = pit;
    for (let i = 0; i < n; i++) {
      cur = (cur + 1) % Nn;
      const c = pitCenter(cur);
      if (c) moveHand(c.x, c.y, per);
      await waitMs(per);
      if (!aliveRef.current) return;
      const nb = displayBoardRef.current.slice();
      nb[cur] = (nb[cur] ?? 0) + 1;
      setBoard(nb);
      pulse(cur);
      sfxRef.current!.tick(i);
    }
    showHand(false);
    phaseRef.current = "waiting";
    consumePending();
  }, [pitCenter, moveHand, showHand, waitMs, setBoard, pulse, consumePending]);

  const handleSow = useCallback((pit: number) => {
    const gs = gsRef.current;
    if (!gs.isMyTurn || gameOverRef.current || busyRef.current) return;
    if (pit < gs.myStart || pit > gs.myEnd) return;
    const count = displayBoardRef.current[pit] ?? 0;
    if (count <= 0) return;

    sfxRef.current!.ensure();
    setHinted(true);
    onSubmitAction({ type: "sow", pit }); // protocol unchanged

    // optimistic animation; the server's board reconciles it (incl. captures)
    runSow(pit, displayBoardRef.current.slice(), "me");

    // failsafe: never lock input if the server never confirms this move
    later(() => {
      if (busyRef.current && phaseRef.current === "waiting") {
        if (pendingRef.current) consumePending();
        else {
          phaseRef.current = "none";
          busyRef.current = false;
          setBusy(false);
          setBoard(lastServerRef.current.slice());
        }
      }
    }, 6000);
  }, [onSubmitAction, runSow, consumePending, setBoard, later]);

  // ── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    sfxRef.current!.enabled = !muted;
    try { localStorage.setItem("ayo_muted", muted ? "1" : "0"); } catch { /* ignore */ }
  }, [muted]);

  // turn tracking (declared before the board effect so it runs first)
  const turnRef = useRef(gameState.currentTurn);
  useEffect(() => {
    if (gameState.currentTurn === turnRef.current) return;
    turnRef.current = gameState.currentTurn;
    // my move was a no-op (turn came straight back without a board change) → unlock
    if (gameState.isMyTurn && busyRef.current && phaseRef.current === "waiting" && !pendingRef.current) {
      phaseRef.current = "none";
      busyRef.current = false;
      setBusy(false);
    }
  }, [gameState.currentTurn, gameState.isMyTurn]);

  // server board adoption — the heart of the sync logic
  useEffect(() => {
    const b = gameState.board;
    if (!b || b.length === 0) return;
    const key = JSON.stringify(b);
    if (key === lastServerKeyRef.current) return;
    const prev = lastServerRef.current;
    lastServerKeyRef.current = key;
    lastServerRef.current = b.slice();
    pendingRef.current = b.slice();

    // an animation is in flight — it will consume this at its end
    if (busyRef.current) { consumePending(); return; }

    // opponent's move with a known origin → full sowing animation
    const lm = gameState.lastMove;
    if (lm && lm.player !== youId && prev && prev.length === b.length && (prev[lm.pit] ?? 0) > 0) {
      runSow(lm.pit, prev, "opp");
      return;
    }

    // fallback: snap to truth and highlight what changed
    setBoard(b.slice());
    syncShownCaptures();
    if (prev && prev.length === b.length) {
      const now = performance.now();
      const np: Record<number, number> = {};
      let best = -1;
      let bestD = 0;
      for (let i = 0; i < b.length; i++) {
        if ((prev[i] ?? 0) !== (b[i] ?? 0)) np[i] = now;
        const d = (prev[i] ?? 0) - (b[i] ?? 0);
        if (d > bestD) { bestD = d; best = i; }
      }
      if (Object.keys(np).length > 0) setPulses((p) => ({ ...p, ...np }));
      if (best >= 0) setRing({ pit: best, t: now });
      const capsKey = JSON.stringify(gameState.captures ?? {});
      if (capsKey !== lastCapsKeyRef.current) {
        lastCapsKeyRef.current = capsKey;
        sfxRef.current!.capture();
        vibrate([12, 50, 12]);
      }
    }
  }, [gameState.board, gameState.captures, consumePending, runSow, setBoard, syncShownCaptures]);

  useEffect(() => {
    if (!gameOver) return;
    busyRef.current = false;
    phaseRef.current = "none";
    setBusy(false);
    sfxRef.current!.ensure();
    if (gameOver.winnerId === youId) { sfxRef.current!.win(); vibrate([30, 60, 30, 60, 80]); }
    else if (gameOver.winnerId) { sfxRef.current!.lose(); vibrate(120); }
  }, [gameOver, youId]);

  useEffect(() => () => {
    aliveRef.current = false;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);

  // ── Render helpers ────────────────────────────────────────────────

  const renderPit = (pit: number) => {
    const seeds = displayBoard[pit] ?? 0;
    const my = pit >= myStart && pit <= myEnd;
    const playable = my && seeds > 0 && gameState.isMyTurn && !gameOver && !busy && !helpOpen;
    const maxDots = pitSize > 44 ? 10 : 7;
    const shown = Math.min(seeds, maxDots);
    const extra = seeds - shown;
    const pT = pulses[pit] ?? 0;
    return (
      <button
        key={pit}
        ref={regPit(pit)}
        className={`ayo-pit${my ? " mine" : ""}${playable ? " playable" : ""}`}
        disabled={!playable}
        aria-label={`Pit with ${seeds} seeds`}
        onClick={() => handleSow(pit)}
        style={{ width: pitSize, height: pitSize }}
      >
        {Array.from({ length: shown }).map((_, i) => {
          const { dx, dy, rot } = seedPos(pit, i, pitSize);
          return (
            <span key={i} className="ayo-seed" style={{
              width: seedSize, height: seedSize,
              left: `calc(50% + ${dx.toFixed(1)}px)`,
              top: `calc(50% + ${dy.toFixed(1)}px)`,
              transform: `translate(-50%, -50%) rotate(${rot}deg)`,
            }} />
          );
        })}
        {extra > 0 && (
          <span className="ayo-extra" style={{ fontSize: Math.max(7, Math.round(pitSize * 0.16)) }}>+{extra}</span>
        )}
        <span className="ayo-count" style={{ fontSize: Math.max(10, Math.round(pitSize * 0.28)), fontFamily: T.fontMono }}> {seeds} </span>
        {pT > 0 && <span key={`p${pT}`} className="ayo-pulse-ov" />}
        {ring && ring.pit === pit && <span key={`r${ring.t}`} className="ayo-ring-ov" />}
      </button>
    );
  };

  const renderStore = (side: "me" | "opp") => {
    const isMe = side === "me";
    const name = isMe ? myName : oppName;
    const val = isMe ? shownCaptures.me : shownCaptures.opp;
    const active = (isMe ? gameState.isMyTurn : !gameState.isMyTurn && oppId !== "") && !gameOver;
    return (
      <div
        ref={isMe ? storeMeRef : storeOppRef}
        className="ayo-store"
        style={{
          width: storeSize, height: storeSize,
          boxShadow: active
            ? `inset 0 4px 10px rgba(0,0,0,.85), 0 0 0 2px ${accent}88, 0 0 16px -4px ${accent}`
            : undefined,
        }}
      >
        <div style={{ fontFamily: T.fontMono, fontWeight: 800, lineHeight: 1 }}>
          <AnimatedNumber value={val} color={isMe ? accent : "#d8c9a8"} fontSize={Math.round(storeSize * 0.3)} />
        </div>
        <div style={{
          fontSize: 8, color: T.chalkMuted, marginTop: 2, maxWidth: storeSize - 6,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{name}</div>
      </div>
    );
  };

  const renderPlayerCard = (id: string, name: string, side: "me" | "opp") => {
    const active = gameState.currentTurn === id && !gameOver;
    const caps = side === "me" ? shownCaptures.me : shownCaptures.opp;
    const wins = (gameState.scores ?? {})[id] ?? 0;
    return (
      <div key={id} style={{
        flex: 1, display: "flex", alignItems: "center", gap: 8,
        padding: "7px 10px", borderRadius: 10,
        background: active ? `${accent}14` : `${T.chalk}05`,
        border: `1.5px solid ${active ? accent : "transparent"}`,
        boxShadow: active ? `0 0 12px ${accent}22` : "none",
        transition: "all .25s ease",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: active ? accent : T.chalkMuted,
          boxShadow: active ? `0 0 6px ${accent}` : "none",
        }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 700,
            color: active ? accent : T.chalkMuted,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {name}{side === "me" ? " (you)" : ""}
          </div>
          {wins > 0 && (
            <div style={{ fontSize: 8, color: T.chalkDim, letterSpacing: 0.5 }}>
              {"★".repeat(Math.min(wins, 5))}{wins > 5 ? ` ${wins}` : ""}
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: T.fontMono, fontWeight: 800, lineHeight: 1 }}>
            <AnimatedNumber value={caps} color={side === "me" ? accent : T.chalk} fontSize={17} />
          </div>
          <div style={{ fontSize: 7.5, color: T.chalkDim, letterSpacing: 0.6, marginTop: 1 }}>SEEDS</div>
        </div>
      </div>
    );
  };

  const won = gameOver?.winnerId === youId;
  const lost = gameOver?.winnerId === oppId;
  const myWins = (gameState.scores ?? {})[youId] ?? 0;
  const oppWins = (gameState.scores ?? {})[oppId] ?? 0;

  return (
    <div
      onPointerDown={() => sfxRef.current!.ensure()}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: "fixed", inset: 0, background: T.bgDeep, color: T.chalk,
        fontFamily: T.fontBody, display: "flex", flexDirection: "column", overflow: "hidden",
      }}
    >
      <style>{`
        .ayo-board { position: relative; border-radius: 18px; padding: 12px 12px 10px;
          background: linear-gradient(150deg, #5c4129, #4a3320 45%, #3b2817);
          border: 1px solid #2a1b0e;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.09), inset 0 -2px 6px rgba(0,0,0,.35), 0 18px 44px rgba(0,0,0,.55); }
        .ayo-grain { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: .5;
          background: repeating-linear-gradient(97deg, rgba(0,0,0,.05) 0 2px, rgba(255,255,255,.02) 2px 4px, transparent 4px 9px); }
        .ayo-rowlabel { font-size: 7.5px; letter-spacing: 1.5px; color: rgba(216,201,168,.4);
          text-align: center; margin: 1px 0 5px; font-weight: 700; }
        .ayo-pit { appearance: none; position: relative; border-radius: 50%; border: none; padding: 0;
          background: radial-gradient(circle at 50% 38%, #241708, #140c05 78%);
          box-shadow: inset 0 3px 8px rgba(0,0,0,.8), inset 0 -1px 0 rgba(255,255,255,.05), 0 1px 0 rgba(255,255,255,.06);
          transition: transform .15s ease, box-shadow .25s ease;
          touch-action: manipulation; -webkit-tap-highlight-color: transparent; cursor: default; }
        .ayo-pit.mine { background: radial-gradient(circle at 50% 38%, #291a0a, #170f06 78%); }
        .ayo-pit.playable { cursor: pointer;
          box-shadow: inset 0 3px 8px rgba(0,0,0,.8), 0 0 0 2px var(--acc), 0 0 16px -2px var(--acc); }
        .ayo-pit.playable:hover { transform: translateY(-2px); }
        .ayo-pit.playable:active { transform: scale(.93); }
        .ayo-seed { position: absolute; border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle at 35% 30%, #ead9b5, #c8ab7c 55%, #8a6a45);
          box-shadow: 0 1px 1px rgba(0,0,0,.45); }
        .ayo-count { position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);
          font-weight: 700; color: #d8c9a8; text-shadow: 0 1px 2px #000; pointer-events: none;
          background: rgba(10,7,3,.55); border-radius: 6px; padding: 0 4px; line-height: 1.25; }
        .ayo-extra { position: absolute; top: 2px; right: 4px; color: #b5a488; pointer-events: none; font-weight: 700; }
        .ayo-pulse-ov { position: absolute; inset: -3px; border-radius: 50%; pointer-events: none; opacity: 0;
          animation: ayo-pulse .5s ease; }
        .ayo-ring-ov { position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--acc);
          pointer-events: none; opacity: 0; animation: ayo-ring 1.8s ease forwards; }
        .ayo-fly { position: absolute; border-radius: 50%; pointer-events: none; z-index: 6;
          width: var(--sz); height: var(--sz); transform: translate(-50%, -50%);
          background: radial-gradient(circle at 35% 30%, #ead9b5, #c8ab7c 55%, #8a6a45);
          box-shadow: 0 1px 2px rgba(0,0,0,.5);
          left: var(--x0); top: var(--y0);
          animation: ayo-fly var(--dur) cubic-bezier(.4,.1,.5,1) var(--delay) forwards; }
        .ayo-hand { position: absolute; border-radius: 50%; pointer-events: none; z-index: 7; opacity: 0;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle at 35% 30%, #f4e6c4, #d4b98c 55%, #94714c);
          box-shadow: 0 2px 4px rgba(0,0,0,.5), 0 0 8px rgba(255,235,180,.25); }
        .ayo-store { border-radius: 50%; position: relative; flex-shrink: 0;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: radial-gradient(circle at 50% 38%, #241708, #140c05 78%);
          box-shadow: inset 0 4px 10px rgba(0,0,0,.85), inset 0 -1px 0 rgba(255,255,255,.06), 0 0 0 2px rgba(0,0,0,.25); }
        .ayo-pop { display: inline-block; animation: ayo-pop .3s ease; }
        .ayo-hint { animation: ayo-bounce 1.6s ease-in-out infinite; }
        .ayo-dot { animation: ayo-blink 1.2s ease-in-out infinite; }
        @keyframes ayo-pulse { 0% { opacity: .9; transform: scale(.82); } 60% { opacity: .4; } 100% { opacity: 0; transform: scale(1.12); } }
        @keyframes ayo-ring { 0% { opacity: .85; transform: scale(.9); } 70% { opacity: .35; } 100% { opacity: 0; transform: scale(1.12); } }
        @keyframes ayo-fly { from { left: var(--x0); top: var(--y0); opacity: 1; } to { left: var(--x1); top: var(--y1); opacity: .15; } }
        @keyframes ayo-pop { 0% { transform: scale(1.45); } 100% { transform: scale(1); } }
        @keyframes ayo-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes ayo-blink { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
        @keyframes ayo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ayo-card { from { opacity: 0; transform: scale(.92) translateY(12px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Header */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", background: T.charcoal, borderBottom: `1px solid ${T.line}`,
      }}>
        <button onClick={onLeave} aria-label="Leave game" style={{
          ...T.glass(), color: T.chalk, width: 36, height: 36, borderRadius: 10, fontSize: 18,
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none",
        }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{gameName || "Ayo"}</div>
          <div style={{ fontSize: 9.5, color: T.chalkMuted }}>capture the most seeds</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setHelpOpen(true)} aria-label="How to play" style={{
            ...T.glass(), color: T.chalk, width: 36, height: 36, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none",
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 15,
          }}>?</button>
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} style={{
            ...T.glass(), color: muted ? T.chalkMuted : T.chalk, width: 36, height: 36, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "none",
          }}>
            <SoundIcon off={muted} />
          </button>
        </div>
      </div>

      {/* Scoreboard */}
      <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "8px 12px 4px" }}>
        {renderPlayerCard(youId, myName, "me")}
        {renderPlayerCard(oppId, oppName, "opp")}
      </div>

      {/* Turn banner */}
      {!gameOver && (
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          padding: "4px 12px", minHeight: 24,
        }}>
          {gameState.isMyTurn ? (
            <>
              <span className="ayo-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
              <span style={{ fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 600, color: T.green }}>
                Your turn — tap one of your glowing pits
              </span>
            </>
          ) : (
            <>
              <span className="ayo-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              <span style={{ fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 600, color: T.chalkMuted }}>
                {busy ? `${oppName} is sowing…` : `${oppName}'s turn…`}
              </span>
            </>
          )}
        </div>
      )}

      {/* Board */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "4px 14px calc(8px + env(safe-area-inset-bottom, 0px))", minHeight: 0,
      }}>
        <div ref={boardRef} className="ayo-board" style={{ "--acc": accent } as CSSProperties}>
          <div className="ayo-grain" />
          <div className="ayo-rowlabel">{oppName.toUpperCase()}</div>
          <div style={{ display: "flex", gap: GAP, position: "relative" }}>
            {oppRowDisplay.map(renderPit)}
          </div>

          {/* stores + sowing direction */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 2px" }}>
            {renderStore("opp")}
            <div title="Seeds flow counterclockwise" style={{ opacity: 0.45, flexShrink: 0 }}>
              <svg width={Math.round(pitSize * 0.75)} height={Math.round(pitSize * 0.75)} viewBox="0 0 24 24" fill="none" stroke="#d8c9a8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4.5 A7.5 7.5 0 1 0 5.6 15.6" />
                <path d="M9.2 16.5 L5.6 15.6 L6.6 12.2" />
              </svg>
            </div>
            {renderStore("me")}
          </div>

          <div style={{ display: "flex", gap: GAP, position: "relative" }}>
            {myRow.map(renderPit)}
          </div>
          <div className="ayo-rowlabel" style={{ margin: "5px 0 1px" }}>YOU</div>

          {flights.map((f) => (
            <span key={f.id} className="ayo-fly" style={{
              "--x0": `${f.x0}px`, "--y0": `${f.y0}px`, "--x1": `${f.x1}px`, "--y1": `${f.y1}px`,
              "--dur": `${f.dur}ms`, "--delay": `${f.delay}ms`, "--sz": `${f.sz}px`,
            } as CSSProperties} />
          ))}
          <div ref={handRef} className="ayo-hand" style={{ width: seedSize + 2, height: seedSize + 2 }} />
        </div>

        {!hinted && gameState.isMyTurn && !gameOver && !busy && (
          <div className="ayo-hint" style={{
            marginTop: 12, padding: "5px 14px", background: "rgba(0,0,0,.55)",
            border: `1px solid ${T.line}`, borderRadius: 999, fontSize: 10, color: T.chalk,
          }}>
            Tap one of your glowing pits to sow
          </div>
        )}
      </div>

      {/* Help modal */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{
          position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          animation: "ayo-fade .2s ease", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 340, width: "100%", background: T.charcoal, border: `1px solid ${T.line}`,
            borderRadius: 16, padding: "20px 22px", animation: "ayo-card .3s cubic-bezier(.18,.9,.28,1.15)",
          }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 800, marginBottom: 12 }}>How to play Ayo</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: T.chalkMuted, lineHeight: 1.7 }}>
              <li>You own the <b style={{ color: T.chalk }}>bottom row</b>. Tap one of your pits to sow its seeds one-by-one <b style={{ color: T.chalk }}>counterclockwise</b>.</li>
              <li>If your <b style={{ color: T.chalk }}>last seed</b> lands in an opponent's pit bringing it to <b style={{ color: T.chalk }}>2 or 3</b>, you capture those seeds — and keep capturing backward through consecutive 2s and 3s.</li>
              <li>Captured seeds fly into your store (right bowl).</li>
              <li>When either row empties, the game ends and the remaining seeds go to that row's owner. Most captured seeds wins.</li>
            </ul>
            <button onClick={() => setHelpOpen(false)} style={{
              marginTop: 16, width: "100%", padding: "10px 0", ...T.btn, ...T.btnPrimary(accent),
              fontSize: 12, fontWeight: 700,
            }}>Got it</button>
          </div>
        </div>
      )}

      {/* Game over */}
      {gameOver && (
        <div style={{
          position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          animation: "ayo-fade .25s ease",
        }}>
          <div style={{
            textAlign: "center", padding: "28px 34px", background: T.charcoal,
            border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)",
            animation: "ayo-card .4s cubic-bezier(.18,.9,.28,1.2)",
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", margin: "0 auto 14px",
              background: "radial-gradient(circle at 35% 30%, #ead9b5, #c8ab7c 55%, #8a6a45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 10px 24px rgba(0,0,0,.5)",
              color: "#3a2a18", fontFamily: T.fontMono, fontWeight: 800, fontSize: 24,
            }}>{shownCaptures.me}</div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 25, fontWeight: 800, letterSpacing: 0.5,
              color: won ? T.green : lost ? T.pink : T.chalk, marginBottom: 6,
            }}>
              {won ? "Victory" : lost ? "Defeat" : "Draw"}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkDim, marginBottom: 4 }}>
              You {shownCaptures.me} · {shownCaptures.opp} {oppName}
            </div>
            {(myWins > 0 || oppWins > 0) && (
              <div style={{ fontSize: 10, color: T.chalkMuted, marginBottom: 2 }}>Match · {myWins}–{oppWins}</div>
            )}
            <button onClick={onLeave} style={{
              marginTop: 18, padding: "11px 30px", ...T.btn, ...T.btnPrimary(accent), fontSize: 13, fontWeight: 700,
            }}>Back to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}
