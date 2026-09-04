import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface SnakeLadderView {
  positions: Record<string, number>;
  currentTurn: string;
  isMyTurn: boolean;
  dice: number | null;
  winnerId: string | null;
  scores: Record<string, number>;
  playerNames: Record<string, string>;
  myId: string;
  snakes: Record<number, number>;
  ladders: Record<number, number>;
}

interface Props {
  gameState: SnakeLadderView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}

interface Pt { x: number; y: number }
type PawnMode = "rest" | "hop" | "slide" | "climb" | "glide";
interface Step { sq: number; mode: PawnMode; dur: number; banner?: { text: string; kind: "snake" | "ladder" | "finish" } }
interface Banner { text: string; kind: "snake" | "ladder" | "finish"; t: number }

const N = 10;
const TOTAL = 100;
const PAWN_COLORS = ["#38bdf8", "#a3e635", "#fb7185", "#fbbf24"];
const SNAKE_COLS = ["#ef4444", "#f97316", "#e11d48", "#fb7185"];

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* ignore */ } }

// boustrophedon: 1 bottom-left … 10 bottom-right, 11 one up on the right, … 100 top-left
function cellOf(square: number): { row: number; col: number } {
  const adjusted = square - 1;
  const row = Math.floor(adjusted / N);
  const col = adjusted % N;
  return { row: N - 1 - row, col: row % 2 === 0 ? col : N - 1 - col };
}

function centerOf(square: number): Pt {
  const { row, col } = cellOf(square);
  return { x: col + 0.5, y: row + 0.5 };
}

