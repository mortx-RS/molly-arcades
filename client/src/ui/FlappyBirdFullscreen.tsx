import { useRef, useEffect, useCallback, useState } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface FlappyBirdViewBird {
  playerId: string;
  y: number;
  velocity: number;
  alive: boolean;
  score: number;
  name: string;
  color: string;
}

export interface FlappyBirdView {
  birds: FlappyBirdViewBird[];
  pipes: { x: number; gapY: number }[];
  phase: "waiting" | "countdown" | "playing" | "gameover";
  countdown: number;
  myId: string;
  myAlive: boolean;
  myScore: number;
  playerNames: Record<string, string>;
  playerColors: Record<string, string>;
  canvasW: number;
  canvasH: number;
  pipeWidth: number;
  pipeGap: number;
  groundH: number;
  birdSize: number;
  birdX: number;
}

interface Props {
  gameState: FlappyBirdView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitInput: (input: unknown) => void;
}

// ─── helpers ─────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function vibrate(p: number | number[]) { try { navigator.vibrate?.(p); } catch { /* ignore */ } }

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
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

  private blip(f0: number, f1: number, dur: number, vol: number, delay = 0, type: OscillatorType = "triangle") {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
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

  flap() { this.noise(2000, 0.05, 0.16); this.blip(500, 850, 0.06, 0.1); }
  score() { this.blip(880, 880, 0.09, 0.2); this.blip(1245, 1245, 0.12, 0.16, 0.08); }
  thud() { this.noise(500, 0.08, 0.14); }
  die() { this.blip(320, 90, 0.22, 0.22, 0, "sawtooth"); this.noise(400, 0.12, 0.2, 0.02); }
  tick() { this.blip(550, 550, 0.05, 0.14); }
  ready() { this.blip(440, 440, 0.1, 0.15); }
  go() { this.blip(660, 660, 0.09, 0.18); this.blip(990, 990, 0.14, 0.18, 0.09); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, f, 0.16, 0.2, i * 0.12)); }
  lose() { this.blip(330, 330, 0.2, 0.18); this.blip(247, 247, 0.3, 0.16, 0.18); }
}

