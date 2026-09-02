import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface LudoToken {
  id: number;
  position: number;
  home: boolean;
  finished: boolean;
}

/** One playable move: token `tokenId` advances `steps` and consumes `die` (0 or 1). */
export interface LudoMoveOption {
  tokenId: number;
  die: 0 | 1;
  steps: number;
}

export interface LudoView {
  tokens: Record<string, LudoToken[]>;
  currentTurn: string;
  isMyTurn: boolean;
  dice: [number | null, number | null];
  diceUsed: [boolean, boolean];
  winnerId: string | null;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
  legalMoves: LudoMoveOption[];
}

interface Props {
  gameState: LudoView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}

/* ─── POSITION SEMANTICS (same as before) ─────────────────────────────
 * home===true or position < 0 → base · 0..50 ring steps from own start
 * (set RELATIVE=false for absolute ring indices) · 51..55 home column
 * 56 / finished → home. ──────────────────────────────────────────────── */

const RELATIVE = true;

const N = 15;
const SEAT_COLORS = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];

const RING: [number, number][] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],
  [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],
  [7, 14],
  [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],
  [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],
  [14, 7],
  [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],
  [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
  [7, 0],
  [6, 0],
];

const START_IDX = [0, 13, 26, 39];
const SAFE_IDX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const HOME_COL: [number, number][][] = [
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
];

const BASE_SLOTS: [number, number][][] = [
  [[1.9, 1.9], [4.1, 1.9], [1.9, 4.1], [4.1, 4.1]],
  [[10.9, 1.9], [13.1, 1.9], [10.9, 4.1], [13.1, 4.1]],
  [[10.9, 10.9], [13.1, 10.9], [10.9, 13.1], [13.1, 13.1]],
  [[1.9, 10.9], [4.1, 10.9], [1.9, 13.1], [4.1, 13.1]],
];

const BASE_RECT = [
  { left: 0, top: 0 }, { left: 9, top: 0 }, { left: 9, top: 9 }, { left: 0, top: 9 },
];

const FINISH = [
  { x: 6.82, y: 7.5, dx: 0, dy: 1 },
  { x: 7.5, y: 6.82, dx: 1, dy: 0 },
  { x: 8.18, y: 7.5, dx: 0, dy: 1 },
  { x: 7.5, y: 8.18, dx: 1, dy: 0 },
];

// ─── helpers ─────────────────────────────────────────────────────────

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* ignore */ } }

function normPos(t: LudoToken): number {
  if (t.finished || (t.position ?? -1) >= 56) return 56;
  if ((t.position ?? -1) < 0) return -1;
  if (t.home === true && t.position === 0) return -1;
  return t.position;
}

function cellFor(seat: number, pos: number, tokenId: number): { x: number; y: number } {
  if (pos < 0) { const s = BASE_SLOTS[seat]![tokenId % 4]!; return { x: s[0], y: s[1] }; }
  if (pos <= 50) {
    const idx = (((RELATIVE ? START_IDX[seat]! + pos : pos) % 52) + 52) % 52;
    const [r, c] = RING[idx]!;
    return { x: c + 0.5, y: r + 0.5 };
  }
  if (pos <= 55) { const [r, c] = HOME_COL[seat]![pos - 51]!; return { x: c + 0.5, y: r + 0.5 }; }
  const f = FINISH[seat]!;
  const off = (tokenId - 1.5) * 0.4;
  return { x: f.x + f.dx * off, y: f.y + f.dy * off };
}

type StepKind = "tick" | "capture" | "deploy" | "home" | "glide";
interface Step { x: number; y: number; kind: StepKind }

function pathBetween(seat: number, oldT: LudoToken, newT: LudoToken): Step[] {
  const o = normPos(oldT);
  const n = normPos(newT);
  if (n === o) return [];
  if (n < 0) {
    if (o < 0) return [];
    const c = cellFor(seat, -1, newT.id);
    return [{ ...c, kind: o >= 51 ? "glide" : "capture" }];
  }
  if (o < 0) return [{ ...cellFor(seat, n, newT.id), kind: "deploy" }];
  if (n <= o) return [{ ...cellFor(seat, n, newT.id), kind: "glide" }];
  const steps: Step[] = [];
  for (let p = o + 1; p <= n; p++) {
    steps.push({ ...cellFor(seat, p, newT.id), kind: p === n && n >= 56 ? "home" : "tick" });
  }
  return steps;
}

// ─── Audio ───────────────────────────────────────────────────────────

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

  private noise(freq: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const n = Math.max(8, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(ctx.currentTime + delay);
  }

  rattle() { for (let i = 0; i < 6; i++) this.noise(1500 + Math.random() * 700, 0.035, 0.15, i * 0.06); }
  land(mine: boolean) { if (mine) this.blip(240, 0.07, 0.2, 0, "sine"); else this.rattle(); }
  doubles() { this.blip(880, 0.08, 0.16); this.blip(1320, 0.11, 0.14, 0.09); }
  tick(i: number) { this.blip(390 + Math.min(i, 18) * 24, 0.045, 0.11); }
  deploy() { this.blip(500, 0.07, 0.15); this.blip(700, 0.09, 0.13, 0.07); }
  capture() { this.blip(320, 0.1, 0.2, 0, "square"); this.blip(210, 0.16, 0.16, 0.09, "sawtooth"); }
  home() { [660, 880, 1175].forEach((f, i) => this.blip(f, 0.12, 0.15, i * 0.08)); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.16, 0.2, i * 0.12)); }
  lose() { this.blip(330, 0.2, 0.18); this.blip(247, 0.3, 0.16, 0.18); }
}