// reconstruct the move: hops up to the landing square, then a themed slide/climb
function buildSteps(from: number, to: number, dice: number | null, snakes: Record<number, number>, ladders: Record<number, number>): Step[] {
  if (to === from) return [];
  const d = dice ?? 0;
  const steps: Step[] = [];
  const hopRange = (a: number, b: number) => {
    if (b > a) for (let s = a + 1; s <= b; s++) steps.push({ sq: s, mode: "hop", dur: 165 });
    else for (let s = a - 1; s >= b; s--) steps.push({ sq: s, mode: "hop", dur: 150 });
  };

  const land = from + d;
  const capped = Math.min(land, TOTAL);

  if (d > 0 && land <= TOTAL && to !== from) {
    if (to === land) {
      hopRange(from, to);
    } else if (snakes[land] === to) {
      hopRange(from, land);
      steps.push({ sq: to, mode: "slide", dur: 640, banner: { text: `SNAKE! ${land} → ${to}`, kind: "snake" } });
    } else if (ladders[land] === to) {
      hopRange(from, land);
      steps.push({ sq: to, mode: "climb", dur: 560, banner: { text: `LADDER! ${land} → ${to}`, kind: "ladder" } });
    } else {
      // chained specials or a rules variant — walk to the landing, then glide to truth
      hopRange(from, capped);
      steps.push({ sq: to, mode: "glide", dur: 420 });
    }
  } else if (d > 0 && land > TOTAL && to === 2 * TOTAL - land && to < TOTAL) {
    // bounce-back at 100 (some rule sets)
    hopRange(from, TOTAL);
    hopRange(TOTAL, to);
  } else {
    if (to > from) hopRange(from, to);
    else steps.push({ sq: to, mode: "glide", dur: 450 });
  }

  if (to === TOTAL) {
    const last = steps[steps.length - 1];
    if (last) last.banner = { text: "FINISH! ★ 100", kind: "finish" };
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
  tick(i: number) { this.blip(390 + Math.min(i, 18) * 24, 0.045, 0.11); }
  slide() { this.blip(520, 0.09, 0.18); this.blip(360, 0.11, 0.16, 0.08); this.blip(240, 0.14, 0.14, 0.17); }
  climb() { this.blip(400, 0.07, 0.14); this.blip(560, 0.07, 0.14, 0.08); this.blip(760, 0.1, 0.14, 0.16); }
  finish() { [660, 880, 1175].forEach((f, i) => this.blip(f, 0.12, 0.15, i * 0.08)); }
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
        <div ref={cubeRef} style={{
          position: "relative", width: "100%", height: "100%",
          transformStyle: "preserve-3d",
          transform: "rotateX(-22deg) rotateY(28deg)",
        }}>
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

export function SnakeLadderFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: Props) {
  const gsRef = useRef(gameState); gsRef.current = gameState;
  const gameOverRef = useRef(gameOver); gameOverRef.current = gameOver;
  const actionRef = useRef(onSubmitAction); actionRef.current = onSubmitAction;

  const players = useMemo(() => {
    const rp = room?.players?.filter((p) => p?.id) ?? [];
    if (rp.length) return rp.map((p) => ({ id: p.id, name: p.name }));
    return Object.entries(gameState.playerNames ?? {}).map(([id, name]) => ({ id, name }));
  }, [room, gameState.playerNames]);
  const playersRef = useRef(players); playersRef.current = players;

  const nameOf = useCallback((pid: string) =>
    gameState.playerNames?.[pid] ?? players.find((p) => p.id === pid)?.name ?? "?"
  , [gameState.playerNames, players]);

  const colorOf = useCallback((pid: string, idx: number) =>
    pid === youId ? accent : PAWN_COLORS[idx % PAWN_COLORS.length]
  , [accent, youId]);

  // board sizing
  const wrapRef = useRef<HTMLDivElement>(null);
  const [boardPx, setBoardPx] = useState(340);
  useEffect(() => {
    const calc = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      setBoardPx(Math.max(220, Math.floor(Math.min(r.width, r.height) - 8)));
    };
    calc();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && wrapRef.current) {
      ro = new ResizeObserver(calc);
      ro.observe(wrapRef.current);
    }
    window.addEventListener("resize", calc);
    return () => { window.removeEventListener("resize", calc); ro?.disconnect(); };
  }, []);

  const cellPx = boardPx / N;
  const stripPx = cellPx * 0.95;
  const px = (v: number) => v * cellPx;

  // state
  const [pawnState, setPawnState] = useState<Record<string, { x: number; y: number; dur: number; mode: PawnMode; k: number; scale: number }>>({});
  const [animating, setAnimating] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rollId, setRollId] = useState(0);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("snl_muted") === "1"; } catch { return false; }
  });

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();

  const rollingRef = useRef(false);
  const animatingRef = useRef(false); animatingRef.current = animating;
  const aliveRef = useRef(true);
  const timersRef = useRef<Set<number>>(new Set());
  const pawnTimersRef = useRef<Map<string, number[]>>(new Map());
  const prevPositionsRef = useRef<Record<string, number>>({ ...gameState.positions });
  const animCountRef = useRef(0);
  const moverRef = useRef<string | null>(null);
  const lastRollKeyRef = useRef<string | null>(null);
  const lastRollAtRef = useRef(0);
  const turnRef = useRef(gameState.currentTurn);

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => { timersRef.current.delete(id); if (aliveRef.current) fn(); }, ms);
    timersRef.current.add(id);
    return id;
  }, []);

  const startCoords = useCallback((pid: string): Pt => {
    const i = Math.max(0, playersRef.current.findIndex((p) => p.id === pid));
    const n = playersRef.current.length || 1;
    return { x: N / 2 + (i - (n - 1) / 2) * 1.05, y: N + 0.48 };
  }, []);

  const setBannerTimed = useCallback((text: string, kind: Banner["kind"]) => {
    const t = performance.now();
    setBanner({ text, kind, t });
    later(() => setBanner((b) => (b && b.t === t ? null : b)), 3200);
  }, [later]);

  // ── pawn animation runner ──────────────────────────────────────────

  const runAnim = useCallback((pid: string, from: number, to: number, dice: number | null) => {
    const prev = pawnTimersRef.current.get(pid);
    if (prev) prev.forEach((id) => { window.clearTimeout(id); timersRef.current.delete(id); });

    const gs = gsRef.current;
    const steps = buildSteps(from, to, dice, gs.snakes ?? {}, gs.ladders ?? {});
    if (steps.length === 0) return;

    animCountRef.current++;
    setAnimating(true);
    moverRef.current = pid;

    const ids: number[] = [];
    pawnTimersRef.current.set(pid, ids);

    let t = 0;
    steps.forEach((st, i) => {
      t += st.dur;
      ids.push(later(() => {
        const c = st.sq === 0 ? startCoords(pid) : centerOf(st.sq);
        setPawnState((s) => ({
          ...s,
          [pid]: { x: c.x, y: c.y, dur: st.dur, mode: st.mode, k: (s[pid]?.k ?? 0) + 1, scale: st.mode === "rest" ? 1 : 1.05 },
        }));
        if (st.mode === "hop") { sfxRef.current!.tick(i); vibrate(5); }
        else if (st.mode === "slide") { sfxRef.current!.slide(); vibrate([20, 40, 20]); }
        else if (st.mode === "climb") { sfxRef.current!.climb(); vibrate(12); }
        if (st.banner) setBannerTimed(st.banner.text, st.banner.kind);
        if (i === steps.length - 1 && to === TOTAL) sfxRef.current!.finish();
      }, t));
    });

    ids.push(later(() => {
      setPawnState((s) => { const c = { ...s }; delete c[pid]; return c; });
      pawnTimersRef.current.delete(pid);
      animCountRef.current--;
      if (animCountRef.current <= 0) { animCountRef.current = 0; setAnimating(false); }
    }, t + 120));
  }, [later, startCoords, setBannerTimed]);

  // server positions → animate the diff
  useEffect(() => {
    const cur = gameState.positions ?? {};
    const prev = prevPositionsRef.current;
    prevPositionsRef.current = { ...cur };
    for (const pid of Object.keys(cur)) {
      const to = cur[pid];
      const from = prev[pid];
      if (from === undefined || to === from) continue;
      runAnim(pid, from, to, gsRef.current.dice);
    }
  }, [gameState.positions, runAnim]);

  // dice arrival → settle + sound
  const rollKey = gameState.dice != null ? `${gameState.currentTurn}|${gameState.dice}` : null;
  useEffect(() => {
    if (rollKey != null && rollKey !== lastRollKeyRef.current) {
      lastRollKeyRef.current = rollKey;
      rollingRef.current = false;
      setRolling(false);
      setRollId((r) => r + 1);
      sfxRef.current!.land(gameState.isMyTurn);
      vibrate(10);
    } else if (rollKey == null && lastRollKeyRef.current != null) {
      lastRollKeyRef.current = null;
      rollingRef.current = false;
      setRolling(false);
    }
  }, [rollKey, gameState.isMyTurn]);

  useEffect(() => {
    if (gameState.currentTurn === turnRef.current) return;
    turnRef.current = gameState.currentTurn;
    rollingRef.current = false;
    setRolling(false);
  }, [gameState.currentTurn]);

  useEffect(() => {
    sfxRef.current!.enabled = !muted;
    try { localStorage.setItem("snl_muted", muted ? "1" : "0"); } catch { /* ignore */ }
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

  // ── roll (protocol unchanged: only { type: "roll" }) ───────────────
  // Note: canRoll intentionally does NOT check `dice !== null` — a stale
  // dice from the previous turn (the same server bug that deadlocked your
  // Ludo) must not block the next player's roll.

  const canRoll = gameState.isMyTurn && !gameOver && !rolling && !animating;

  const handleRoll = useCallback(() => {
    const gs = gsRef.current;
    if (!gs.isMyTurn || gameOverRef.current || rollingRef.current || animatingRef.current) return;
    const now = performance.now();
    if (now - lastRollAtRef.current < 1200) return;
    lastRollAtRef.current = now;
    sfxRef.current!.ensure();
    sfxRef.current!.rattle();
    vibrate(12);
    rollingRef.current = true;
    setRolling(true);
    later(() => {
      rollingRef.current = false;
      setRolling(false);
      const g = gsRef.current;
      if (g.isMyTurn && !gameOverRef.current) actionRef.current({ type: "roll" });
    }, 650);
    later(() => { rollingRef.current = false; setRolling(false); }, 4000);
  }, [later]);

  // ── derived ────────────────────────────────────────────────────────

  const restLayout = useMemo(() => {
    const bySquare: Record<number, string[]> = {};
    for (const p of players) {
      const sq = gameState.positions?.[p.id] ?? 0;
      (bySquare[sq] ??= []).push(p.id);
    }
    const out: Record<string, { x: number; y: number; scale: number }> = {};
    const OFF: [number, number][] = [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]];
    for (const p of players) {
      const sq = gameState.positions?.[p.id] ?? 0;
      if (sq === 0) { const i = players.findIndex((x) => x.id === p.id); out[p.id] = { x: N / 2 + (i - (players.length - 1) / 2) * 1.05, y: N + 0.48, scale: 0.85 }; continue; }
      const mates = bySquare[sq] ?? [p.id];
      const c = centerOf(sq);
      if (mates.length === 1) out[p.id] = { x: c.x, y: c.y, scale: 1 };
      else { const o = OFF[mates.indexOf(p.id) % 4]!; out[p.id] = { x: c.x + o[0], y: c.y + o[1], scale: 0.78 }; }
    }
    return out;
  }, [gameState.positions, players]);

  const pawnRender = useCallback((pid: string) => {
    const rest = restLayout[pid] ?? { x: N / 2, y: N + 0.48, scale: 0.85 };
    const ov = pawnState[pid];
    return ov ? { ...rest, ...ov } : { ...rest, dur: 140, mode: "rest" as PawnMode, k: 0 };
  }, [restLayout, pawnState]);

  // snakes & ladders overlay
  const overlays = useMemo(() => {
    if (cellPx <= 1) return null;
    const els: ReactNode[] = [];

    for (const [k, v] of Object.entries(gameState.ladders ?? {})) {
      const bottom = Number(k);
      const top = v;
      if (!Number.isFinite(bottom) || !Number.isFinite(top) || bottom < 1 || top < 1 || bottom > TOTAL || top > TOTAL) continue;
      const a = centerOf(bottom), b = centerOf(top);
      const ax = a.x * cellPx, ay = a.y * cellPx, bx = b.x * cellPx, by = b.y * cellPx;
      const dx = bx - ax, dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const pxn = -uy, pyn = ux;
      const off = cellPx * 0.19;
      const runs: ReactNode[] = [];
      const rungN = Math.max(3, Math.round(len / (cellPx * 0.5)));
      for (let i = 0; i <= rungN; i++) {
        const t = i / rungN;
        const cx = ax + dx * t, cy = ay + dy * t;
        runs.push(<line key={i} x1={cx + pxn * off} y1={cy + pyn * off} x2={cx - pxn * off} y2={cy - pyn * off} stroke="#a8743f" strokeWidth={cellPx * 0.055} strokeLinecap="round" />);
      }
      els.push(<g key={`L${bottom}`}>
        {runs}
        <line x1={ax + pxn * off} y1={ay + pyn * off} x2={bx + pxn * off} y2={by + pyn * off} stroke="#d9a05b" strokeWidth={cellPx * 0.075} strokeLinecap="round" />
        <line x1={ax - pxn * off} y1={ay - pyn * off} x2={bx - pxn * off} y2={by - pyn * off} stroke="#d9a05b" strokeWidth={cellPx * 0.075} strokeLinecap="round" />
      </g>);
    }

    Object.entries(gameState.snakes ?? {}).forEach(([k, v], idx) => {
      const head = Number(k);
      const tail = v;
      if (!Number.isFinite(head) || !Number.isFinite(tail) || head < 1 || tail < 1 || head > TOTAL || tail > TOTAL) return;
      const a = centerOf(head), b = centerOf(tail);
      const ax = a.x * cellPx, ay = a.y * cellPx, bx = b.x * cellPx, by = b.y * cellPx;
      const dx = bx - ax, dy = by - ay;
      const lenPx = Math.hypot(dx, dy) || 1;
      const ux = dx / lenPx, uy = dy / lenPx;
      const pxn = -uy, pyn = ux;
      const wig = clamp((lenPx / cellPx) * 0.09, 0.16, 0.4) * cellPx;
      const nPts = 26;
      const pts: string[] = [];
      for (let i = 0; i <= nPts; i++) {
        const t = i / nPts;
        const env = Math.sin(Math.PI * t);
        const off = Math.sin(t * Math.PI * 2.4) * wig * env;
        pts.push(`${(ax + dx * t + pxn * off).toFixed(1)} ${(ay + dy * t + pyn * off).toFixed(1)}`);
      }
      const d = `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
      const color = SNAKE_COLS[idx % SNAKE_COLS.length]!;
      const hr = cellPx * 0.24;
      const hx = -ux, hy = -uy; // pointing away from the body
      els.push(<g key={`S${head}`}>
        <path d={d} fill="none" stroke="rgba(0,0,0,.4)" strokeWidth={cellPx * 0.2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke={color} strokeWidth={cellPx * 0.145} strokeLinecap="round" strokeLinejoin="round" />
        <line x1={ax + hx * hr} y1={ay + hy * hr} x2={ax + hx * (hr + cellPx * 0.2)} y2={ay + hy * (hr + cellPx * 0.2)} stroke="#f87171" strokeWidth={cellPx * 0.045} strokeLinecap="round" />
        <circle cx={ax} cy={ay} r={hr} fill={color} stroke="rgba(0,0,0,.45)" strokeWidth={cellPx * 0.04} />
        <circle cx={ax + hx * cellPx * 0.07 + pxn * cellPx * 0.1} cy={ay + hy * cellPx * 0.07 + pyn * cellPx * 0.1} r={cellPx * 0.055} fill="#fff" />
        <circle cx={ax + hx * cellPx * 0.07 - pxn * cellPx * 0.1} cy={ay + hy * cellPx * 0.07 - pyn * cellPx * 0.1} r={cellPx * 0.055} fill="#fff" />
        <circle cx={ax + hx * cellPx * 0.09 + pxn * cellPx * 0.1} cy={ay + hy * cellPx * 0.09 + pyn * cellPx * 0.1} r={cellPx * 0.026} fill="#111" />
        <circle cx={ax + hx * cellPx * 0.09 - pxn * cellPx * 0.1} cy={ay + hy * cellPx * 0.09 - pyn * cellPx * 0.1} r={cellPx * 0.026} fill="#111" />
      </g>);
    });

    return els;
  }, [gameState.snakes, gameState.ladders, cellPx]);

  const moverName = moverRef.current ? nameOf(moverRef.current) : "";
  const turnName = nameOf(gameState.currentTurn);

  let status = "";
  if (gameOver) {
    status = gameOver.winnerId === youId ? "You win!" : gameOver.winnerId ? "You lose" : "Game over";
  } else if (animating) {
    status = `${moverName} is moving…`;
  } else if (gameState.isMyTurn) {
    status = rolling ? "Rolling…" : gameState.dice != null ? `You rolled ${gameState.dice}` : "Your turn — roll the dice";
  } else {
    status = gameState.dice != null ? `${turnName} rolled ${gameState.dice}` : `${turnName}'s turn…`;
  }

  const won = gameOver?.winnerId === youId;
  const bannerColor = banner?.kind === "snake" ? "#ef4444" : banner?.kind === "ladder" ? "#22c55e" : "#f5c518";

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
        .snl-hop { animation: snl-hop .18s ease; }
        .snl-slide { animation: snl-slide .62s ease-in-out; }
        .snl-climb { animation: snl-climb .56s ease; }
        .snl-glide { animation: snl-glide .42s ease; }
        @keyframes snl-hop { 0% { transform: translateY(0) scale(1); } 45% { transform: translateY(-32%) scale(1.16); } 100% { transform: translateY(0) scale(1); } }
        @keyframes snl-slide { 0%, 100% { transform: scale(1, 1); } 35% { transform: scale(1.28, .72); } 70% { transform: scale(.9, 1.12); } }
        @keyframes snl-climb { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-20%); } 70% { transform: translateY(-7%); } }
        @keyframes snl-glide { 0% { transform: scale(1); } 50% { transform: scale(1.14); } 100% { transform: scale(1); } }
        @keyframes snl-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes snl-pop { from { opacity: 0; transform: scale(.9) translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes snl-chip { 0% { opacity: 0; transform: translateX(-50%) scale(.7); } 12% { opacity: 1; transform: translateX(-50%) scale(1.05); } 20% { transform: translateX(-50%) scale(1); } 88% { opacity: 1; } 100% { opacity: 0; } }
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
          <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>{gameName || "Snakes & Ladders"}</div>
          <div style={{ fontSize: 9.5, color: T.chalkMuted }}>first to 100 wins</div>
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
        {players.map((p, i) => {
          const color = colorOf(p.id, i);
          const pos = gameState.positions?.[p.id] ?? 0;
          const active = gameState.currentTurn === p.id && !gameOver;
          const wins = gameState.scores?.[p.id] ?? 0;
          const name = gameState.playerNames?.[p.id] ?? p.name;
          return (
            <div key={p.id} style={{
              flex: 1, padding: "6px 9px", borderRadius: 10, minWidth: 0,
              background: active ? `${color}14` : `${T.chalk}05`,
              border: `1.5px solid ${active ? color : "transparent"}`,
              boxShadow: active ? `0 0 12px ${color}22` : "none",
              transition: "all .25s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: color,
                  boxShadow: active ? `0 0 6px ${color}` : "none",
                }} />
                <span style={{
                  fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700, flex: 1, minWidth: 0,
                  color: active ? color : T.chalkMuted,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{name}{p.id === youId ? " (you)" : ""}</span>
                {wins > 0 && <span style={{ fontSize: 8, color: T.chalkDim }}>{"★".repeat(Math.min(wins, 5))}</span>}
                <span style={{ fontFamily: T.fontMono, fontSize: 13, fontWeight: 800, color: active ? color : T.chalk }}>{pos}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.08)", marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(pos / TOTAL) * 100}%`, background: color, borderRadius: 2, transition: "width .4s ease" }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div ref={wrapRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: 0, minWidth: 0, padding: "4px 10px 6px",
      }}>
        <div style={{ position: "relative", width: boardPx, height: boardPx + stripPx }}>
          {/* cells */}
          {Array.from({ length: TOTAL }, (_, i) => {
            const sq = i + 1;
            const { row, col } = cellOf(sq);
            const isHead = sq in (gameState.snakes ?? {});
            const isLadder = sq in (gameState.ladders ?? {});
            const isFinish = sq === TOTAL;
            const bg = isFinish
              ? "rgba(245,197,24,.18)"
              : isHead
                ? "rgba(239,68,68,.14)"
                : isLadder
                  ? "rgba(52,211,153,.13)"
                  : (row + col) % 2 === 0 ? "#18222e" : "#1c2836";
            return (
              <div key={sq} style={{
                position: "absolute", left: px(col), top: px(row), width: cellPx, height: cellPx,
                background: bg, zIndex: 1,
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,.05)",
                fontSize: cellPx * 0.26, fontWeight: 600, fontFamily: T.fontMono,
                color: isFinish ? "#f5c518" : "rgba(255,255,255,.32)",
                display: "flex", alignItems: "flex-start", justifyContent: "flex-start",
                padding: cellPx * 0.08,
              }}>{sq}</div>
            );
          })}

          {/* snakes & ladders */}
          <svg width={boardPx} height={boardPx} style={{ position: "absolute", left: 0, top: 0, zIndex: 3, pointerEvents: "none" }}>
            {overlays}
          </svg>

          {/* start strip */}
          <div style={{
            position: "absolute", left: 0, top: boardPx, width: boardPx, height: stripPx, zIndex: 1,
            borderTop: `1.5px dashed rgba(255,255,255,.16)`,
            display: "flex", alignItems: "center",
            paddingLeft: cellPx * 0.25,
          }}>
            <span style={{ fontSize: cellPx * 0.3, fontWeight: 800, letterSpacing: 1.5, color: T.chalkDim, fontFamily: T.fontDisplay }}>
              START
            </span>
          </div>

          {/* pawns */}
          {players.map((p, i) => {
            const d = pawnRender(p.id);
            const color = colorOf(p.id, i);
            const active = gameState.currentTurn === p.id && !gameOver;
            const isAnim = d.mode !== "rest";
            const size = cellPx * 0.62 * d.scale;
            const name = gameState.playerNames?.[p.id] ?? p.name;
            return (
              <div key={p.id} style={{
                position: "absolute", left: px(d.x), top: px(d.y), zIndex: isAnim ? 15 : 10,
                width: size, height: size,
                transform: "translate(-50%, -50%)",
                transition: `left ${d.dur}ms cubic-bezier(.3,.6,.4,1), top ${d.dur}ms cubic-bezier(.3,.6,.4,1)`,
                pointerEvents: "none",
              }}>
                <div key={d.k} className={`snl-${d.mode}`} style={{
                  width: "100%", height: "100%", borderRadius: "50%",
                  background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.55), rgba(255,255,255,0) 45%), ${color}`,
                  border: "1.5px solid rgba(255,255,255,.75)",
                  boxShadow: active
                    ? `0 ${cellPx * 0.05}px ${cellPx * 0.12}px rgba(0,0,0,.55), 0 0 0 2.5px ${color}, 0 0 ${cellPx * 0.45}px ${color}`
                    : `0 ${cellPx * 0.05}px ${cellPx * 0.12}px rgba(0,0,0,.55)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 800, fontFamily: T.fontDisplay,
                  fontSize: size * 0.5, textShadow: "0 1px 2px rgba(0,0,0,.7)",
                }}>{(name[0] ?? "?").toUpperCase()}</div>
              </div>
            );
          })}

          {/* snake / ladder / finish banner */}
          {banner && (
            <div key={banner.t} style={{
              position: "absolute", left: "50%", top: 8, zIndex: 30,
              transform: "translateX(-50%)",
              padding: "5px 14px", borderRadius: 999,
              background: "rgba(8,10,14,.9)", border: `1.5px solid ${bannerColor}`,
              color: bannerColor, fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 12,
              letterSpacing: 0.6, whiteSpace: "nowrap", pointerEvents: "none",
              animation: "snl-chip 3.2s ease forwards",
              boxShadow: `0 6px 18px rgba(0,0,0,.5)`,
            }}>
              {banner.text}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar: dice + status + roll */}
      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", gap: 12,
        padding: "10px 14px calc(10px + env(safe-area-inset-bottom, 0px))",
        background: T.charcoal, borderTop: `1px solid ${T.line}`,
      }}>
        <div style={{ flexShrink: 0 }}>
          <Dice3D value={gameState.dice} rollId={rollId} spinning={rolling} size={52} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11.5, fontWeight: 600, minHeight: 15,
            color: gameState.isMyTurn ? T.green : T.chalkMuted,
          }}>{status}</div>
          {!gameOver && gameState.isMyTurn && (
            <button
              onClick={handleRoll}
              disabled={!canRoll}
              style={{
                ...T.btn, ...T.btnPrimary(accent), width: "100%", padding: "11px 0",
                fontSize: 14, fontWeight: 800, letterSpacing: 1,
                opacity: canRoll ? 1 : 0.5, cursor: canRoll ? "pointer" : "default",
              }}
            >
              {rolling ? "ROLLING…" : "ROLL DICE"}
            </button>
          )}
          {!gameOver && !gameState.isMyTurn && (
            <div style={{ fontSize: 10, color: T.chalkDim }}>
              {gameState.dice == null ? "waiting for their roll…" : "watching their move…"}
            </div>
          )}
        </div>
      </div>

      {/* Help */}
      {helpOpen && (
        <div onClick={() => setHelpOpen(false)} style={{
          position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300,
          animation: "snl-fade .2s ease", padding: 20,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 340, width: "100%", background: T.charcoal, border: `1px solid ${T.line}`,
            borderRadius: 16, padding: "20px 22px",
            animation: "snl-pop .3s cubic-bezier(.18,.9,.28,1.15)",
          }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 800, marginBottom: 12 }}>How to play</div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5, color: T.chalkMuted, lineHeight: 1.7 }}>
              <li>Roll the dice and race your pawn from <b style={{ color: T.chalk }}>START</b> (bottom-left) to <b style={{ color: "#f5c518" }}>100</b> (top-left).</li>
              <li>Land on a <b style={{ color: "#ef4444" }}>snake's head</b> and you slide down to its tail.</li>
              <li>Land at the <b style={{ color: "#22c55e" }}>bottom of a ladder</b> and you climb to its top.</li>
              <li>Everyone sees each roll and every snake bite play out live. First to 100 wins!</li>
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
          animation: "snl-fade .25s ease",
        }}>
          <div style={{
            textAlign: "center", padding: "28px 34px", background: T.charcoal,
            border: `1px solid ${T.line}`, borderRadius: 16, boxShadow: "0 24px 60px rgba(0,0,0,.5)",
            animation: "snl-pop .4s cubic-bezier(.18,.9,.28,1.2)",
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: "50%", margin: "0 auto 14px",
              background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,.5), rgba(255,255,255,0) 45%), #f5c518",
              boxShadow: "0 10px 24px rgba(0,0,0,.5), 0 0 24px rgba(245,197,24,.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#3a2a18", fontSize: 26, fontWeight: 800,
            }}>{won ? "★" : "•"}</div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 25, fontWeight: 800, letterSpacing: 0.5,
              color: won ? T.green : gameOver.winnerId ? T.pink : T.chalk, marginBottom: 6,
            }}>
              {won ? "Victory" : gameOver.winnerId ? "Defeat" : "Draw"}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkDim, marginBottom: 4 }}>
              You reached {gameState.positions?.[youId] ?? 0} · winner at {gameState.positions?.[gameOver.winnerId ?? ""] ?? 100}
            </div>
            <div style={{ fontSize: 10, color: T.chalkMuted, marginBottom: 18 }}>
              Match · {(gameState.scores?.[youId] ?? 0)}–{(gameState.scores?.[gameOver.winnerId ?? ""] ?? 0)}
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