const SoundIcon = ({ off }: { off: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ─── interpolation types ─────────────────────────────────────────────

interface SnapBird { pid: string; y: number; v: number; alive: boolean; score: number }
interface SnapPipe { x: number; gapY: number }
interface Snap { t: number; phase: string; countdown: number; birds: SnapBird[]; pipes: SnapPipe[] }

interface IBird { pid: string; y: number; v: number; alive: boolean; score: number }
interface IPipe { x: number; gapY: number }

interface Particle { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; maxLife: number; color: string; size: number }
interface Popup { x: number; y: number; t: number }

// ─── Component ───────────────────────────────────────────────────────

export function FlappyBirdFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitInput }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeRef = useRef({ scale: 1, dpr: 1, cssW: 320, cssH: 480 });
  const gsRef = useRef(gameState); gsRef.current = gameState;

  const snapshotsRef = useRef<Snap[]>([]);
  const intervalRef = useRef(0);       // ema of ms between snapshots
  const delayRef = useRef(50);         // render behind latest snapshot
  const speedRef = useRef(0);          // est. world scroll px/s
  const worldXRef = useRef(0);         // scroll accumulator
  const prevPhaseRef = useRef<string>(gameState.phase);

  const flapAnimRef = useRef(0);
  const shakeRef = useRef(-1e9);
  const hurtRef = useRef(-1e9);
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const lastFrameRef = useRef(0);
  const cdNumRef = useRef<number | null>(null);
  const lastFlapRef = useRef(0);

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();

  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("flappy_muted") === "1"; } catch { return false; }
  });
  const [cdDisplay, setCdDisplay] = useState(3);
  const [hintVisible, setHintVisible] = useState(true);

  // ── input (protocol unchanged: only { type: "flap" }) ──────────────

  const handleFlap = useCallback(() => {
    const now = Date.now();
    if (now - lastFlapRef.current < 50) return;
    lastFlapRef.current = now;
    sfxRef.current!.ensure();
    sfxRef.current!.flap();
    flapAnimRef.current = performance.now(); // instant local feedback
    setHintVisible(false);
    onSubmitInput({ type: "flap" });
  }, [onSubmitInput]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        handleFlap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleFlap]);

  useEffect(() => {
    sfxRef.current!.enabled = !muted;
    try { localStorage.setItem("flappy_muted", muted ? "1" : "0"); } catch { /* ignore */ }
  }, [muted]);

  // ── snapshot intake + event detection ──────────────────────────────

  useEffect(() => {
    const gs = gameState;
    const t = performance.now();
    const snap: Snap = {
      t, phase: gs.phase, countdown: gs.countdown ?? 0,
      birds: (gs.birds ?? []).map((b) => ({ pid: b.playerId, y: b.y, v: b.velocity, alive: b.alive, score: b.score })),
      pipes: (gs.pipes ?? []).map((p) => ({ x: p.x, gapY: p.gapY })),
    };
    const snaps = snapshotsRef.current;
    const prev = snaps[snaps.length - 1] ?? null;

    if (prev) {
      const dt = t - prev.t;
      if (dt > 5 && dt < 2000) {
        intervalRef.current = intervalRef.current ? intervalRef.current * 0.85 + dt * 0.15 : dt;
        delayRef.current = clamp(intervalRef.current, 16, 110);
      }

      // deaths → sound + feathers (+ shake/vignette if me)
      for (const nb of snap.birds) {
        const ob = prev.birds.find((b) => b.pid === nb.pid);
        if (!ob) continue;
        if (ob.alive && !nb.alive) {
          const mine = nb.pid === youId;
          const meta = gs.birds.find((b) => b.playerId === nb.pid);
          const color = meta?.color ?? "#9aa";
          for (let i = 0; i < (mine ? 10 : 6); i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 50 + Math.random() * 150;
            particlesRef.current.push({
              x: gs.birdX, y: nb.y,
              vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 70,
              rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 9,
              life: 0, maxLife: 700 + Math.random() * 400, color, size: 3 + Math.random() * 2,
            });
          }
          if (mine) { sfxRef.current!.die(); vibrate([30, 50, 30]); shakeRef.current = t; hurtRef.current = t; }
          else { sfxRef.current!.thud(); }
        }
        // my score → ding + popup
        if (nb.pid === youId && nb.score > ob.score) {
          popupsRef.current.push({ x: gs.birdX, y: nb.y - gs.birdSize, t });
          sfxRef.current!.score();
          vibrate(12);
        }
      }

      // world speed estimate from pipe dx (lets the scenery scroll correctly)
      if (snap.phase === "playing" && snap.pipes.length > 0 && prev.pipes.length > 0 && dt > 5) {
        const dts = dt / 1000;
        const ds: number[] = [];
        for (const np of snap.pipes) {
          let match: SnapPipe | null = null;
          let best = Infinity;
          for (const pp of prev.pipes) {
            const d = Math.abs(pp.x - np.x);
            if (d < best) { best = d; match = pp; }
          }
          if (match && match.x >= np.x && best < 400) ds.push((match.x - np.x) / dts);
        }
        if (ds.length > 0) {
          const med = median(ds);
          if (med > 10 && med < 2000) speedRef.current = speedRef.current ? speedRef.current * 0.8 + med * 0.2 : med;
        }
      }
    }

    // phase transitions
    if (prevPhaseRef.current !== gs.phase) {
      if (gs.phase === "countdown") sfxRef.current!.ready();
      if (gs.phase === "playing" && prevPhaseRef.current === "countdown") { sfxRef.current!.go(); setHintVisible(true); cdNumRef.current = null; }
      prevPhaseRef.current = gs.phase;
    }

    snaps.push(snap);
    if (snaps.length > 14) snaps.shift();
  }, [gameState, youId]);

  // ── resize (DPR-aware, centered) ───────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const W = gameState.canvasW;
    const H = gameState.canvasH;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const scale = Math.min((rect.width - 8) / W, (rect.height - 8) / H);
      const dpr = window.devicePixelRatio || 1;
      const cssW = Math.max(80, Math.floor(W * scale));
      const cssH = Math.max(80, Math.floor(H * scale));
      sizeRef.current = { scale: cssW / W, dpr, cssW, cssH };
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    return () => observer.disconnect();
  }, [gameState.canvasW, gameState.canvasH]);

  // ── game over sound ────────────────────────────────────────────────

  useEffect(() => {
    if (!gameOver || gameState.phase !== "gameover") return;
    sfxRef.current!.ensure();
    if (gameOver.winnerId === youId) { sfxRef.current!.win(); vibrate([30, 60, 30, 60, 90]); }
    else if (gameOver.winnerId) { sfxRef.current!.lose(); vibrate(150); }
  }, [gameOver, youId, gameState.phase]);

  // ── render loop (single rAF, 60fps, interpolated) ──────────────────

  useEffect(() => {
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = performance.now();
      const gs = gsRef.current;
      const { canvasW: W, canvasH: H, pipeWidth: PW, pipeGap: PG, groundH: GH, birdSize: BS, birdX: BX } = gs;
      const { scale, dpr, cssW, cssH } = sizeRef.current;

      const dt = Math.min(0.05, (now - (lastFrameRef.current || now)) / 1000);
      lastFrameRef.current = now;

      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      const s = sizeRef.current.scale = cssW / W;

      ctx.setTransform(dpr * s, 0, 0, dpr * s, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // interpolated world state at render time
      const snaps = snapshotsRef.current;
      const newest = snaps[snaps.length - 1];
      let iBirds: IBird[] = [];
      let iPipes: IPipe[] = [];
      let phase: string = gs.phase;
      if (newest) {
        phase = newest.phase;
        const rt = now - delayRef.current;
        let bi = snaps.length - 1;
        while (bi > 0 && snaps[bi - 1]!.t > rt) bi--;
        const B = snaps[bi]!;
        const A = bi > 0 ? snaps[bi - 1]! : B;
        const alpha = clamp((rt - A.t) / Math.max(1, B.t - A.t), 0, 1);

        iBirds = B.birds.map((b) => {
          const a = A.birds.find((x) => x.pid === b.pid);
          return a
            ? { pid: b.pid, y: lerp(a.y, b.y, alpha), v: lerp(a.v, b.v, alpha), alive: b.alive, score: b.score }
            : { ...b };
        });
        // pipes paired by nearest x (handles spawn/despawn at either end)
        iPipes = B.pipes.map((np) => {
          let match: SnapPipe | null = null;
          let best = Infinity;
          for (const pp of A.pipes) {
            const d = Math.abs(pp.x - np.x);
            if (d < best) { best = d; match = pp; }
          }
          return match && best < 400
            ? { x: lerp(match.x, np.x, alpha), gapY: lerp(match.gapY, np.gapY, alpha) }
            : { ...np };
        });

        // countdown is time-based → exact even between snapshots
        if (phase === "countdown") {
          const cd = Math.max(0, newest.countdown - (now - newest.t) / 1000);
          const n = Math.ceil(cd);
          if (n !== cdNumRef.current) { cdNumRef.current = n; setCdDisplay(n); if (n > 0) sfxRef.current!.tick(); }
        }
        if (phase === "playing") worldXRef.current += (speedRef.current || 0) * dt;
      }

      // screen shake on my death
      const shAge = now - shakeRef.current;
      ctx.save();
      if (shAge >= 0 && shAge < 350) {
        const amp = 7 * (1 - shAge / 350);
        ctx.translate(Math.sin(shAge * 0.09) * amp, Math.cos(shAge * 0.13) * amp * 0.7);
      }

      // sky + static stars (cached — no per-frame shimmer)
      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, "#1a0a2e");
      skyGrad.addColorStop(0.5, "#16213e");
      skyGrad.addColorStop(1, "#0f3460");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 137.5) % W;
        const sy = (i * 73.3) % (H - GH);
        const sr = 0.5 + (i % 3) * 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // drifting far stars + hills (parallax)
      const wx = worldXRef.current;
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      for (let i = 0; i < 18; i++) {
        const bx = (i * 211.7 + 40) % W;
        const x = ((bx - wx * 0.03) % W + W) % W;
        const y = (i * 97.1) % (H - GH - 60);
        const tw = 0.5 + 0.5 * Math.sin(now / 900 + i * 1.7);
        ctx.globalAlpha = 0.25 + tw * 0.4;
        ctx.beginPath();
        ctx.arc(x, y, 0.6 + (i % 2) * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      drawHills(ctx, W, H - GH, wx);

      // pipes
      for (const pipe of iPipes) {
        const topH = pipe.gapY;
        const botY = pipe.gapY + PG;
        const grad = ctx.createLinearGradient(pipe.x, 0, pipe.x + PW, 0);
        grad.addColorStop(0, "#2d6a4f");
        grad.addColorStop(0.3, "#40916c");
        grad.addColorStop(0.7, "#40916c");
        grad.addColorStop(1, "#1b4332");
        ctx.fillStyle = grad;
        ctx.fillRect(pipe.x, 0, PW, topH);
        ctx.fillRect(pipe.x, botY, PW, H - GH - botY);
        ctx.fillStyle = "#52b788";
        ctx.fillRect(pipe.x - 4, topH - 20, PW + 8, 20);
        ctx.fillRect(pipe.x - 4, botY, PW + 8, 20);
        ctx.fillStyle = "#40916c";
        ctx.fillRect(pipe.x - 4, topH - 6, PW + 8, 6);
        ctx.fillRect(pipe.x - 4, botY + 14, PW + 8, 6);
      }

      // ground with scrolling stripes
      const gy = H - GH;
      const groundGrad = ctx.createLinearGradient(0, gy, 0, H);
      groundGrad.addColorStop(0, "#5c4033");
      groundGrad.addColorStop(0.3, "#8b6914");
      groundGrad.addColorStop(1, "#3d2b1f");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, gy, W, GH);
      ctx.fillStyle = "#7ec850";
      ctx.fillRect(0, gy, W, 4);
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      const off = wx % 44;
      for (let x = -44 - off; x < W + 44; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, gy + 9);
        ctx.lineTo(x + 18, gy + 9);
        ctx.lineTo(x + 10, H);
        ctx.lineTo(x - 8, H);
        ctx.closePath();
        ctx.fill();
      }

      // birds: dead behind, alive next, mine on top
      const order = [...iBirds].sort((a, b) =>
        ((a.pid === youId && a.alive) ? 2 : a.alive ? 1 : 0) - ((b.pid === youId && b.alive) ? 2 : b.alive ? 1 : 0)
      );
      for (const b of order) {
        const meta = gs.birds.find((x) => x.playerId === b.pid);
        drawBird(ctx, b, meta, BX, BS, now, b.pid === youId ? flapAnimRef.current : 0);
      }

      // particles (feathers)
      particlesRef.current = particlesRef.current.filter((p) => p.life < p.maxLife);
      for (const p of particlesRef.current) {
        p.life += dt * 1000;
        p.vy += 500 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = clamp(1 - p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      // score popups
      popupsRef.current = popupsRef.current.filter((p) => now - p.t < 800);
      for (const p of popupsRef.current) {
        const age = (now - p.t) / 800;
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = "#f5c518";
        ctx.font = `bold 13px ${T.fontMono}`;
        ctx.textAlign = "center";
        ctx.strokeStyle = "rgba(0,0,0,.6)";
        ctx.lineWidth = 3;
        const ty = p.y - age * 34;
        ctx.strokeText("+1", p.x, ty);
        ctx.fillText("+1", p.x, ty);
      }
      ctx.globalAlpha = 1;

      ctx.restore(); // shake

      // red vignette after my death
      const hAge = now - hurtRef.current;
      if (hAge >= 0 && hAge < 600) {
        const a = (1 - hAge / 600) * 0.35;
        const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
        vg.addColorStop(0, "rgba(239,68,68,0)");
        vg.addColorStop(1, `rgba(239,68,68,${a})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [youId]);

  const phase = gameState.phase;
  const winner = gameOver?.winnerId;
  const winnerName = winner ? (gameState.playerNames[winner] ?? room.players.find((p) => p.id === winner)?.name) : null;
  const aliveCount = gameState.birds.filter((b) => b.alive).length;

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: T.bgDeep,
      color: T.chalk,
      fontFamily: T.fontBody,
      overflow: "hidden",
      userSelect: "none",
      WebkitUserSelect: "none",
    }}>
      <style>{`
        @keyframes flap-pulse { 0%, 100% { transform: scale(1); opacity: .85; } 50% { transform: scale(1.12); opacity: 1; } }
        @keyframes flap-pop { 0% { transform: scale(1.6); opacity: 0; } 25% { transform: scale(1); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes flap-hint { 0%, 100% { opacity: .4; } 50% { opacity: 1; } }
        @keyframes flap-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        flexShrink: 0,
        background: "rgba(8, 8, 15, 0.7)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.line}`,
        zIndex: 10,
        gap: 8,
      }}>
        <button onClick={onLeave} aria-label="Leave game" style={{
          background: T.charcoal,
          border: `1px solid ${T.line}`,
          borderRadius: 12,
          width: 40, height: 40, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: T.chalk, fontSize: 18,
        }}>‹</button>
        <div style={{ textAlign: "center", minWidth: 0 }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700 }}>{gameName}</div>
          <div style={{ fontSize: 10, color: T.chalkMuted }}>last bird standing · SPACE / tap to flap</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {gameState.birds.map((b) => (
            <div key={b.playerId} style={{ textAlign: "center", opacity: b.alive ? 1 : 0.4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: 999, background: b.color,
                margin: "0 auto 2px",
                boxShadow: b.alive ? `0 0 6px ${b.color}60` : "none",
                outline: b.playerId === youId ? `1.5px solid ${T.chalk}` : "none",
                outlineOffset: 2,
              }} />
              <div style={{ fontFamily: T.fontMono, fontSize: 12, fontWeight: 700, color: b.alive ? b.color : T.chalkMuted }}>
                {b.score}
              </div>
            </div>
          ))}
          <button onClick={() => { setMuted((m) => !m); sfxRef.current!.ensure(); }} aria-label={muted ? "Unmute" : "Mute"} style={{
            background: T.charcoal, border: `1px solid ${T.line}`, borderRadius: 10,
            width: 30, height: 30, flexShrink: 0, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: muted ? T.chalkMuted : T.chalk,
          }}>
            <SoundIcon off={muted} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        onPointerDown={(e) => { e.preventDefault(); handleFlap(); }}
      >
        <canvas ref={canvasRef} style={{ display: "block", maxWidth: "100%", maxHeight: "100%", borderRadius: 4, touchAction: "none" }} />

        {/* first-tap hint */}
        {phase === "playing" && hintVisible && gameState.myAlive && (
          <div style={{
            position: "absolute", left: "50%", top: "28%", transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none", animation: "flap-hint 1.4s ease-in-out infinite",
          }}>
            <div style={{ fontSize: 30 }}>👆</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.chalk, textShadow: "0 2px 8px rgba(0,0,0,.8)" }}>
              TAP or press SPACE to flap
            </div>
          </div>
        )}

        {/* Waiting overlay */}
        {phase === "waiting" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(4, 4, 10, 0.85)", gap: 16, animation: "flap-fade .3s ease",
          }}>
            <div style={{ fontSize: 48, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}>🐦</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.chalk }}>Flappy Bird</div>
            <div style={{ fontSize: 13, color: T.chalkDim, textAlign: "center", maxWidth: 260 }}>
              Tap anywhere (or press SPACE) to flap. Dodge the pipes. Last bird standing wins!
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {gameState.birds.map((b) => (
                <div key={b.playerId} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 10px",
                  background: T.charcoal, border: `1px solid ${b.playerId === youId ? `${b.color}66` : T.line}`,
                  borderRadius: 8, fontSize: 12, color: b.color, fontWeight: 600,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: b.color }} />
                  {b.name}
                </div>
              ))}
            </div>
            {gameOver && (
              <div style={{
                marginTop: 8, padding: "10px 20px", background: T.greenDim,
                border: `1px solid ${T.green}30`, borderRadius: 10,
                color: T.green, fontSize: 13, fontWeight: 700,
              }}>
                {winnerName ? `${winnerName} won the last round!` : "Draw!"}
              </div>
            )}
          </div>
        )}

        {/* Countdown overlay */}
        {phase === "countdown" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 4,
            background: "rgba(4, 4, 10, 0.5)", pointerEvents: "none",
          }}>
            <div key={cdDisplay} style={{
              fontFamily: T.fontDisplay, fontSize: 72, fontWeight: 900, color: T.neon,
              textShadow: `0 0 40px ${T.neonGlow}, 0 0 80px ${T.neonDim}`,
              animation: "flap-pop .45s cubic-bezier(.2,.9,.3,1.2)",
            }}>
              {cdDisplay > 0 ? cdDisplay : "GO!"}
            </div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 13, letterSpacing: 2, color: T.chalkDim }}>GET READY</div>
          </div>
        )}

        {/* Game over overlay */}
        {phase === "gameover" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "rgba(4, 4, 10, 0.85)", gap: 12, animation: "flap-fade .25s ease",
          }}>
            <div style={{ fontSize: 48, filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.5))" }}>
              {gameOver?.winnerId === youId ? "🏆" : "💥"}
            </div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 900,
              color: gameOver?.winnerId === youId ? T.green : T.red,
              textTransform: "uppercase",
            }}>
              {gameOver?.winnerId === youId ? "Last Bird Standing!" : "Eliminated!"}
            </div>
            {winnerName && (
              <div style={{ fontSize: 14, color: T.chalkDim }}>
                {winnerName} wins with {gameState.birds.find((b) => b.playerId === gameOver?.winnerId)?.score ?? 0} points
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              {[...gameState.birds].sort((a, b) => b.score - a.score).map((b, i) => (
                <div key={b.playerId} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
                  background: b.playerId === gameOver?.winnerId ? `${T.gold}15` : T.charcoal,
                  border: `1px solid ${b.playerId === gameOver?.winnerId ? `${T.gold}40` : T.line}`,
                  borderRadius: 8, fontSize: 12, color: b.color, fontWeight: 600,
                }}>
                  <span style={{ fontFamily: T.fontMono, color: T.chalkMuted, fontSize: 10 }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                  </span>
                  {b.name}
                  <span style={{ fontFamily: T.fontMono, fontWeight: 700, color: b.alive ? b.color : T.chalkMuted }}>
                    {b.score}
                  </span>
                  {!b.alive && <span style={{ color: T.red, fontSize: 10 }}>✕</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alive indicator */}
      {phase === "playing" && (
        <div style={{
          padding: "8px 16px",
          paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))",
          textAlign: "center",
          flexShrink: 0,
          background: "rgba(8, 8, 15, 0.7)",
          backdropFilter: "blur(12px)",
          borderTop: `1px solid ${T.line}`,
        }}>
          <span style={{
            fontFamily: T.fontMono, fontSize: 12,
            color: gameState.myAlive ? T.green : T.red, fontWeight: 600,
          }}>
            {gameState.myAlive
              ? `${aliveCount} bird${aliveCount !== 1 ? "s" : ""} alive`
              : `You were eliminated · spectating ${aliveCount} bird${aliveCount !== 1 ? "s" : ""}`}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── drawing helpers ─────────────────────────────────────────────────

function drawHills(ctx: CanvasRenderingContext2D, W: number, horizon: number, worldX: number) {
  const layer = (par: number, color: string, amp: number, wl: number) => {
    ctx.beginPath();
    ctx.moveTo(0, horizon);
    for (let x = 0; x <= W; x += 10) {
      const wxv = x + worldX * par;
      const h = Math.abs(Math.sin(wxv / wl) * amp * 0.6 + Math.sin(wxv / (wl * 0.41) + 1.7) * amp * 0.4);
      ctx.lineTo(x, horizon - 12 - h);
    }
    ctx.lineTo(W, horizon);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  layer(0.055, "#0c1a33", 40, 210);
  layer(0.13, "#122140", 26, 140);
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  b: IBird,
  meta: { name: string; color: string } | undefined,
  BX: number, BS: number,
  now: number,
  flapAt: number
) {
  const color = meta?.color ?? "#9aa";
  const name = meta?.name ?? "";
  const fa = flapAt ? now - flapAt : Infinity;
  const squash = fa < 160 ? 1 - 0.16 * (1 - fa / 160) : 1;

  ctx.save();
  ctx.translate(BX, b.y);
  ctx.rotate(clamp(b.v / 800, -0.5, 1.2));
  ctx.scale(2 - squash, squash); // squash: wider + flatter for a beat after flap
  if (!b.alive) ctx.globalAlpha = 0.75;

  if (b.alive) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
  ctx.fillStyle = b.alive ? color : "#555";
  ctx.beginPath();
  ctx.ellipse(0, 0, BS / 2, BS / 2.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // wing — flaps faster right after a tap
  const wingSpd = fa < 220 ? 55 : 80;
  const wingAmp = fa < 220 ? 8 : 5;
  const wingFlap = b.alive ? Math.sin(now / wingSpd) * wingAmp : 0;
  ctx.fillStyle = b.alive ? "#fff" : "#777";
  ctx.beginPath();
  ctx.ellipse(-4, -2 + wingFlap, 8, 5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(8, -4, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4a261";
  ctx.beginPath();
  ctx.moveTo(10, -1);
  ctx.lineTo(16, 1);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();

  if (!b.alive) {
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(6, 6);
    ctx.moveTo(6, -6);
    ctx.lineTo(-6, 6);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  if (b.alive) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = `bold 10px ${T.fontBody}`;
    ctx.textAlign = "center";
    const nameW = ctx.measureText(name).width;
    ctx.fillRect(BX - nameW / 2 - 3, b.y - BS / 2 - 16, nameW + 6, 13);
    ctx.fillStyle = color;
    ctx.fillText(name, BX, b.y - BS / 2 - 6);
  }

  ctx.fillStyle = b.alive ? "#fff" : "#666";
  ctx.font = `bold 11px ${T.fontMono}`;
  ctx.textAlign = "center";
  ctx.fillText(`${b.score}`, BX, b.y + BS / 2 + 14);
}