// ─── 3D dice ─────────────────────────────────────────────────────────

const FACE_ROT: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 }, 2: { x: 90, y: 0 }, 3: { x: 0, y: -90 },
  4: { x: 0, y: 90 }, 5: { x: -90, y: 0 }, 6: { x: 0, y: 180 },
};
const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

const norm360 = (d: number) => ((d % 360) + 360) % 360;

function Dice3D({ value, rollId, spinning, size = 52 }: { value: number | null; rollId: number; spinning: boolean; size?: number }) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef({ x: -22, y: 28 });
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const half = size / 2;

  const apply = useCallback(() => {
    const el = cubeRef.current;
    if (el) el.style.transform = `rotateX(${rotRef.current.x}deg) rotateY(${rotRef.current.y}deg)`;
  }, []);

  useEffect(() => {
    if (!spinning) return;
    const el = cubeRef.current;
    if (!el) return;
    el.style.transition = "none";
    lastRef.current = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - lastRef.current);
      lastRef.current = now;
      rotRef.current.x += dt * 0.5;
      rotRef.current.y += dt * 0.34;
      apply();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, apply]);

  useEffect(() => {
    if (value == null || spinning) return;
    const el = cubeRef.current;
    if (!el) return;
    const base = FACE_ROT[value] ?? FACE_ROT[1]!;
    const cur = rotRef.current;
    rotRef.current = {
      x: cur.x + 720 + norm360(base.x - cur.x),
      y: cur.y + 720 + norm360(base.y - cur.y),
    };
    el.style.transition = "transform 1s cubic-bezier(.15,.7,.25,1.02)";
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollId]);

  useEffect(() => {
    if (value != null || spinning) return;
    const el = cubeRef.current;
    if (!el) return;
    const sx = ((-22 - rotRef.current.x) % 360 + 540) % 360 - 180;
    const sy = ((28 - rotRef.current.y) % 360 + 540) % 360 - 180;
    rotRef.current = { x: rotRef.current.x + sx, y: rotRef.current.y + sy };
    el.style.transition = "transform .55s ease";
    apply();
  }, [value, spinning, apply]);

  const faceT: Record<number, string> = {
    1: `translateZ(${half}px)`,
    2: `rotateX(-90deg) translateZ(${half}px)`,
    3: `rotateY(90deg) translateZ(${half}px)`,
    4: `rotateY(-90deg) translateZ(${half}px)`,
    5: `rotateX(90deg) translateZ(${half}px)`,
    6: `rotateY(180deg) translateZ(${half}px)`,
  };

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ width: "100%", height: "100%", perspective: size * 4 }}>
        <div
          ref={cubeRef}
          style={{
            position: "relative", width: "100%", height: "100%",
            transformStyle: "preserve-3d",
            transform: "rotateX(-22deg) rotateY(28deg)",
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((f) => (
            <div key={f} style={{
              position: "absolute", inset: 0,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)",
              padding: size * 0.13, gap: size * 0.03,
              borderRadius: size * 0.18,
              background: "linear-gradient(145deg, #fdfdf6, #e9e6da)",
              boxShadow: "inset 0 0 0 1px rgba(0,0,0,.09), inset 0 -4px 8px rgba(0,0,0,.1)",
              transform: faceT[f],
              backfaceVisibility: "hidden",
            }}>
              {Array.from({ length: 9 }).map((_, i) => {
                const on = PIPS[f]!.includes(i);
                return (
                  <span key={i} style={{
                    alignSelf: "center", justifySelf: "center",
                    width: on ? size * 0.15 : 0, height: on ? size * 0.15 : 0,
                    borderRadius: "50%", background: "#25252a",
                    boxShadow: on ? "inset 0 1px 2px rgba(0,0,0,.5)" : "none",
                  }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{
        position: "absolute", left: "12%", right: "12%", bottom: -6, height: 6,
        borderRadius: "50%", background: "rgba(0,0,0,.4)", filter: "blur(3px)",
      }} />
    </div>
  );
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

export function LudoFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: Props) {
  // normalize the view — accepts the new 2-dice payload AND the legacy
  // single-dice shape ({dice: number, legalMoves: number[]}) during migration
  const raw = gameState as unknown as { dice?: unknown; diceUsed?: unknown; legalMoves?: unknown };

  const dice: [number | null, number | null] = useMemo(() => {
    const d = raw.dice;
    if (Array.isArray(d)) return [typeof d[0] === "number" ? d[0] : null, typeof d[1] === "number" ? d[1] : null];
    return [typeof d === "number" ? d : null, null];
  }, [raw.dice]);

  const diceUsed: [boolean, boolean] = useMemo(() => {
    const u = raw.diceUsed;
    if (Array.isArray(u)) return [!!u[0], !!u[1]];
    return [false, false];
  }, [raw.diceUsed]);

  const options: LudoMoveOption[] = useMemo(() => {
    const rm = raw.legalMoves;
    if (!Array.isArray(rm) || rm.length === 0) return [];
    if (typeof rm[0] === "object" && rm[0] !== null) return rm as LudoMoveOption[];
    // legacy: token ids → options on the first unused die
    const firstUnused: 0 | 1 = !diceUsed[0] ? 0 : 1;
    const steps = dice[firstUnused] ?? 0;
    return (rm as unknown[]).filter((x): x is number => typeof x === "number")
      .map((tid) => ({ tokenId: tid, die: firstUnused, steps }));
  }, [raw.legalMoves, dice, diceUsed]);

  const gsRef = useRef(gameState); gsRef.current = gameState;
  const gameOverRef = useRef(gameOver); gameOverRef.current = gameOver;
  const actionRef = useRef(onSubmitAction); actionRef.current = onSubmitAction;
  const normRef = useRef({ dice, diceUsed, options, isMyTurn: gameState.isMyTurn, turn: gameState.currentTurn });
  normRef.current = { dice, diceUsed, options, isMyTurn: gameState.isMyTurn, turn: gameState.currentTurn };

  const players = useMemo(() => {
    const rp = room?.players?.filter((p) => p?.id) ?? [];
    if (rp.length) return rp.map((p) => ({ id: p.id, name: p.name }));
    return Object.entries(gameState.playerNames ?? {}).map(([id, name]) => ({ id, name }));
  }, [room, gameState.playerNames]);

  const seatOfPlayer = useCallback((pid: string): number => {
    const idx = players.findIndex((p) => p.id === pid);
    if (idx < 0) return 0;
    return players.length === 2 ? (idx === 0 ? 0 : 2) : idx % 4;
  }, [players]);

  const occupiedSeats = useMemo(() => {
    const s = new Set<number>();
    for (const p of players) s.add(seatOfPlayer(p.id));
    for (const pid of Object.keys(gameState.tokens ?? {})) s.add(seatOfPlayer(pid));
    return s;
  }, [players, seatOfPlayer, gameState.tokens]);

  // board sizing
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(340);
  useEffect(() => {
    const calc = () => {
      const el = boardWrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      setBoardPx(Math.max(200, Math.floor(Math.min(r.width, r.height) - 8)));
    };
    calc();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && boardWrapRef.current) {
      ro = new ResizeObserver(calc);
      ro.observe(boardWrapRef.current);
    }
    window.addEventListener("resize", calc);
    return () => { window.removeEventListener("resize", calc); ro?.disconnect(); };
  }, []);

  const cellPx = boardPx / N;
  const px = (v: number) => v * cellPx;

  // state
  const [visual, setVisual] = useState<Record<string, { x: number; y: number; fly?: boolean; scale?: number }>>({});
  const [animatingKeys, setAnimatingKeys] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<{ key: string; t: number } | null>(null);
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [chooser, setChooser] = useState<{ tokenId: number; opts: LudoMoveOption[]; x: number; y: number } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("ludo_muted") === "1"; } catch { return false; }
  });

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();

  const rollingRef = useRef(false);
  const aliveRef = useRef(true);
  const timersRef = useRef<Set<number>>(new Set());
  const animTimersRef = useRef<Map<string, number[]>>(new Map());
  const prevTokensRef = useRef<Record<string, LudoToken[]> | null>(null);
  const lastRollKeyRef = useRef<string | null>(null);
  const autopassRef = useRef<string | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timersRef.current.delete(id); if (aliveRef.current) fn(); }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  // ── token movement animation ───────────────────────────────────────

  const animateToken = useCallback((pid: string, seat: number, oldT: LudoToken, newT: LudoToken) => {
    const key = `${pid}:${newT.id}`;
    const prev = animTimersRef.current.get(key);
    if (prev) prev.forEach((id) => { window.clearTimeout(id); timersRef.current.delete(id); });

    const steps = pathBetween(seat, oldT, newT);
    if (steps.length === 0) return;

    const ids: number[] = [];
    animTimersRef.current.set(key, ids);
    setAnimatingKeys((k) => new Set(k).add(key));

    const per = Math.max(95, Math.min(185, 1600 / steps.length));
    steps.forEach((st, i) => {
      ids.push(later(() => {
        setVisual((v) => ({ ...v, [key]: { x: st.x, y: st.y, fly: st.kind !== "tick" } }));
        if (st.kind === "tick") { sfxRef.current!.tick(i); vibrate(6); }
        else if (st.kind === "capture") {
          sfxRef.current!.capture();
          vibrate([25, 50, 25]);
          const t = performance.now();
          setFlash({ key, t });
          later(() => setFlash((f) => (f && f.t === t ? null : f)), 700);
        } else if (st.kind === "deploy") { sfxRef.current!.deploy(); vibrate(10); }
      }, i * per));
    });

    const lastKind = steps[steps.length - 1]!.kind;
    ids.push(later(() => {
      if (lastKind === "home") { sfxRef.current!.home(); vibrate([15, 40, 15]); }
      setAnimatingKeys((k) => { const s = new Set(k); s.delete(key); return s; });
    }, steps.length * per + 320));
  }, [later]);

  useEffect(() => {
    const tokens = gameState.tokens ?? {};
    const prev = prevTokensRef.current;
    prevTokensRef.current = Object.fromEntries(
      Object.entries(tokens).map(([k, v]) => [k, (v ?? []).map((t) => ({ ...t }))])
    );
    if (!prev) return;
    for (const pid of Object.keys(tokens)) {
      const seat = seatOfPlayer(pid);
      for (const nt of tokens[pid] ?? []) {
        const ot = (prev[pid] ?? []).find((t) => t.id === nt.id);
        if (!ot) continue;
        if (ot.position === nt.position && ot.home === nt.home && ot.finished === nt.finished) continue;
        animateToken(pid, seat, ot, nt);
      }
    }
  }, [gameState.tokens, seatOfPlayer, animateToken]);

  // ── dice arrival / cleared ─────────────────────────────────────────

  const rollKey = dice[0] != null || dice[1] != null
    ? `${gameState.currentTurn}|${dice[0]},${dice[1]}`
    : null;

  useEffect(() => {
    if (rollKey != null && rollKey !== lastRollKeyRef.current) {
      lastRollKeyRef.current = rollKey;
      rollingRef.current = false;
      setRolling(false);
      setRollId((r) => r + 1);
      sfxRef.current!.land(gameState.isMyTurn);
      if (dice[0] != null && dice[0] === dice[1]) sfxRef.current!.doubles();
      vibrate(10);
    } else if (rollKey == null && lastRollKeyRef.current != null) {
      lastRollKeyRef.current = null;
      rollingRef.current = false;
      setRolling(false);
    }
  }, [rollKey, gameState.isMyTurn, dice]);

  // ── auto-pass: "my turn + dice showing + zero options" → pass once ──
  // This both ends a legit no-moves turn AND recovers from a server that
  // forgot to clear the dice when the turn changed (the stuck bug).
  const stuckKey = gameState.isMyTurn && (dice[0] != null || dice[1] != null) && options.length === 0
    ? `${gameState.currentTurn}|${dice[0]},${dice[1]}|${diceUsed[0]},${diceUsed[1]}`
    : null;

  useEffect(() => {
    if (!stuckKey || autopassRef.current === stuckKey) return;
    autopassRef.current = stuckKey;
    const stillStuck = () => {
      const n = normRef.current;
      return n.isMyTurn && (n.dice[0] != null || n.dice[1] != null) && n.options.length === 0;
    };
    later(() => { if (stillStuck()) actionRef.current({ type: "move", tokenId: -1 }); }, 800);
    later(() => { if (stillStuck()) actionRef.current({ type: "move", tokenId: -1 }); }, 3400); // one retry
  }, [stuckKey, later]);

  // close any die-chooser whenever the option set changes
  const optionsKey = useMemo(() => JSON.stringify(options), [options]);
  useEffect(() => { setChooser(null); }, [optionsKey]);

  useEffect(() => {
    sfxRef.current!.enabled = !muted;
    try { localStorage.setItem("ludo_muted", muted ? "1" : "0"); } catch { /* ignore */ }
  }, [muted]);

  useEffect(() => {
    if (!gameOver) return;
    sfxRef.current!.ensure();
    if (gameOver.winnerId === youId) { sfxRef.current!.win(); vibrate([30, 60, 30, 60, 90]); }
    else if (gameOver.winnerId) { sfxRef.current!.lose(); vibrate(150); }
  }, [gameOver, youId]);

  useEffect(() => () => {
    aliveRef.current = false;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);

  // ── actions (protocol: roll / move{tokenId,die} / move{-1}=pass) ────

  const canRoll = gameState.isMyTurn && !gameOver && dice[0] == null && dice[1] == null;

  const handleRoll = useCallback(() => {
    if (!canRoll || rollingRef.current) return;
    sfxRef.current!.ensure();
    sfxRef.current!.rattle();
    vibrate(12);
    rollingRef.current = true;
    setRolling(true);
    later(() => {
      rollingRef.current = false;
      setRolling(false);
      const g = gsRef.current;
      const n = normRef.current;
      if (g.isMyTurn && n.dice[0] == null && n.dice[1] == null && !gameOverRef.current) {
        actionRef.current({ type: "roll" });
      }
    }, 700);
    later(() => { rollingRef.current = false; setRolling(false); }, 5000);
  }, [canRoll, later]);

  const handleMoveToken = useCallback((tokenId: number, die: 0 | 1) => {
    const gs = gsRef.current;
    if (!gs.isMyTurn || gameOverRef.current) return;
    const opt = normRef.current.options.find((o) => o.tokenId === tokenId && o.die === die);
    if (!opt) return;
    sfxRef.current!.ensure();
    vibrate(8);
    setChooser(null);
    actionRef.current({ type: "move", tokenId, die });
  }, []);

  const handlePass = useCallback(() => {
    const gs = gsRef.current;
    const n = normRef.current;
    if (!gs.isMyTurn || gameOverRef.current) return;
    if (n.dice[0] == null && n.dice[1] == null) return;
    if (n.options.length > 0) return;
    actionRef.current({ type: "move", tokenId: -1 });
  }, []);

  // ── derived ────────────────────────────────────────────────────────

  const layout = useMemo(() => {
    const out: Record<string, { x: number; y: number; scale: number }> = {};
    const byCell: Record<string, string[]> = {};
    const tokens = gameState.tokens ?? {};
    for (const pid of Object.keys(tokens)) {
      const seat = seatOfPlayer(pid);
      for (const t of tokens[pid] ?? []) {
        const key = `${pid}:${t.id}`;
        const c = cellFor(seat, normPos(t), t.id);
        const ck = `${Math.round(c.x * 10)},${Math.round(c.y * 10)}`;
        (byCell[ck] ??= []).push(key);
        out[key] = { x: c.x, y: c.y, scale: 1 };
      }
    }
    const OFF: [number, number][] = [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]];
    for (const keys of Object.values(byCell)) {
      if (keys.length < 2) continue;
      keys.forEach((key, i) => {
        const o = OFF[i % 4]!;
        const e = out[key]!;
        out[key] = { x: e.x + o[0], y: e.y + o[1], scale: 0.72 };
      });
    }
    return out;
  }, [gameState.tokens, seatOfPlayer]);

  const destPreview = useMemo(() => {
    if (!gameState.isMyTurn || gameOver) return [] as { x: number; y: number; die: 0 | 1; gold: boolean }[];
    const seat = seatOfPlayer(youId);
    const mine = gameState.tokens?.[youId] ?? [];
    const out: { x: number; y: number; die: 0 | 1; gold: boolean }[] = [];
    for (const o of options) {
      if (diceUsed[o.die]) continue;
      const t = mine.find((x) => x.id === o.tokenId);
      if (!t) continue;
      const p = normPos(t);
      const dest = p < 0 ? 0 : Math.min(p + o.steps, 56);
      const c = cellFor(seat, dest, t.id);
      out.push({ x: c.x + (o.die === 0 ? -0.14 : 0.14), y: c.y, die: o.die, gold: dest >= 56 });
    }
    return out;
  }, [gameState, gameOver, options, diceUsed, seatOfPlayer, youId]);

  const handleTokenTap = useCallback((tokenId: number) => {
    const gs = gsRef.current;
    if (!gs.isMyTurn || gameOverRef.current || helpOpen) return;
    const opts = normRef.current.options.filter((o) => o.tokenId === tokenId);
    if (opts.length === 0) return;
    sfxRef.current!.ensure();
    if (opts.length === 1) { handleMoveToken(tokenId, opts[0]!.die); return; }
    const L = layout[`${youId}:${tokenId}`];
    if (L) setChooser({ tokenId, opts, x: L.x, y: L.y });
  }, [handleMoveToken, layout, youId, helpOpen]);

  const turnSeat = gameState.currentTurn ? seatOfPlayer(gameState.currentTurn) : -1;
  const mySeat = seatOfPlayer(youId);
  const myColor = SEAT_COLORS[mySeat]!;
  const doubles = dice[0] != null && dice[0] === dice[1];

  const nameBySeat = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of players) m.set(seatOfPlayer(p.id), gameState.playerNames?.[p.id] ?? p.name);
    return m;
  }, [players, seatOfPlayer, gameState.playerNames]);

  const rem0 = !diceUsed[0] && dice[0] != null ? dice[0] : null;
  const rem1 = !diceUsed[1] && dice[1] != null ? dice[1] : null;

  let status = "";
  if (gameOver) {
    status = gameOver.winnerId === youId ? "You win!" : gameOver.winnerId ? "You lose" : "Game over";
  } else if (gameState.isMyTurn) {
    if (rolling) status = "Rolling…";
    else if (dice[0] == null && dice[1] == null) status = "Your turn — roll the dice";
    else if (options.length > 0) {
      status = rem0 != null && rem1 != null
        ? `You rolled ${dice[0]} & ${dice[1]} — tap a glowing token`
        : rem0 != null ? `Play your ${rem0} — tap a glowing token`
        : rem1 != null ? `Play your ${rem1} — tap a glowing token`
        : "Tap a glowing token";
    } else {
      status = diceUsed[0] || diceUsed[1]
        ? "No moves left on your dice"
        : `No legal moves with ${dice[0]}${dice[1] != null ? ` & ${dice[1]}` : ""}`;
    }
  } else {
    const nm = gameState.playerNames?.[gameState.currentTurn] ?? "Opponent";
    status = dice[0] == null ? `${nm} is rolling…` : `${nm} rolled ${dice[0]}${dice[1] != null ? ` & ${dice[1]}` : ""}`;
  }

  const won = gameOver?.winnerId === youId;
  const myDone = (gameState.tokens?.[youId] ?? []).filter((t) => t.finished).length;
  const showDie2 = dice[1] != null || dice[0] == null;

  // ── render ─────────────────────────────────────────────────────────

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
        .ludo-token { appearance: none; border: none; padding: 0;
          display: flex; align-items: center; justify-content: center; }
        .ludo-token.legal::after { content: ""; position: absolute; inset: -4px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,.85); pointer-events: none;
          animation: ludo-legal 1.1s ease-in-out infinite; }
        .ludo-token.ludo-flash { animation: ludo-flash .65s ease; }
        @keyframes ludo-legal { 0%, 100% { transform: scale(.9); opacity: .35; } 50% { transform: scale(1.2); opacity: 1; } }
        @keyframes ludo-flash { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,.9); } 100% { box-shadow: 0 0 0 16px rgba(239,68,68,0); } }
        @keyframes ludo-dest { 0%, 100% { transform: translate(-50%,-50%) scale(.75); opacity: .5; } 50% { transform: translate(-50%,-50%) scale(1.15); opacity: 1; } }
        @keyframes ludo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ludo-pop { from { opacity: 0; transform: scale(.9) translateY(12px); } to { opacity: 1; transform: none; } }
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
          <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{gameName || "Ludo"}</div>
          <div style={{ fontSize: 9.5, color: T.chalkMuted }}>get all four tokens home</div>
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

      {/* Player cards */}
      <div style={{ flexShrink: 0, display: "flex", gap: 8, padding: "8px 12px 4px" }}>
        {players.map((p) => {
          const seat = seatOfPlayer(p.id);
          const color = SEAT_COLORS[seat]!;
          const active = gameState.currentTurn === p.id && !gameOver;
          const toks = gameState.tokens?.[p.id] ?? [];
          const done = toks.filter((t) => t.finished).length;
          const wins = gameState.scores?.[p.id] ?? 0;
          const name = gameState.playerNames?.[p.id] ?? p.name;
          return (
            <div key={p.id} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", borderRadius: 10,
              background: active ? hexA(color, 0.12) : `${T.chalk}05`,
              border: `1.5px solid ${active ? color : "transparent"}`,
              boxShadow: active ? `0 0 12px ${hexA(color, 0.25)}` : "none",
              transition: "all .25s ease", minWidth: 0,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: color,
                boxShadow: active ? `0 0 6px ${color}` : "none",
              }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
                  color: active ? color : T.chalkMuted,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {name}{p.id === youId ? " (you)" : ""}
                </div>
                {wins > 0 && (
                  <div style={{ fontSize: 8, color: T.chalkDim }}>
                    {"★".repeat(Math.min(wins, 5))}{wins > 5 ? ` ${wins}` : ""}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10.5, fontWeight: 700, color: T.chalkMuted, flexShrink: 0 }}>
                {done}/4
              </div>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div ref={boardWrapRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 0, minWidth: 0, padding: "4px 10px 8px",
      }}>
        <div style={{
          position: "relative", width: boardPx, height: boardPx, borderRadius: 10,
          background: "#101820",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,.04), 0 14px 40px rgba(0,0,0,.45)",
        }}>
          {/* bases */}
          {[0, 1, 2, 3].map((seat) => {
            const rect = BASE_RECT[seat]!;
            const occupied = occupiedSeats.has(seat);
            const color = occupied ? SEAT_COLORS[seat]! : "#4b5563";
            const isTurn = turnSeat === seat && !gameOver;
            return (
              <div key={`base${seat}`} style={{
                position: "absolute", left: px(rect.left), top: px(rect.top),
                width: cellPx * 6, height: cellPx * 6, borderRadius: cellPx * 0.5,
                background: hexA(color, 0.14),
                border: `2px solid ${hexA(color, isTurn ? 0.9 : 0.4)}`,
                boxShadow: isTurn ? `0 0 ${cellPx * 0.8}px ${hexA(color, 0.45)}` : "none",
                transition: "box-shadow .3s ease, border-color .3s ease",
              }}>
                <div style={{
                  position: "absolute", inset: cellPx * 0.55, borderRadius: cellPx * 0.4,
                  background: "#151c25",
                  boxShadow: "inset 0 2px 10px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.03)",
                }} />
                {BASE_SLOTS[seat]!.map(([sx, sy], i) => (
                  <div key={i} style={{
                    position: "absolute",
                    left: (sx - rect.left) * cellPx, top: (sy - rect.top) * cellPx,
                    transform: "translate(-50%, -50%)",
                    width: cellPx * 1.5, height: cellPx * 1.5, borderRadius: "50%",
                    background: hexA(color, 0.1),
                    boxShadow: `inset 0 0 0 1.5px ${hexA(color, 0.35)}`,
                  }} />
                ))}
                {occupied && nameBySeat.has(seat) && (
                  <div style={{
                    position: "absolute", left: "50%", top: cellPx * 0.62, transform: "translateX(-50%)",
                    maxWidth: "92%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: cellPx * 0.34, fontWeight: 700, fontFamily: T.fontDisplay,
                    color: hexA(color, 0.95), textShadow: "0 1px 2px rgba(0,0,0,.6)",
                  }}>{nameBySeat.get(seat)}</div>
                )}
              </div>
            );
          })}

          {/* ring cells */}
          {RING.map(([r, c], idx) => {
            const startSeat = START_IDX.indexOf(idx);
            const zoneSeat = startSeat >= 0 ? startSeat : Math.floor(idx / 13);
            const isSafe = SAFE_IDX.has(idx);
            const color = occupiedSeats.has(zoneSeat) ? SEAT_COLORS[zoneSeat]! : "#4b5563";
            const isStart = startSeat >= 0;
            return (
              <div key={`rc${idx}`} style={{
                position: "absolute", left: px(c), top: px(r), width: cellPx, height: cellPx,
                borderRadius: cellPx * 0.16,
                background: isStart ? hexA(color, 0.85) : isSafe ? hexA(color, 0.18) : "#232c38",
                boxShadow: `inset 0 0 0 1px ${isStart || isSafe ? hexA(color, 0.5) : "rgba(255,255,255,0.05)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: cellPx * 0.5, lineHeight: 1, color: "rgba(255,255,255,0.8)",
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}>{isSafe ? "★" : ""}</div>
            );
          })}

          {/* home columns */}
          {HOME_COL.map((col, seat) => col.map(([r, c], i) => {
            const color = occupiedSeats.has(seat) ? SEAT_COLORS[seat]! : "#4b5563";
            return (
              <div key={`hc${seat}-${i}`} style={{
                position: "absolute", left: px(c), top: px(r), width: cellPx, height: cellPx,
                borderRadius: cellPx * 0.16,
                background: `linear-gradient(135deg, ${hexA(color, 0.85)}, ${hexA(color, 0.55)})`,
                boxShadow: `inset 0 0 0 1px ${hexA(color, 0.5)}`,
              }} />
            );
          }))}

          {/* center triangles */}
          {(() => {
            const c = [
              occupiedSeats.has(2) ? SEAT_COLORS[2]! : "#39404d",
              occupiedSeats.has(3) ? SEAT_COLORS[3]! : "#39404d",
              occupiedSeats.has(0) ? SEAT_COLORS[0]! : "#39404d",
              occupiedSeats.has(1) ? SEAT_COLORS[1]! : "#39404d",
            ];
            return (
              <div style={{
                position: "absolute", left: px(6), top: px(6),
                width: cellPx * 3, height: cellPx * 3, borderRadius: cellPx * 0.2,
                background: `conic-gradient(from 45deg, ${c[0]} 0 90deg, ${c[1]} 90deg 180deg, ${c[2]} 180deg 270deg, ${c[3]} 270deg 360deg)`,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.35)",
              }} />
            );
          })()}

          {/* destination previews (one dot per playable die) */}
          {destPreview.map((d, i) => (
            <div key={`dst${i}`} style={{
              position: "absolute", left: px(d.x), top: px(d.y),
              width: cellPx * 0.36, height: cellPx * 0.36, borderRadius: "50%",
              background: d.gold ? "#fde047" : d.die === 0 ? myColor : "#38bdf8",
              boxShadow: `0 0 ${cellPx * 0.5}px ${hexA(d.gold ? "#fde047" : d.die === 0 ? myColor : "#38bdf8", 0.8)}`,
              animation: "ludo-dest 1s ease-in-out infinite",
              pointerEvents: "none", zIndex: 5,
            }} />
          ))}

          {/* tokens */}
          {Object.entries(gameState.tokens ?? {}).map(([pid, toks]) => {
            const seat = seatOfPlayer(pid);
            const color = SEAT_COLORS[seat]!;
            const isMine = pid === youId;
            return toks.map((t) => {
              const key = `${pid}:${t.id}`;
              const L = layout[key];
              if (!L) return null;
              const anim = animatingKeys.has(key);
              const v = visual[key];
              const pos = anim && v ? v : L;
              const finished = t.finished || normPos(t) >= 56;
              const legal = isMine && gameState.isMyTurn &&
                (dice[0] != null || dice[1] != null) && !gameOver &&
                options.some((o) => o.tokenId === t.id) && !anim && !helpOpen;
              return (
                <button
                  key={key}
                  className={`ludo-token${legal ? " legal" : ""}${flash && flash.key === key ? " ludo-flash" : ""}`}
                  aria-label={`Token ${t.id + 1}${finished ? ", home" : ""}`}
                  onClick={() => handleTokenTap(t.id)}
                  style={{
                    position: "absolute", left: px(pos.x), top: px(pos.y),
                    width: cellPx * 0.94, height: cellPx * 0.94,
                    transform: `translate(-50%, -50%) scale(${(finished ? 0.62 : 1) * (pos.scale ?? 1)})`,
                    transition: anim && v?.fly
                      ? "left .42s cubic-bezier(.25,.75,.3,1), top .42s cubic-bezier(.25,.75,.3,1)"
                      : "left .13s linear, top .13s linear, transform .2s ease",
                    borderRadius: "50%",
                    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 45%), ${color}`,
                    border: "1.5px solid rgba(0,0,0,.5)",
                    boxShadow: `0 ${cellPx * 0.06}px ${cellPx * 0.14}px rgba(0,0,0,.55), inset 0 -${cellPx * 0.1}px ${cellPx * 0.12}px rgba(0,0,0,.28)`,
                    color: "#fff", fontFamily: T.fontMono, fontWeight: 800,
                    fontSize: cellPx * 0.4, textShadow: "0 1px 2px rgba(0,0,0,.7)",
                    zIndex: anim ? 40 : legal ? 30 : 20,
                    pointerEvents: legal ? "auto" : "none",
                    cursor: legal ? "pointer" : "default",
                  }}
                >
                  {finished ? "✓" : t.id + 1}
                </button>
              );
            });
          })}

          {/* die chooser: token playable with either die */}
          {chooser && (() => {
            const cx = Math.min(Math.max(chooser.x, 1.4), N - 1.4);
            const cy = Math.max(chooser.y - 1.35, 1.1);
            return (
              <>
                <div onClick={() => setChooser(null)} style={{ position: "absolute", inset: 0, zIndex: 45 }} />
                <div style={{
                  position: "absolute", left: px(cx), top: px(cy), zIndex: 50,
                  transform: "translate(-50%, -100%)",
                  background: T.charcoal, border: `1px solid ${T.line}`, borderRadius: 10,
                  padding: 6, display: "flex", gap: 6, boxShadow: "0 10px 30px rgba(0,0,0,.55)",
                }}>
                  {chooser.opts.map((o) => {
                    const dotColor = o.die === 0 ? myColor : "#38bdf8";
                    return (
                      <button
                        key={o.die}
                        onClick={() => handleMoveToken(o.tokenId, o.die)}
                        style={{
                          minWidth: cellPx * 1.5, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                          background: hexA(dotColor, 0.18), border: `1.5px solid ${dotColor}`,
                          color: T.chalk, textAlign: "center",
                        }}
                      >
                        <div style={{ fontFamily: T.fontMono, fontWeight: 800, fontSize: 15, color: dotColor }}>
                          {o.steps}
                        </div>
                        <div style={{ fontSize: 7, letterSpacing: 0.8, color: T.chalkMuted, marginTop: 1 }}>
                          DIE {o.die + 1}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Bottom bar: two dice + action */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        background: T.charcoal, borderTop: `1px solid ${T.line}`,
      }}>
        <div style={{ flexShrink: 0, display: "flex", gap: 8 }}>
          <div style={{
            position: "relative", opacity: diceUsed[0] ? 0.35 : 1,
            filter: diceUsed[0] ? "grayscale(1)" : "none", transition: "all .3s ease",
          }}>
            <Dice3D value={dice[0]} rollId={rollId} spinning={rolling} size={52} />
            {diceUsed[0] && (
              <div style={{
                position: "absolute", right: -3, top: -3, width: 15, height: 15, borderRadius: "50%",
                background: T.green, color: "#fff", fontSize: 9, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 1px 3px rgba(0,0,0,.5)",
              }}>✓</div>
            )}
          </div>
          {showDie2 && (
            <div style={{
              position: "relative", opacity: diceUsed[1] ? 0.35 : 1,
              filter: diceUsed[1] ? "grayscale(1)" : "none", transition: "all .3s ease",
            }}>
              <Dice3D value={dice[1]} rollId={rollId} spinning={rolling} size={52} />
              {diceUsed[1] && (
                <div style={{
                  position: "absolute", right: -3, top: -3, width: 15, height: 15, borderRadius: "50%",
                  background: T.green, color: "#fff", fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,.5)",
                }}>✓</div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          {doubles && gameState.isMyTurn && !gameOver && dice[0] != null && (
            <div style={{
              alignSelf: "flex-start", fontSize: 8.5, fontWeight: 800, letterSpacing: 1,
              color: accent, border: `1px solid ${accent}66`, borderRadius: 5, padding: "2px 7px",
            }}>
              ⚄ DOUBLES!
            </div>
          )}
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 600,
            color: gameState.isMyTurn ? T.green : T.chalkMuted, minHeight: 15,
          }}>
            {status}
          </div>
          {!gameOver && gameState.isMyTurn && canRoll && (
            <button
              onClick={handleRoll}
              disabled={rolling}
              style={{
                ...T.btn, ...T.btnPrimary(accent), width: "100%", padding: "11px 0",
                fontSize: 14, fontWeight: 800, letterSpacing: 1,
                opacity: rolling ? 0.6 : 1, cursor: rolling ? "default" : "pointer",
              }}
            >
              {rolling ? "ROLLING…" : "ROLL DICE"}
            </button>
          )}
          {!gameOver && gameState.isMyTurn && !canRoll && (dice[0] != null || dice[1] != null) && options.length === 0 && (
            <button
              onClick={handlePass}
              style={{
                ...T.btn, ...T.btnPrimary(accent), width: "100%", padding: "11px 0",
                fontSize: 14, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
              }}
            >
              PASS TURN
            </button>
          )}
          {!gameOver && !gameState.isMyTurn && (
            <div style={{ fontSize: 10, color: T.chalkDim }}>
              {dice[0] == null ? "waiting for their roll…" : "waiting for their move…"}
            </div>
          )}
        </div>
      </div>

      {/* Help */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{
          position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          animation: "ludo-fade .2s ease", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 340, width: "100%", background: T.charcoal, border: `1px solid ${T.line}`,
            borderRadius: 16, padding: "20px 22px",
            animation: "ludo-pop .3s cubic-bezier(.18,.9,.28,1.15)",
          }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 800, marginBottom: 12 }}>How to play Ludo</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: T.chalkMuted, lineHeight: 1.7 }}>
              <li>Roll <b style={{ color: T.chalk }}>both dice</b>, then tap a glowing token. If a token can use either die, you'll choose which to play — split the dice across tokens or spend both on the same one.</li>
              <li>Tokens travel <b style={{ color: T.chalk }}>clockwise</b> around the track, then up their colored home column to the center.</li>
              <li>Land on an opponent to send it back to base. <b style={{ color: T.chalk }}>★ squares are safe</b>.</li>
              <li>Bring all 4 tokens home to win. Exact steps are needed for the final one.</li>
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
          animation: "ludo-fade .25s ease",
        }}>
          <div style={{
            textAlign: "center", padding: "28px 34px", background: T.charcoal,
            border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)",
            animation: "ludo-pop .4s cubic-bezier(.18,.9,.28,1.2)",
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: "50%", margin: "0 auto 14px",
              background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.5), rgba(255,255,255,0) 45%), ${myColor}`,
              boxShadow: `0 10px 24px rgba(0,0,0,.5), 0 0 24px ${hexA(myColor, 0.4)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 22,
            }}>{won ? "✓" : "✕"}</div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 25, fontWeight: 800, letterSpacing: 0.5,
              color: won ? T.green : gameOver.winnerId ? T.pink : T.chalk, marginBottom: 6,
            }}>
              {won ? "Victory" : gameOver.winnerId ? "Defeat" : "Draw"}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkDim, marginBottom: 4 }}>
              {myDone}/4 tokens home
            </div>
            <div style={{ fontSize: 10, color: T.chalkMuted, marginBottom: 18 }}>
              Match · {(gameState.scores?.[youId] ?? 0)}–{(gameState.scores?.[gameState.winnerId ?? ""] ?? 0)}
            </div>
            <button onClick={onLeave} style={{
              padding: "11px 30px", ...T.btn, ...T.btnPrimary(accent), fontSize: 13, fontWeight: 700,
            }}>Back to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}
