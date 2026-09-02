import { useState, useRef, useEffect, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent, CSSProperties } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

export interface PoolView {
  currentTurn: string;
  isMyTurn: boolean;
  assignments: [string | null, string | null];
  myAssignment: string | null;
  foul: string | null;
  winnerId: string | null;
  message: string;
  playerNames: Record<string, string>;
  playerIds: [string, string];
  break_shot: boolean;
  ballPositions?: { id: number; x: number; y: number; pocketed: boolean }[];
  incomingShot?: { angle: number; power: number };
}

interface Vec2 { x: number; y: number }

interface Ball {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  color: string;
  stripe: boolean;
  solid: boolean;
  isEight: boolean;
  isCue: boolean;
  pocketed: boolean;
  label: string;
  quat: Quat; // 3D orientation — purely visual, never serialized
}

type BallPos = { id: number; x: number; y: number; pocketed: boolean };

const TABLE_W = 340;
const TABLE_H = 600;
const CUSHION = 26;
const BALL_R = 9;
const POCKET_R = 16;
const MAX_POWER = 14;
const CUSHION_LOSS = 0.78;
const BALL_RESTITUTION = 0.96;

// rolling resistance: constant deceleration + tiny speed-proportional drag.
// Feels like a real ball — long roll-out, then a crisp settle (no exponential crawl).
const ROLL_DECEL = 0.06;
const ROLL_DRAG = 0.003;
const STOP_SPEED = 0.12;
const CUSHION_TANGENT_KEEP = 0.96; // cushions grab a little tangential speed

const PLAYBACK_TPS = 110;
const PLAYBACK_FAST_TPS = 250;
const CHARGE_GRAB_R = 60;
const PULL_SCALE = 0.1;
const STRIKE_MS = 90;
const WINDUP_MS = 170;
const SWALLOW_TICKS = 14; // pocket-drop animation length (sim ticks)

const BALL_COLORS: Record<number, { color: string; stripe: boolean; solid: boolean }> = {
  0: { color: "#f5f5f0", stripe: false, solid: false },
  1: { color: "#f5c518", stripe: false, solid: true },
  2: { color: "#2563eb", stripe: false, solid: true },
  3: { color: "#dc2626", stripe: false, solid: true },
  4: { color: "#7c3aed", stripe: false, solid: true },
  5: { color: "#f97316", stripe: false, solid: true },
  6: { color: "#16a34a", stripe: false, solid: true },
  7: { color: "#92400e", stripe: false, solid: true },
  8: { color: "#111111", stripe: false, solid: false },
  9: { color: "#f5c518", stripe: true, solid: false },
  10: { color: "#2563eb", stripe: true, solid: false },
  11: { color: "#dc2626", stripe: true, solid: false },
  12: { color: "#7c3aed", stripe: true, solid: false },
  13: { color: "#f97316", stripe: true, solid: false },
  14: { color: "#16a34a", stripe: true, solid: false },
  15: { color: "#92400e", stripe: true, solid: false },
};

const POCKETS: Vec2[] = [
  { x: -2, y: -2 },
  { x: TABLE_W + 2, y: -2 },
  { x: -4, y: TABLE_H / 2 },
  { x: TABLE_W + 4, y: TABLE_H / 2 },
  { x: -2, y: TABLE_H + 2 },
  { x: TABLE_W + 2, y: TABLE_H + 2 },
];

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ─── Quaternions (ball orientation for true rolling) ────────────────
// Convention: right-handed view space — x right, y down, z INTO the screen
// (away from the viewer). The point facing the viewer is at z = -1.

interface Quat { x: number; y: number; z: number; w: number }

function quatMul(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function quatNormalize(q: Quat): Quat {
  const l = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / l, y: q.y / l, z: q.z / l, w: q.w / l };
}

function quatAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(angle / 2) };
}

function quatNlerp(a: Quat, b: Quat, t: number): Quat {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w;
  if (a.x * bx + a.y * by + a.z * bz + a.w * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  return quatNormalize({
    x: a.x + (bx - a.x) * t,
    y: a.y + (by - a.y) * t,
    z: a.z + (bz - a.z) * t,
    w: a.w + (bw - a.w) * t,
  });
}

// Moving by (dx, dy) rolls the ball about the horizontal axis perpendicular
// to travel by exactly distance/radius radians — the surface point facing the
// viewer moves in the travel direction, exactly like real rolling.
function rollQuat(q: Quat, dx: number, dy: number, radius: number): Quat {
  const d = Math.hypot(dx, dy);
  if (d < 1e-7) return q;
  let nq = quatMul(quatAxisAngle(dy / d, -dx / d, 0, d / radius), q);
  if (nq.w < 0) nq = { x: -nq.x, y: -nq.y, z: -nq.z, w: -nq.w }; // keep w positive for nlerp
  return nq;
}

function createBall(id: number, pos: Vec2): Ball {
  const info = BALL_COLORS[id] ?? { color: "#888", stripe: false, solid: false };
  // random orientation, like a freshly broken rack
  const ax = Math.random() * 2 - 1;
  const ay = Math.random() * 2 - 1;
  const az = Math.random() * 2 - 1;
  const al = Math.hypot(ax, ay, az) || 1;
  return {
    id, pos: { ...pos }, vel: { x: 0, y: 0 }, radius: BALL_R,
    color: info.color, stripe: info.stripe, solid: info.solid,
    isEight: id === 8, isCue: id === 0, pocketed: false,
    label: id === 0 ? "" : String(id),
    quat: quatNormalize(quatAxisAngle(ax / al, ay / al, az / al, Math.random() * Math.PI * 2)),
  };
}

function rackBalls(): Ball[] {
  const balls: Ball[] = [];
  balls.push(createBall(0, { x: TABLE_W / 2, y: TABLE_H * 0.22 }));

  const rackX = TABLE_W / 2;
  const rackY = TABLE_H * 0.73;
  const spacing = BALL_R * 2.08;
  const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let idx = 0;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = rackX + (col - row / 2) * spacing;
      const y = rackY - row * spacing * 0.866;
      balls.push(createBall(rackOrder[idx]!, { x, y }));
      idx++;
    }
  }
  return balls;
}

function isNearPocket(pos: Vec2): boolean {
  return POCKETS.some((p) => dist(pos, p) < POCKET_R * 1.25);
}

function serializeBalls(balls: Ball[]): BallPos[] {
  return balls.map((b) => ({ id: b.id, x: Math.round(b.pos.x * 100) / 100, y: Math.round(b.pos.y * 100) / 100, pocketed: b.pocketed }));
}

function applyBallState(balls: Ball[], state: BallPos[]): Ball[] {
  const stateMap = new Map(state.map((s) => [s.id, s]));
  return balls.map((b) => {
    const s = stateMap.get(b.id);
    if (!s) return b;
    return { ...b, pos: { x: s.x, y: s.y }, pocketed: s.pocketed, vel: { x: 0, y: 0 } };
  });
}

// ─── Physics (simulated up-front, played back frame-by-frame) ────────

interface SimEvent { tick: number; type: "ball" | "cushion" | "pocket"; x: number; y: number; strength: number }

interface SimResult {
  frames: Ball[][];
  events: SimEvent[];
  finalBalls: Ball[];
  pocketedIds: number[];
  cuePocketed: boolean;
  firstHit: number | null;
}

function maxBallSpeed(balls: Ball[]): number {
  let m = 0;
  for (const b of balls) {
    if (b.pocketed) continue;
    const s = Math.abs(b.vel.x) + Math.abs(b.vel.y);
    if (s > m) m = s;
  }
  return m;
}

function simulateShot(balls: Ball[], shotAngle: number, shotPower: number): SimResult {
  const sim = balls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel }, quat: { ...b.quat } }));

  const cue = sim.find((b) => b.isCue);
  if (cue && !cue.pocketed) {
    cue.vel.x = Math.cos(shotAngle) * shotPower;
    cue.vel.y = Math.sin(shotAngle) * shotPower;
  }

  const frames: Ball[][] = [];
  const events: SimEvent[] = [];
  const pocketedIds: number[] = [];
  let firstHit: number | null = null;

  const pocketBall = (b: Ball, p: Vec2, tick: number) => {
    b.pocketed = true;
    b.vel.x = 0; b.vel.y = 0;
    events.push({ tick, type: "pocket", x: p.x, y: p.y, strength: 1 });
    if (!b.isCue) pocketedIds.push(b.id);
  };

  for (let tick = 0; tick < 1000; tick++) {
    const spd = maxBallSpeed(sim);
    if (spd === 0) break;

    // adaptive substeps prevent fast balls tunneling through others
    const substeps = Math.max(1, Math.ceil(spd / (BALL_R * 0.75)));

    for (let ss = 0; ss < substeps; ss++) {
      for (const b of sim) {
        if (b.pocketed) continue;
        const dx = b.vel.x / substeps;
        const dy = b.vel.y / substeps;
        b.pos.x += dx;
        b.pos.y += dy;
        b.quat = rollQuat(b.quat, dx, dy, b.radius); // roll as it moves
      }

      for (const b of sim) {
        if (b.pocketed || isNearPocket(b.pos)) continue;
        let impact = 0;
        let hx = b.pos.x;
        let hy = b.pos.y;
        if (b.pos.x - b.radius < 0) {
          impact = Math.abs(b.vel.x); hx = 0;
          b.pos.x = b.radius; b.vel.x = impact * CUSHION_LOSS;
          b.vel.y *= CUSHION_TANGENT_KEEP;
        } else if (b.pos.x + b.radius > TABLE_W) {
          impact = Math.abs(b.vel.x); hx = TABLE_W;
          b.pos.x = TABLE_W - b.radius; b.vel.x = -impact * CUSHION_LOSS;
          b.vel.y *= CUSHION_TANGENT_KEEP;
        }
        if (b.pos.y - b.radius < 0) {
          const v = Math.abs(b.vel.y);
          if (v > impact) { impact = v; hx = b.pos.x; hy = 0; }
          b.pos.y = b.radius; b.vel.y = v * CUSHION_LOSS;
          b.vel.x *= CUSHION_TANGENT_KEEP;
        } else if (b.pos.y + b.radius > TABLE_H) {
          const v = Math.abs(b.vel.y);
          if (v > impact) { impact = v; hx = b.pos.x; hy = TABLE_H; }
          b.pos.y = TABLE_H - b.radius; b.vel.y = -v * CUSHION_LOSS;
          b.vel.x *= CUSHION_TANGENT_KEEP;
        }
        if (impact > 0.35) events.push({ tick, type: "cushion", x: hx, y: hy, strength: impact });
      }

      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const a = sim[i]!;
          const b = sim[j]!;
          if (a.pocketed || b.pocketed) continue;

          const dx = b.pos.x - a.pos.x;
          const dy = b.pos.y - a.pos.y;
          const minDist = a.radius + b.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minDist * minDist) continue;
          const d = Math.sqrt(d2);
          if (d < 1e-6) continue;

          const nx = dx / d;
          const ny = dy / d;
          const van = (a.vel.x - b.vel.x) * nx + (a.vel.y - b.vel.y) * ny;

          const overlap = minDist - d;
          if (overlap > 0.001) {
            a.pos.x -= nx * overlap * 0.5; a.pos.y -= ny * overlap * 0.5;
            b.pos.x += nx * overlap * 0.5; b.pos.y += ny * overlap * 0.5;
          }
          if (van <= 0) continue;

          if (firstHit === null && (a.isCue || b.isCue)) firstHit = a.isCue ? b.id : a.id;

          const impulse = van * BALL_RESTITUTION;
          a.vel.x -= impulse * nx; a.vel.y -= impulse * ny;
          b.vel.x += impulse * nx; b.vel.y += impulse * ny;
          if (van > 0.4) {
            events.push({ tick, type: "ball", x: (a.pos.x + b.pos.x) / 2, y: (a.pos.y + b.pos.y) / 2, strength: van });
          }
        }
      }

      for (const b of sim) {
        if (b.pocketed) continue;
        let captured: Vec2 | null = null;
        for (const p of POCKETS) {
          if (dist(b.pos, p) < POCKET_R) { captured = p; break; }
        }
        if (!captured) {
          // failsafe: a ball pushed past the rails near a pocket mouth is
          // swallowed (prevents balls escaping through the pocket-skip zone)
          const out =
            b.pos.x < -b.radius * 0.5 || b.pos.x > TABLE_W + b.radius * 0.5 ||
            b.pos.y < -b.radius * 0.5 || b.pos.y > TABLE_H + b.radius * 0.5;
          if (out) {
            let best: Vec2 | null = null;
            let bd = Infinity;
            for (const p of POCKETS) {
              const d = dist(b.pos, p);
              if (d < bd) { bd = d; best = p; }
            }
            if (bd < POCKET_R * 2.3) captured = best;
            else {
              b.pos.x = clamp(b.pos.x, b.radius, TABLE_W - b.radius);
              b.pos.y = clamp(b.pos.y, b.radius, TABLE_H - b.radius);
            }
          }
        }
        if (captured) pocketBall(b, captured, tick);
      }
    }

    // rolling resistance — constant decel + slight drag, realistic roll-out
    for (const b of sim) {
      if (b.pocketed) continue;
      const sp = Math.hypot(b.vel.x, b.vel.y);
      if (sp <= 0) continue;
      const ns = sp - (ROLL_DECEL + sp * ROLL_DRAG);
      if (ns <= STOP_SPEED) { b.vel.x = 0; b.vel.y = 0; }
      else { const k = ns / sp; b.vel.x *= k; b.vel.y *= k; }
    }

    frames.push(sim.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel }, quat: { ...b.quat } })));
  }

  if (frames.length === 0) {
    frames.push(sim.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel }, quat: { ...b.quat } })));
  }

  return {
    frames,
    events,
    finalBalls: sim,
    pocketedIds,
    cuePocketed: sim.find((b) => b.isCue)?.pocketed ?? false,
    firstHit,
  };
}

// ─── Audio (tiny WebAudio synth, no assets) ──────────────────────────

class Sfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private lastClack = 0;

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  private burst(freq: number, dur: number, vol: number, type: BiquadFilterType = "bandpass") {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const n = Math.max(8, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 1.1;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  clack(vol: number) {
    const now = performance.now();
    if (now - this.lastClack < 18) return;
    this.lastClack = now;
    this.burst(2300 + Math.random() * 700, 0.05, Math.min(0.9, vol));
  }

  thud(vol: number) { this.burst(260, 0.09, Math.min(0.5, vol), "lowpass"); }

  cueHit(vol: number) { this.burst(1500, 0.04, Math.min(0.6, vol)); }

  pocket() {
    this.burst(1100, 0.1, 0.45);
    window.setTimeout(() => this.burst(420, 0.14, 0.35, "lowpass"), 70);
  }

  private tone(freq: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.enabled || vol <= 0.01) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  win() { this.tone(523, 0.14, 0.22); this.tone(659, 0.14, 0.22, 0.13); this.tone(784, 0.28, 0.22, 0.26); }
  lose() { this.tone(311, 0.18, 0.18); this.tone(233, 0.3, 0.18, 0.16); }
}

// ─── Small utilities ─────────────────────────────────────────────────

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerpBalls(a: Ball[], b: Ball[], t: number): Ball[] {
  return a.map((ball, i) => {
    const nb = b[i];
    if (!nb || ball.pocketed || nb.pocketed !== ball.pocketed) return ball;
    return {
      ...ball,
      pos: { x: ball.pos.x + (nb.pos.x - ball.pos.x) * t, y: ball.pos.y + (nb.pos.y - ball.pos.y) * t },
      quat: quatNlerp(ball.quat, nb.quat, t),
    };
  });
}

function clampPlace(p: Vec2): Vec2 {
  return {
    x: clamp(p.x, BALL_R + 0.5, TABLE_W - BALL_R - 0.5),
    y: clamp(p.y, BALL_R + 0.5, TABLE_H * 0.25 - BALL_R),
  };
}

function isPlaceLegal(p: Vec2, balls: Ball[]): boolean {
  if (p.y > TABLE_H * 0.25 - BALL_R + 0.01) return false;
  for (const b of balls) {
    if (b.isCue || b.pocketed) continue;
    if (dist(p, b.pos) < BALL_R * 2 + 0.5) return false;
  }
  for (const pk of POCKETS) {
    if (dist(p, pk) < POCKET_R + BALL_R * 0.5) return false;
  }
  return true;
}

// ─── Playback / FX ───────────────────────────────────────────────────

interface CueAnim { start: number; dur: number; fromPull: number; windup: number }

interface Playback {
  result: SimResult;
  frames: Ball[][];
  events: SimEvent[];
  eventIdx: number;
  t: number;
  lastTime: number;
  cue: CueAnim | null;
  own: boolean;
  angle: number;
  power: number;
  startedAt: number;
  done: boolean;
  pocketAt: Map<number, { t: number; x: number; y: number }>;
  pocketBalls: Map<number, Ball>;
}

interface Fx { x: number; y: number; start: number; kind: "pocket" | "impact"; strength: number }

function cuePullAt(pb: Playback, now: number): number {
  const c = pb.cue!;
  const el = now - c.start;
  if (el <= 0) return 0;
  if (c.windup > 0) {
    if (el < c.windup) return c.fromPull * easeOutCubic(el / c.windup) * 0.85;
    return Math.max(0, c.fromPull * (1 - (el - c.windup) / Math.max(1, c.dur - c.windup)));
  }
  return Math.max(-0.15, c.fromPull * (1 - el / c.dur));
}

// ─── Rolling ball rendering (per-pixel textured spheres, cached) ─────
// Numbers, stripes and the cue ball's red dots live on the sphere surface
// in object space, so they genuinely tumble as the ball rolls. Each ball
// renders into a small cached sprite, refreshed only while it rotates.

const TEX_SIZE = 72;
const TEX_R = TEX_SIZE / 2 - 1.5;
const CAP_COS = 0.91;    // number-cap half-angle ≈ 24°
const BAND_SIN = 0.62;   // stripe half-width
const DOT_COS = 0.9877;  // cue-ball dot half-angle ≈ 9°
const CUE_DOTS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
// light points from surface toward the light (upper-left, viewer side);
// z is into the screen, so "toward viewer" components are negative.
const LX = -0.42, LY = -0.5, LZ = -0.758;
const HX = -0.224, HY = -0.2666, HZ = -0.9375;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BALL_RGB: Record<number, [number, number, number]> = {};
for (const k of Object.keys(BALL_COLORS)) {
  BALL_RGB[Number(k)] = hexToRgb(BALL_COLORS[Number(k)]!.color);
}

interface BallTex {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
  q: Quat | null;
}
const ballTexCache = new Map<number, BallTex>();

function renderBallTexture(entry: BallTex, ball: Ball) {
  const { ctx, img } = entry;
  const data = img.data;
  const q = ball.quat;
  const x = q.x, y = q.y, z = q.z, w = q.w;
  const x2 = x * x, y2 = y * y, z2 = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;

  // object→view rotation matrix
  const m00 = 1 - 2 * (y2 + z2), m01 = 2 * (xy - wz), m02 = 2 * (xz + wy);
  const m10 = 2 * (xy + wz), m11 = 1 - 2 * (x2 + z2), m12 = 2 * (yz - wx);
  const m20 = 2 * (xz - wy), m21 = 2 * (yz + wx), m22 = 1 - 2 * (x2 + y2);

  const [br, bg, bb] = BALL_RGB[ball.id] ?? [136, 136, 136];
  const half = TEX_SIZE / 2;

  let di = 0;
  for (let py = 0; py < TEX_SIZE; py++) {
    const ny = (py + 0.5 - half) / TEX_R;
    for (let px = 0; px < TEX_SIZE; px++, di += 4) {
      const nx = (px + 0.5 - half) / TEX_R;
      const rr = nx * nx + ny * ny;
      if (rr > 1.08) { data[di + 3] = 0; continue; }
      const fz = Math.sqrt(Math.max(0, 1 - rr)); // amount facing the viewer
      const nz = -fz;                            // z is into the screen

      // object-space surface normal (transpose multiply = view→object)
      const ox = m00 * nx + m10 * ny + m20 * nz;
      const oy = m01 * nx + m11 * ny + m21 * nz;
      const oz = m02 * nx + m12 * ny + m22 * nz;

      let r: number, g: number, b: number;
      if (ball.isCue) {
        r = 244; g = 242; b = 234;
        for (const d of CUE_DOTS) {
          if (ox * d[0] + oy * d[1] + oz * d[2] >= DOT_COS) { r = 199; g = 55; b = 48; break; }
        }
      } else if (ball.stripe) {
        if (Math.abs(oz) <= BAND_SIN) { r = br; g = bg; b = bb; }
        else { r = 244; g = 242; b = 234; }
      } else {
        if (Math.abs(oz) >= CAP_COS) { r = 244; g = 242; b = 234; }
        else { r = br; g = bg; b = bb; }
      }

      // shading: diffuse + rim falloff + specular (x^42 via squaring)
      const diff = Math.max(0, nx * LX + ny * LY + nz * LZ);
      let spec = 0;
      const sd = nx * HX + ny * HY + nz * HZ;
      if (sd > 0) {
        const s2 = sd * sd, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8, s32 = s16 * s16;
        spec = s32 * s8 * s2 * 190;
      }
      const k = (0.5 + 0.6 * diff) * (0.42 + 0.58 * fz);
      data[di] = r * k + spec;
      data[di + 1] = g * k + spec;
      data[di + 2] = b * k + spec;

      const cov = (1 - Math.sqrt(rr)) * TEX_R + 0.5; // anti-aliased silhouette
      data[di + 3] = cov <= 0 ? 0 : cov >= 1 ? 255 : (cov * 255) | 0;
    }
  }

  ctx.putImageData(img, 0, 0);

  // number decal on whichever pole faces the viewer (real balls have both)
  if (!ball.isCue) {
    const sgn = m22 >= 0 ? -1 : 1;      // pole (0,0,sgn) faces the viewer
    const pz = -m22 * sgn;              // depth toward viewer, in (0, 1]
    if (pz > 0.3) {
      const vis = Math.min(1, (pz - 0.3) / 0.25);
      const cx = half + m02 * sgn * TEX_R * 0.92;
      const cy = half + m12 * sgn * TEX_R * 0.92;
      const rot = Math.atan2(m10, m00); // projected object x-axis = text right
      const size = TEX_R * 0.62 * (0.45 + 0.55 * pz);
      ctx.save();
      ctx.beginPath();
      ctx.arc(half, half, TEX_R, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = vis;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = "#211d17";
      ctx.font = `700 ${size.toFixed(1)}px ${T.fontMono}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(ball.label, 0, 0);
      ctx.restore();
    }
  }
}

function getBallTexture(ball: Ball): HTMLCanvasElement {
  let entry = ballTexCache.get(ball.id);
  if (!entry) {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const c2d = canvas.getContext("2d")!;
    entry = { canvas, ctx: c2d, img: c2d.createImageData(TEX_SIZE, TEX_SIZE), q: null };
    ballTexCache.set(ball.id, entry);
  }
  const q = ball.quat;
  const last = entry.q;
  if (
    last &&
    Math.abs(last.x - q.x) < 0.003 && Math.abs(last.y - q.y) < 0.003 &&
    Math.abs(last.z - q.z) < 0.003 && Math.abs(last.w - q.w) < 0.003
  ) {
    return entry.canvas; // stationary (or micro-rotating) ball → cached sprite
  }
  renderBallTexture(entry, ball);
  entry.q = { ...q };
  return entry.canvas;
}

function drawBall(
  ctx: CanvasRenderingContext2D, ball: Ball, s: number,
  scale = 1, alpha = 1
) {
  if (ball.pocketed || scale <= 0.02 || alpha <= 0.02) return;
  const x = ball.pos.x * s;
  const y = ball.pos.y * s;
  const r = ball.radius * s * scale;

  // soft contact shadow
  ctx.save();
  ctx.globalAlpha = 0.3 * alpha;
  const sx = x + 1.4 * s * scale;
  const sy = y + 2.0 * s * scale;
  const sh = ctx.createRadialGradient(sx, sy, r * 0.1, sx, sy, r * 1.35);
  sh.addColorStop(0, "rgba(0,0,0,0.75)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.beginPath();
  ctx.arc(sx, sy, r * 1.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(getBallTexture(ball), x - r, y - r, r * 2, r * 2);
  ctx.beginPath();
  ctx.arc(x, y, r - 0.25, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

// ─── Drawing: table & fixtures ───────────────────────────────────────

function drawTable(ctx: CanvasRenderingContext2D, s: number) {
  const w = TABLE_W * s;
  const h = TABLE_H * s;
  const c = CUSHION * s;
  const pr = POCKET_R * s;

  const woodGrad = ctx.createLinearGradient(-c, -c, w + c, h + c);
  woodGrad.addColorStop(0, "#4a3425");
  woodGrad.addColorStop(0.3, "#5a3f2d");
  woodGrad.addColorStop(0.7, "#4a3425");
  woodGrad.addColorStop(1, "#3d2b1f");
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(-c * 0.65, -c * 0.65, w + c * 1.3, h + c * 1.3, 10 * s);
  ctx.fill();

  ctx.strokeStyle = "#2a1a10";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.roundRect(-c * 0.5, -c * 0.5, w + c, h + c, 8 * s);
  ctx.stroke();

  const cushionGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  cushionGrad.addColorStop(0, "#1f7a45");
  cushionGrad.addColorStop(1, "#15633a");
  ctx.fillStyle = cushionGrad;
  ctx.fillRect(-c * 0.35, -c * 0.35, w + c * 0.7, h + c * 0.7);

  const feltGrad = ctx.createLinearGradient(0, 0, 0, h);
  feltGrad.addColorStop(0, "#1d8848");
  feltGrad.addColorStop(0.5, "#1a7c42");
  feltGrad.addColorStop(1, "#167038");
  ctx.fillStyle = feltGrad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.02;
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.2 * s, 1.2 * s);
  }
  ctx.globalAlpha = 1;

  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  ctx.setLineDash([2.5 * s, 2.5 * s]);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, TABLE_H * 0.25 * s);
  ctx.lineTo(w, TABLE_H * 0.25 * s);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(TABLE_W / 2 * s, TABLE_H * 0.73 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fill();

  for (const pocket of POCKETS) {
    const px = pocket.x * s;
    const py = pocket.y * s;

    ctx.beginPath();
    ctx.arc(px, py, pr * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();

    const pocketGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    pocketGrad.addColorStop(0, "#050505");
    pocketGrad.addColorStop(0.8, "#0a0a0a");
    pocketGrad.addColorStop(1, "#1a1a1a");
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = pocketGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, pr + 1, 0, Math.PI * 2);
    ctx.strokeStyle = "#3a2515";
    ctx.lineWidth = 2.2 * s;
    ctx.stroke();
  }

  ctx.strokeStyle = "#0e5028";
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(-0.5 * s, pr * 0.85);
  ctx.lineTo(-0.5 * s, TABLE_H / 2 * s - pr * 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-0.5 * s, TABLE_H / 2 * s + pr * 1.1);
  ctx.lineTo(-0.5 * s, h - pr * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w + 0.5 * s, pr * 0.85);
  ctx.lineTo(w + 0.5 * s, TABLE_H / 2 * s - pr * 1.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w + 0.5 * s, TABLE_H / 2 * s + pr * 1.1);
  ctx.lineTo(w + 0.5 * s, h - pr * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pr * 0.85, -0.5 * s);
  ctx.lineTo(w - pr * 0.85, -0.5 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pr * 0.85, h + 0.5 * s);
  ctx.lineTo(w - pr * 0.85, h + 0.5 * s);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (const d of [0.25, 0.5, 0.75]) {
    ctx.beginPath(); ctx.arc(-c * 0.18, d * h, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w + c * 0.18, d * h, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(d * w, -c * 0.18, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(d * w, h + c * 0.18, 1.8 * s, 0, Math.PI * 2); ctx.fill();
  }
}

function buildTableCanvas(bw: number, bh: number, dpr: number, padding: number, s: number) {
  const c = document.createElement("canvas");
  c.width = bw;
  c.height = bh;
  const ctx = c.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(padding, padding);
  drawTable(ctx, s);
  return { canvas: c, key: `${bw}x${bh}` };
}

// ─── Drawing: cue stick, guides, overlays ────────────────────────────

function drawCue(ctx: CanvasRenderingContext2D, ball: Ball, angle: number, pull: number, s: number) {
  const x = ball.pos.x * s;
  const y = ball.pos.y * s;
  const gap = Math.max(ball.radius * 0.7, ball.radius + 3 + pull * 30) * s;
  const len = 150 * s;
  const w = 3.4 * s;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.roundRect(gap + 1.6 * s, -w / 2 + 2.2 * s, len, w, 1.6 * s);
  ctx.fill();

  ctx.fillStyle = "#5b9bd5";
  ctx.beginPath();
  ctx.roundRect(gap, -w * 0.26, 2.4 * s, w * 0.52, 1 * s);
  ctx.fill();

  ctx.fillStyle = "#f3ead8";
  ctx.fillRect(gap + 2.4 * s, -w * 0.32, 4.4 * s, w * 0.64);

  const shaft = ctx.createLinearGradient(gap + 6.8 * s, 0, gap + len * 0.47, 0);
  shaft.addColorStop(0, "#f6ead0");
  shaft.addColorStop(1, "#e6d2ab");
  ctx.fillStyle = shaft;
  ctx.fillRect(gap + 6.8 * s, -w * 0.42, len * 0.4, w * 0.84);

  ctx.fillStyle = "#c9a872";
  ctx.fillRect(gap + len * 0.47, -w * 0.42, 2.4 * s, w * 0.84);

  ctx.fillStyle = "#221410";
  ctx.fillRect(gap + len * 0.47 + 2.4 * s, -w * 0.42, len * 0.13, w * 0.84);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 0.4;
  for (let i = 1; i < 5; i++) {
    const lx = gap + len * 0.47 + 2.4 * s + (len * 0.13 / 5) * i;
    ctx.beginPath();
    ctx.moveTo(lx, -w * 0.42);
    ctx.lineTo(lx, w * 0.42);
    ctx.stroke();
  }

  const butt = ctx.createLinearGradient(gap + len * 0.6, 0, gap + len, 0);
  butt.addColorStop(0, "#3a2317");
  butt.addColorStop(1, "#1e100a");
  ctx.fillStyle = butt;
  ctx.fillRect(gap + len * 0.6, -w * 0.42, len * 0.4, w * 0.84);

  ctx.fillStyle = "#0e0e0e";
  ctx.beginPath();
  ctx.roundRect(gap + len - 2.6 * s, -w * 0.34, 2.6 * s, w * 0.68, [0, 1.2 * s, 1.2 * s, 0]);
  ctx.fill();

  ctx.restore();
}

function drawPowerBar(ctx: CanvasRenderingContext2D, power: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  const pct = clamp(power / MAX_POWER, 0, 1);
  const fillH = pct * (h - 4);
  if (fillH > 1) {
    const g = ctx.createLinearGradient(x, y + h - 2, x, y + 2);
    g.addColorStop(0, "#4ade80");
    g.addColorStop(0.35, "#a3e635");
    g.addColorStop(0.6, "#facc15");
    g.addColorStop(0.8, "#f97316");
    g.addColorStop(1, "#ef4444");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + h - 2 - fillH, w - 4, fillH, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(x + 2, y + h - 2 - fillH, w - 4, 2.5, 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 6);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 8px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`${Math.round(pct * 100)}`, x + w / 2, y + h + 4);
}

function drawAimGuide(ctx: CanvasRenderingContext2D, cue: Ball, angle: number, balls: Ball[], s: number) {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const R2 = BALL_R * 2;

  let bestT = Infinity;
  let hit: Ball | null = null;
  for (const b of balls) {
    if (b.isCue || b.pocketed) continue;
    const ex = cue.pos.x - b.pos.x;
    const ey = cue.pos.y - b.pos.y;
    const b1 = ex * dir.x + ey * dir.y;
    const c0 = ex * ex + ey * ey - R2 * R2;
    const disc = b1 * b1 - c0;
    if (disc < 0) continue;
    const t = -b1 - Math.sqrt(disc);
    if (t > 0.5 && t < bestT) { bestT = t; hit = b; }
  }

  let wallT = Infinity;
  let wallN: Vec2 | null = null;
  if (dir.x > 1e-6) { const t = (TABLE_W - BALL_R - cue.pos.x) / dir.x; if (t > 0 && t < wallT) { wallT = t; wallN = { x: -1, y: 0 }; } }
  if (dir.x < -1e-6) { const t = (BALL_R - cue.pos.x) / dir.x; if (t > 0 && t < wallT) { wallT = t; wallN = { x: 1, y: 0 }; } }
  if (dir.y > 1e-6) { const t = (TABLE_H - BALL_R - cue.pos.y) / dir.y; if (t > 0 && t < wallT) { wallT = t; wallN = { x: 0, y: -1 }; } }
  if (dir.y < -1e-6) { const t = (BALL_R - cue.pos.y) / dir.y; if (t > 0 && t < wallT) { wallT = t; wallN = { x: 0, y: 1 }; } }

  ctx.save();
  ctx.lineWidth = 1;
  const sx = cue.pos.x * s;
  const sy = cue.pos.y * s;

  if (hit && bestT <= wallT) {
    const ghost = { x: cue.pos.x + dir.x * bestT, y: cue.pos.y + dir.y * bestT };

    ctx.setLineDash([3 * s, 5 * s]);
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.moveTo(sx + dir.x * BALL_R * s, sy + dir.y * BALL_R * s);
    ctx.lineTo(ghost.x * s, ghost.y * s);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.arc(ghost.x * s, ghost.y * s, BALL_R * s, 0, Math.PI * 2);
    ctx.stroke();

    const od = normalize({ x: hit.pos.x - ghost.x, y: hit.pos.y - ghost.y });
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.setLineDash([4 * s, 4 * s]);
    ctx.beginPath();
    ctx.moveTo(hit.pos.x * s + od.x * BALL_R * s, hit.pos.y * s + od.y * BALL_R * s);
    ctx.lineTo(hit.pos.x * s + od.x * (BALL_R + 44) * s, hit.pos.y * s + od.y * (BALL_R + 44) * s);
    ctx.stroke();

    const dot = dir.x * od.x + dir.y * od.y;
    let tx = dir.x - od.x * dot;
    let ty = dir.y - od.y * dot;
    const tl = Math.hypot(tx, ty);
    if (tl > 0.05) {
      tx /= tl;
      ty /= tl;
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.moveTo(ghost.x * s + tx * BALL_R * s, ghost.y * s + ty * BALL_R * s);
      ctx.lineTo(ghost.x * s + tx * (BALL_R + 26) * s, ghost.y * s + ty * (BALL_R + 26) * s);
      ctx.stroke();
    }
  } else if (wallN && wallT < Infinity) {
    const px = cue.pos.x + dir.x * wallT;
    const py = cue.pos.y + dir.y * wallT;
    ctx.setLineDash([3 * s, 5 * s]);
    ctx.strokeStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(px * s, py * s);
    ctx.stroke();
    const d2 = dir.x * wallN.x + dir.y * wallN.y;
    const rx = dir.x - 2 * d2 * wallN.x;
    const ry = dir.y - 2 * d2 * wallN.y;
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.beginPath();
    ctx.moveTo(px * s, py * s);
    ctx.lineTo(px * s + rx * 34 * s, py * s + ry * 34 * s);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.restore();
}

function drawPocketFx(ctx: CanvasRenderingContext2D, f: Fx, now: number, s: number) {
  const t = (now - f.start) / 460;
  if (t < 0 || t > 1) return;
  const ease = 1 - Math.pow(1 - t, 2);
  const r = POCKET_R * (0.7 + ease * 1.1) * s;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.55;
  ctx.strokeStyle = "#eaf7ef";
  ctx.lineWidth = 2 * s * (1 - t) + 0.5;
  ctx.beginPath();
  ctx.arc(f.x * s, f.y * s, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - t) * 0.25;
  ctx.beginPath();
  ctx.arc(f.x * s, f.y * s, r * 0.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawImpactFx(ctx: CanvasRenderingContext2D, f: Fx, now: number, s: number) {
  const t = (now - f.start) / 240;
  if (t < 0 || t > 1) return;
  const e = 1 - Math.pow(1 - t, 2);
  const r = (3 + e * 9 * Math.min(1.6, f.strength / 5)) * s;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.4;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.6 * s * (1 - t * 0.6);
  ctx.beginPath();
  ctx.arc(f.x * s, f.y * s, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWaiting(ctx: CanvasRenderingContext2D, s: number, now: number) {
  const cx = TABLE_W / 2 * s;
  const cy = TABLE_H * 0.52 * s;
  ctx.save();
  ctx.fillStyle = "rgba(8,14,10,0.45)";
  ctx.beginPath();
  ctx.roundRect(TABLE_W * s * 0.1, cy - 34 * s, TABLE_W * s * 0.8, 68 * s, 10 * s);
  ctx.fill();

  const a = (now / 700) % (Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy - 10 * s, 7 * s, a, a + Math.PI * 1.2);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `${10 * s}px ${T.fontBody}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Waiting for opponent…", cx, cy + 12 * s);
  ctx.restore();
}

function drawHint(ctx: CanvasRenderingContext2D, s: number, now: number) {
  const alpha = 0.55 + 0.25 * Math.sin(now / 400);
  const y = TABLE_H * s - 16 * s;
  const w = TABLE_W * s * 0.9;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.beginPath();
  ctx.roundRect(TABLE_W / 2 * s - w / 2, y - 9 * s, w, 18 * s, 9 * s);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `${8.5 * s}px ${T.fontBody}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Drag to aim · pull back from the cue ball to shoot", TABLE_W / 2 * s, y);
  ctx.restore();
}

function drawPlacingOverlay(
  ctx: CanvasRenderingContext2D, s: number, now: number,
  preview: Vec2 | null, balls: Ball[], invalidAt: number
) {
  const h = TABLE_H * 0.25 * s;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 0, TABLE_W * s, h);
  ctx.setLineDash([4 * s, 4 * s]);
  ctx.lineDashOffset = -(now / 130) % (8 * s);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TABLE_W * s - 1, h - 1);
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  const invalid = now - invalidAt < 800;
  ctx.fillStyle = invalid ? "#f87171" : "rgba(255,255,255,0.55)";
  ctx.font = `${9.5 * s}px ${T.fontBody}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    invalid ? "Can't place there — find a clear spot" : "Ball in hand · drag in this zone, release to place",
    TABLE_W / 2 * s, h + 11 * s
  );

  if (preview) {
    const legal = isPlaceLegal(preview, balls);
    const gx = preview.x * s;
    const gy = preview.y * s;
    const gr = BALL_R * s;
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fillStyle = legal ? "rgba(245,245,240,0.5)" : "rgba(239,68,68,0.45)";
    ctx.fill();
    ctx.setLineDash([3 * s, 3 * s]);
    ctx.strokeStyle = legal ? "rgba(255,255,255,0.75)" : "#ef4444";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// ─── Component ───────────────────────────────────────────────────────

interface Props {
  gameState: PoolView;
  youId: string;
  gameOver: { winnerId?: string } | null;
  room: Room;
  gameName: string;
  accent: string;
  onLeave: () => void;
  onSubmitAction: (action: unknown) => void;
}

type Phase = "idle" | "aiming" | "simulating" | "placing-cue";

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

const LeaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const EightBallMark = () => (
  <svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">
    <defs>
      <radialGradient id="pool8-ball-grad" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#4a4a4a" />
        <stop offset="55%" stopColor="#161616" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>
    </defs>
    <circle cx="27" cy="27" r="25" fill="url(#pool8-ball-grad)" />
    <circle cx="27" cy="27" r="10.5" fill="#f4f2ea" />
    <text x="27" y="28.5" textAnchor="middle" dominantBaseline="middle" fontFamily="monospace" fontWeight="700" fontSize="12.5" fill="#1c1c1c">8</text>
  </svg>
);

function BallChip({ id }: { id: number }) {
  const info = BALL_COLORS[id];
  const bg = info?.stripe
    ? `linear-gradient(180deg, #f4f2ea 0 24%, ${info.color} 24% 76%, #f4f2ea 76%)`
    : info?.color ?? "#888";
  return <span className="pool8-chip" style={{ background: bg }} title={`Ball ${id}`} />;
}

function PlayerCard({
  name, isYou, isTurn, groupLabel, tray,
}: {
  name: string; isYou: boolean; isTurn: boolean; groupLabel: string; tray: Ball[];
}) {
  return (
    <div className={`pool8-pcard${isTurn ? " turn" : ""}`}>
      <div className="pool8-prow">
        <span className="pool8-pname">{name || "Player"}</span>
        {isYou && <span className="pool8-you">YOU</span>}
        <span className="pool8-turnchip">TURN</span>
      </div>
      <div className="pool8-group">{groupLabel}</div>
      <div className="pool8-tray">
        {tray.map((b) => <BallChip key={b.id} id={b.id} />)}
      </div>
    </div>
  );
}

const POOL8_CSS = `
.pool8-root{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;background:radial-gradient(120% 90% at 50% 0%,#12201a 0%,#0a120e 55%,#070d0a 100%);color:#e9efe9;overflow:hidden;-webkit-user-select:none;user-select:none;}
.pool8-header{display:flex;align-items:center;gap:10px;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;}
.pool8-iconbtn{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05);color:#dfe8df;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;padding:0;}
.pool8-iconbtn:active{transform:scale(.94);}
.pool8-title{flex:1;text-align:center;min-width:0;}
.pool8-title h1{margin:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#f2f6f0;}
.pool8-title span{display:block;font-size:10.5px;color:rgba(233,239,233,.5);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pool8-players{display:flex;gap:8px;padding:0 12px;}
.pool8-pcard{flex:1;min-width:0;border-radius:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);transition:border-color .25s,background .25s,box-shadow .25s;}
.pool8-pcard.turn{border-color:var(--pool8-accent);background:rgba(255,255,255,.06);box-shadow:0 0 14px -6px var(--pool8-accent);}
.pool8-prow{display:flex;align-items:center;gap:6px;}
.pool8-pname{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.pool8-you{font-size:8.5px;font-weight:700;letter-spacing:.08em;padding:1.5px 5px;border-radius:99px;background:var(--pool8-accent);color:#0b0f0c;flex:none;}
.pool8-turnchip{margin-left:auto;font-size:8.5px;font-weight:700;letter-spacing:.1em;color:var(--pool8-accent);opacity:0;transition:opacity .25s;flex:none;}
.pool8-pcard.turn .pool8-turnchip{opacity:1;animation:pool8-pulse 1.6s ease-in-out infinite;}
@keyframes pool8-pulse{0%,100%{opacity:.45}50%{opacity:1}}
.pool8-group{font-size:10px;color:rgba(233,239,233,.55);margin-top:3px;}
.pool8-tray{display:flex;gap:3.5px;flex-wrap:wrap;margin-top:5px;min-height:13px;}
.pool8-chip{width:13px;height:13px;border-radius:50%;box-shadow:inset -2px -2px 3px rgba(0,0,0,.4),inset 1px 1px 2px rgba(255,255,255,.28);}
.pool8-msg{text-align:center;font-size:12px;padding:7px 14px 2px;color:rgba(233,239,233,.75);min-height:26px;}
.pool8-wrap{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;padding:4px 0 10px;}
.pool8-canvas{touch-action:none;display:block;border-radius:6px;}
.pool8-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(5,9,7,.72);backdrop-filter:blur(5px);z-index:5;animation:pool8-fade .35s ease;}
@keyframes pool8-fade{from{opacity:0}to{opacity:1}}
.pool8-card{background:#101a14;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px 34px;text-align:center;max-width:82%;box-shadow:0 24px 60px rgba(0,0,0,.5);animation:pool8-pop .4s cubic-bezier(.2,1.4,.4,1);}
@keyframes pool8-pop{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}
.pool8-wintitle{font-size:22px;font-weight:800;margin:14px 0 4px;letter-spacing:.02em;}
.pool8-winsub{font-size:12px;color:rgba(233,239,233,.6);margin-bottom:18px;}
.pool8-btn{border:none;border-radius:12px;padding:11px 26px;font-size:13px;font-weight:700;color:#0b0f0c;background:var(--pool8-accent);cursor:pointer;}
.pool8-btn:active{transform:scale(.96);}
`;

export function PoolFullscreen({ gameState, youId, gameOver, gameName, accent, onLeave, onSubmitAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [canvasSize, setCanvasSize] = useState({ w: 380, h: 660 });
  const sizeRef = useRef({ w: 380, h: 660, scale: 1, padding: CUSHION * 0.65 });

  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");

  const ballsRef = useRef<Ball[]>(rackBalls());
  const [syncedState, setSyncedState] = useState({
    pocketedSolids: [] as Ball[],
    pocketedStripes: [] as Ball[],
    pocketedEight: false,
  });

  const targetAngleRef = useRef(Math.PI / 2);
  const displayAngleRef = useRef(Math.PI / 2);
  const powerRef = useRef(0);
  const displayPowerRef = useRef(0);

  const chargeRef = useRef({ active: false, pointerId: -1 });
  const aimDragRef = useRef(false);
  const placeDragRef = useRef<{ active: boolean; pos: Vec2 | null }>({ active: false, pos: null });
  const placePreviewRef = useRef<Vec2 | null>(null);
  const invalidPlaceRef = useRef(0);
  const hintedRef = useRef(false);

  const playbackRef = useRef<Playback | null>(null);
  const fxRef = useRef<Fx[]>([]);
  const pendingStateRef = useRef<BallPos[] | null>(null);
  const lastBallStateRef = useRef("");
  const lastIncomingRef = useRef<{ angle: number; power: number } | null>(null);
  const lastMyShotRef = useRef<{ angle: number; power: number; at: number } | null>(null);
  const shotLockRef = useRef(false);
  const shotLockTimerRef = useRef<number>(0);
  const placedThisFoulRef = useRef(false);

  const gsRef = useRef(gameState);
  const gameOverRef = useRef(gameOver);
  const actionRef = useRef(onSubmitAction);
  const tableCacheRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(null);

  const sfxRef = useRef<Sfx | null>(null);
  if (!sfxRef.current) sfxRef.current = new Sfx();

  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("pool_muted") === "1"; } catch { return false; }
  });

  const setPhaseSafe = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const refreshTrays = useCallback((balls: Ball[]) => {
    setSyncedState({
      pocketedSolids: balls.filter((b) => b.pocketed && b.solid),
      pocketedStripes: balls.filter((b) => b.pocketed && b.stripe),
      pocketedEight: balls.find((b) => b.isEight)?.pocketed ?? false,
    });
  }, []);

  const syncPhase = useCallback(() => {
    if (gameOverRef.current || playbackRef.current) return;
    const gs = gsRef.current;
    const cue = ballsRef.current.find((b) => b.isCue);
    if (gs.isMyTurn && !shotLockRef.current) {
      if ((gs.foul === "placing-cue" && !placedThisFoulRef.current) || (cue && cue.pocketed)) {
        setPhaseSafe("placing-cue");
      } else {
        setPhaseSafe("aiming");
      }
    } else {
      setPhaseSafe("idle");
    }
  }, [setPhaseSafe]);

  const applyServerState = useCallback((state: BallPos[]) => {
    ballsRef.current = applyBallState(ballsRef.current, state);
    refreshTrays(ballsRef.current);
    shotLockRef.current = false;
    window.clearTimeout(shotLockTimerRef.current);
    syncPhase();
  }, [refreshTrays, syncPhase]);

  const startPlayback = useCallback((result: SimResult, angle: number, power: number, own: boolean) => {
    const now = performance.now();
    const pre = ballsRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel }, quat: { ...b.quat } }));
    const allFrames = [pre, ...result.frames];

    // record when/where each ball drops, for the swallow animation
    const prePocketed = new Set(pre.filter((b) => b.pocketed).map((b) => b.id));
    const pocketAt = new Map<number, { t: number; x: number; y: number }>();
    const pocketBalls = new Map<number, Ball>();
    for (let i = 1; i < allFrames.length; i++) {
      for (const b of allFrames[i]!) {
        if (!b.pocketed || prePocketed.has(b.id)) continue;
        if (!pocketBalls.has(b.id)) pocketBalls.set(b.id, { ...b, pos: { ...b.pos } });
        if (!pocketAt.has(b.id)) {
          let best = POCKETS[0]!;
          let bd = Infinity;
          for (const p of POCKETS) {
            const d = dist(b.pos, p);
            if (d < bd) { bd = d; best = p; }
          }
          pocketAt.set(b.id, { t: i, x: best.x, y: best.y });
        }
      }
    }

    playbackRef.current = {
      result, own, angle, power,
      startedAt: now, done: false,
      frames: allFrames,
      events: result.events, eventIdx: 0,
      t: 0, lastTime: 0,
      cue: own
        ? { start: now, dur: STRIKE_MS, fromPull: power / MAX_POWER, windup: 0 }
        : { start: now, dur: WINDUP_MS + STRIKE_MS, fromPull: power / MAX_POWER, windup: WINDUP_MS },
      pocketAt, pocketBalls,
    };
  }, []);

  const finishPlayback = useCallback((instant = false) => {
    const pb = playbackRef.current;
    if (!pb || pb.done) return;
    pb.done = true;
    if (instant) {
      for (; pb.eventIdx < pb.events.length; pb.eventIdx++) {
        const ev = pb.events[pb.eventIdx]!;
        if (ev.type === "pocket") {
          fxRef.current.push({ x: ev.x, y: ev.y, start: performance.now(), kind: "pocket", strength: 1 });
        }
      }
    }
    ballsRef.current = pb.result.finalBalls;
    refreshTrays(ballsRef.current);
    playbackRef.current = null;
    powerRef.current = 0;
    syncPhase();
    if (pendingStateRef.current) {
      const st = pendingStateRef.current;
      pendingStateRef.current = null;
      applyServerState(st);
    }
  }, [refreshTrays, syncPhase, applyServerState]);

  const stepPlayback = useCallback((now: number) => {
    const pb = playbackRef.current;
    if (!pb || pb.done) return;
    if (pb.cue) {
      if (now - pb.cue.start >= pb.cue.dur) {
        pb.cue = null;
        sfxRef.current!.cueHit(Math.min(1, pb.power / MAX_POWER));
        const c0 = pb.frames[0]!.find((b) => b.isCue);
        if (c0 && fxRef.current.length < 40) {
          fxRef.current.push({ x: c0.pos.x, y: c0.pos.y, start: now, kind: "impact", strength: 2 + pb.power });
        }
        vibrate(8);
        pb.lastTime = now;
        pb.t = 0;
      }
      return;
    }
    const dt = Math.min(60, now - (pb.lastTime || now));
    pb.lastTime = now;
    const fi = Math.max(0, Math.min(pb.frames.length - 1, Math.floor(pb.t)));
    const spd = maxBallSpeed(pb.frames[fi]!);
    const tps = spd < 1.6 ? PLAYBACK_FAST_TPS : PLAYBACK_TPS;
    pb.t += (dt / 1000) * tps;

    while (pb.eventIdx < pb.events.length && pb.events[pb.eventIdx]!.tick <= pb.t) {
      const ev = pb.events[pb.eventIdx]!;
      pb.eventIdx++;
      if (ev.type === "ball") {
        sfxRef.current!.clack(ev.strength * 0.08);
        if (ev.strength > 3.2 && fxRef.current.length < 40) {
          fxRef.current.push({ x: ev.x, y: ev.y, start: now, kind: "impact", strength: ev.strength });
        }
      } else if (ev.type === "cushion") {
        sfxRef.current!.thud(ev.strength * 0.06);
        if (ev.strength > 5 && fxRef.current.length < 40) {
          fxRef.current.push({ x: ev.x, y: ev.y, start: now, kind: "impact", strength: ev.strength * 0.7 });
        }
      } else {
        sfxRef.current!.pocket();
        vibrate([12, 40, 14]);
        fxRef.current.push({ x: ev.x, y: ev.y, start: now, kind: "pocket", strength: 1 });
      }
    }

    ballsRef.current = pb.frames[Math.max(0, Math.min(pb.frames.length - 1, Math.floor(pb.t)))]!;
    if (pb.t >= pb.frames.length - 1) finishPlayback(false);
  }, [finishPlayback]);

  const fire = useCallback((angle: number, p: number) => {
    hintedRef.current = true;
    setPhaseSafe("simulating");
    actionRef.current({ type: "shoot", angle, power: p });

    const result = simulateShot(ballsRef.current, angle, p);
    actionRef.current({
      type: "shot_result",
      pocketedIds: result.pocketedIds,
      cuePocketed: result.cuePocketed,
      firstHit: result.firstHit,
      finalPositions: serializeBalls(result.finalBalls),
    });

    shotLockRef.current = true;
    window.clearTimeout(shotLockTimerRef.current);
    shotLockTimerRef.current = window.setTimeout(() => {
      if (shotLockRef.current) { shotLockRef.current = false; syncPhase(); }
    }, 6000);
    lastMyShotRef.current = { angle, power: p, at: performance.now() };

    startPlayback(result, angle, p, true);
    powerRef.current = 0;
  }, [setPhaseSafe, syncPhase, startPlayback]);

  const getTablePos = useCallback((clientX: number, clientY: number): Vec2 | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { scale, padding } = sizeRef.current;
    if (!scale) return null;
    const x = (clientX - rect.left - padding) / scale;
    const y = (clientY - rect.top - padding) / scale;
    if (x < -60 || x > TABLE_W + 60 || y < -60 || y > TABLE_H + 60) return null;
    return { x, y };
  }, []);

  const updateChargeFrom = useCallback((pos: Vec2) => {
    const cue = ballsRef.current.find((b) => b.isCue);
    if (!cue) return;
    const backX = -Math.cos(targetAngleRef.current);
    const backY = -Math.sin(targetAngleRef.current);
    const proj = (pos.x - cue.pos.x) * backX + (pos.y - cue.pos.y) * backY;
    powerRef.current = clamp(proj * PULL_SCALE, 0, MAX_POWER);
    if (powerRef.current > 1.2) hintedRef.current = true;
  }, []);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    sfxRef.current!.ensure();

    const pb = playbackRef.current;
    if (pb && !pb.done) {
      if (performance.now() - pb.startedAt > 400) finishPlayback(true);
      return;
    }
    if (gameOverRef.current) return;

    const pos = getTablePos(e.clientX, e.clientY);
    if (!pos) return;
    const gs = gsRef.current;

    if (phaseRef.current === "placing-cue" && gs.isMyTurn) {
      const p = clampPlace(pos);
      placePreviewRef.current = p;
      placeDragRef.current = { active: true, pos: p };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (phaseRef.current === "aiming" && gs.isMyTurn && !shotLockRef.current) {
      const cue = ballsRef.current.find((b) => b.isCue);
      if (!cue || cue.pocketed) return;
      if (dist(pos, cue.pos) <= CHARGE_GRAB_R) {
        chargeRef.current = { active: true, pointerId: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        updateChargeFrom(pos);
      } else {
        aimDragRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        targetAngleRef.current = Math.atan2(pos.y - cue.pos.y, pos.x - cue.pos.x);
      }
    }
  }, [getTablePos, updateChargeFrom, finishPlayback]);

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
    const pos = getTablePos(e.clientX, e.clientY);
    if (!pos) return;
    const gs = gsRef.current;

    if (phaseRef.current === "placing-cue" && gs.isMyTurn) {
      const p = clampPlace(pos);
      placePreviewRef.current = p;
      if (placeDragRef.current.active) placeDragRef.current.pos = p;
      return;
    }

    if (chargeRef.current.active) {
      updateChargeFrom(pos);
      return;
    }

    if (phaseRef.current === "aiming" && gs.isMyTurn && !shotLockRef.current) {
      const cue = ballsRef.current.find((b) => b.isCue);
      if (!cue || cue.pocketed) return;
      if (aimDragRef.current || e.buttons === 0) {
        if (dist(pos, cue.pos) > 12) {
          targetAngleRef.current = Math.atan2(pos.y - cue.pos.y, pos.x - cue.pos.x);
        }
      }
    }
  }, [getTablePos, updateChargeFrom]);

  const handlePointerUp = useCallback(() => {
    if (placeDragRef.current.active) {
      const p = placeDragRef.current.pos;
      placeDragRef.current = { active: false, pos: null };
      if (p && isPlaceLegal(p, ballsRef.current)) {
        ballsRef.current = ballsRef.current.map((b) =>
          b.isCue ? { ...b, pos: { x: p.x, y: p.y }, vel: { x: 0, y: 0 }, pocketed: false } : b
        );
        placePreviewRef.current = null;
        placedThisFoulRef.current = true;
        actionRef.current({ type: "place_cue", x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
        sfxRef.current!.thud(0.5);
        setPhaseSafe("aiming");
      } else {
        invalidPlaceRef.current = performance.now();
      }
      return;
    }

    if (chargeRef.current.active) {
      chargeRef.current = { active: false, pointerId: -1 };
      const p = powerRef.current;
      if (p > 0.4 && phaseRef.current === "aiming" && gsRef.current.isMyTurn && !shotLockRef.current) {
        fire(targetAngleRef.current, p);
      } else {
        powerRef.current = 0;
      }
      return;
    }

    aimDragRef.current = false;
  }, [fire, setPhaseSafe]);

  const handlePointerCancel = useCallback(() => {
    chargeRef.current = { active: false, pointerId: -1 };
    powerRef.current = 0;
    aimDragRef.current = false;
    placeDragRef.current = { active: false, pos: null };
  }, []);

  // ── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    sfxRef.current!.enabled = !muted;
    try { localStorage.setItem("pool_muted", muted ? "1" : "0"); } catch { /* ignore */ }
  }, [muted]);

  useEffect(() => { actionRef.current = onSubmitAction; }, [onSubmitAction]);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) return;
      const tableAspect = (TABLE_W + CUSHION * 1.3) / (TABLE_H + CUSHION * 1.3);
      let h = rect.height - 4;
      let w = h * tableAspect;
      if (w > rect.width - 4) {
        w = rect.width - 4;
        h = w / tableAspect;
      }
      w = Math.max(200, Math.floor(w));
      h = Math.floor(h);
      const scale = w / (TABLE_W + CUSHION * 1.3);
      sizeRef.current = { w, h, scale, padding: CUSHION * scale * 0.65 };
      setCanvasSize({ w, h });
    };
    updateSize();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(updateSize);
      ro.observe(containerRef.current);
    }
    window.addEventListener("resize", updateSize);
    return () => {
      window.removeEventListener("resize", updateSize);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    gsRef.current = gameState;
    if (!gameState.isMyTurn) {
      shotLockRef.current = false;
      window.clearTimeout(shotLockTimerRef.current);
      placedThisFoulRef.current = false;
    }
    if (gameState.foul !== "placing-cue") placedThisFoulRef.current = false;
    syncPhase();
  }, [gameState, syncPhase]);

  useEffect(() => {
    const shot = gameState.incomingShot;
    if (!shot || gameState.isMyTurn) return;
    if (lastIncomingRef.current === shot) return;

    const mine = lastMyShotRef.current;
    if (mine && Math.abs(mine.angle - shot.angle) < 1e-6 && Math.abs(mine.power - shot.power) < 1e-6 && performance.now() - mine.at < 4000) return;
    const pb = playbackRef.current;
    if (pb && Math.abs(pb.angle - shot.angle) < 1e-6 && Math.abs(pb.power - shot.power) < 1e-6 && performance.now() - pb.startedAt < 3000) return;

    lastIncomingRef.current = shot;
    if (pb) finishPlayback(true);
    if (pendingStateRef.current) {
      const st = pendingStateRef.current;
      pendingStateRef.current = null;
      applyServerState(st);
    }

    setPhaseSafe("simulating");
    const result = simulateShot(ballsRef.current, shot.angle, shot.power);
    actionRef.current({
      type: "shot_result",
      pocketedIds: result.pocketedIds,
      cuePocketed: result.cuePocketed,
      firstHit: result.firstHit,
      finalPositions: serializeBalls(result.finalBalls),
    });
    startPlayback(result, shot.angle, shot.power, false);
  }, [gameState.incomingShot, gameState.isMyTurn, finishPlayback, applyServerState, setPhaseSafe, startPlayback]);

  useEffect(() => {
    const st = gameState.ballPositions;
    if (!st) return;
    const key = JSON.stringify(st);
    if (key === lastBallStateRef.current) return;
    lastBallStateRef.current = key;
    if (playbackRef.current && !playbackRef.current.done) {
      pendingStateRef.current = st;
      return;
    }
    applyServerState(st);
  }, [gameState.ballPositions, applyServerState]);

  useEffect(() => {
    gameOverRef.current = gameOver;
    if (!gameOver) return;
    window.clearTimeout(shotLockTimerRef.current);
    shotLockRef.current = false;
    sfxRef.current!.ensure();
    if (gameOver.winnerId === youId) sfxRef.current!.win();
    else sfxRef.current!.lose();
  }, [gameOver, youId]);

  useEffect(() => {
    if (phase !== "placing-cue") {
      placePreviewRef.current = null;
      placeDragRef.current = { active: false, pos: null };
    }
  }, [phase]);

  useEffect(() => () => { window.clearTimeout(shotLockTimerRef.current); }, []);

  // ── Single render loop ────────────────────────────────────────────

  useEffect(() => {
    let raf = 0;
    const render = () => {
      raf = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const now = performance.now();
      const { w, h, scale: s, padding } = sizeRef.current;
      const dpr = window.devicePixelRatio || 1;
      const bw = Math.max(1, Math.round(w * dpr));
      const bh = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        tableCacheRef.current = null;
      }

      displayAngleRef.current = lerpAngle(displayAngleRef.current, targetAngleRef.current, 0.3);
      displayPowerRef.current += (powerRef.current - displayPowerRef.current) * 0.35;
      if (Math.abs(powerRef.current - displayPowerRef.current) < 0.02) displayPowerRef.current = powerRef.current;

      stepPlayback(now);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      let tc = tableCacheRef.current;
      if (!tc || tc.key !== `${bw}x${bh}`) {
        tc = buildTableCanvas(bw, bh, dpr, padding, s);
        tableCacheRef.current = tc;
      }
      ctx.drawImage(tc.canvas, 0, 0, w, h);

      ctx.save();
      ctx.translate(padding, padding);

      fxRef.current = fxRef.current.filter((f) => now - f.start < 460);
      for (const f of fxRef.current) {
        if (f.kind === "impact") drawImpactFx(ctx, f, now, s);
        else drawPocketFx(ctx, f, now, s);
      }

      let drawBalls = ballsRef.current;
      const pb = playbackRef.current;
      if (pb && !pb.done) {
        if (pb.cue) {
          drawBalls = pb.frames[0]!;
        } else {
          const fi = Math.max(0, Math.min(pb.frames.length - 1, Math.floor(pb.t)));
          const f1 = pb.frames[Math.min(pb.frames.length - 1, fi + 1)]!;
          drawBalls = lerpBalls(pb.frames[fi]!, f1, clamp(pb.t - fi, 0, 1));
        }
      }
      const cueBallDraw = drawBalls.find((b) => b.isCue)!;

      // pocket swallow: balls sink into the pocket and shrink away
      if (pb && !pb.done && !pb.cue && pb.pocketAt) {
        for (const [id, info] of pb.pocketAt) {
          const rel = pb.t - info.t;
          if (rel <= 0 || rel >= SWALLOW_TICKS) continue;
          const src = pb.pocketBalls.get(id);
          if (!src) continue;
          const q = rel / SWALLOW_TICKS;
          const sm = q * q * (3 - 2 * q);
          drawBall(
            ctx,
            {
              ...src, pocketed: false,
              pos: {
                x: src.pos.x + (info.x - src.pos.x) * sm * 0.9,
                y: src.pos.y + (info.y - src.pos.y) * sm * 0.9,
              },
            },
            s,
            Math.max(0.03, 0.95 * (1 - q)),
            q < 0.7 ? 1 : Math.max(0, (1 - q) / 0.3)
          );
        }
      }

      // subtle motion streaks behind fast balls (shot playback only)
      if (pb && !pb.done && !pb.cue) {
        ctx.save();
        ctx.lineCap = "round";
        for (const b of drawBalls) {
          if (b.pocketed) continue;
          const sp = Math.hypot(b.vel.x, b.vel.y);
          if (sp < 5.5) continue;
          const a = Math.min(0.2, (sp - 5.5) * 0.02);
          const len = Math.min(28, sp * 2.1);
          const ux = b.vel.x / sp;
          const uy = b.vel.y / sp;
          const x2 = b.pos.x * s;
          const y2 = b.pos.y * s;
          const x1 = x2 - ux * len * s;
          const y1 = y2 - uy * len * s;
          const grad = ctx.createLinearGradient(x1, y1, x2, y2);
          grad.addColorStop(0, "rgba(255,255,255,0)");
          grad.addColorStop(1, `rgba(255,255,255,${a.toFixed(3)})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = b.radius * s * 1.4;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2 - ux * b.radius * s * 0.7, y2 - uy * b.radius * s * 0.7);
          ctx.stroke();
        }
        ctx.restore();
      }

      for (const ball of [...drawBalls].sort((a, b) => a.pos.y - b.pos.y)) {
        if (ball.pocketed) continue;
        drawBall(ctx, ball, s);
      }

      const gs = gsRef.current;
      const myTurnAiming = phaseRef.current === "aiming" && gs.isMyTurn && !gameOverRef.current && !cueBallDraw.pocketed;

      if (myTurnAiming) {
        drawAimGuide(ctx, cueBallDraw, displayAngleRef.current, drawBalls, s);
      }

      if (pb && !pb.done && pb.cue) {
        drawCue(ctx, cueBallDraw, pb.angle, cuePullAt(pb, now), s);
      } else if (myTurnAiming) {
        drawCue(ctx, cueBallDraw, displayAngleRef.current, displayPowerRef.current / MAX_POWER, s);
      }

      if ((chargeRef.current.active || displayPowerRef.current > 0.05) && phaseRef.current === "aiming") {
        const barH = 160 * s;
        drawPowerBar(ctx, displayPowerRef.current, TABLE_W * s + 3 * s, TABLE_H * s * 0.5 - barH / 2, 11 * s, barH);
      }

      if (phaseRef.current === "placing-cue" && gs.isMyTurn) {
        drawPlacingOverlay(ctx, s, now, placePreviewRef.current, ballsRef.current, invalidPlaceRef.current);
      }

      if (myTurnAiming && !hintedRef.current) {
        ctx.save();
        ctx.setLineDash([2.5 * s, 4 * s]);
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cueBallDraw.pos.x * s, cueBallDraw.pos.y * s, CHARGE_GRAB_R * s, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (phaseRef.current === "idle" && !gs.isMyTurn && !gameOverRef.current && !playbackRef.current) {
        drawWaiting(ctx, s, now);
      }

      if (myTurnAiming && !hintedRef.current) {
        drawHint(ctx, s, now);
      }

      ctx.restore();
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [stepPlayback]);

  // ── HUD data ──────────────────────────────────────────────────────

  const [pidA, pidB] = gameState.playerIds;
  const opponentId = pidA === youId ? pidB : pidA;
  const opponentName = gameState.playerNames[opponentId] ?? "Opponent";

  const groupLabelFor = (g: string | null): string => {
    if (g == null) return "Group undecided";
    const gl = g.toLowerCase();
    if (gl.startsWith("solid")) return "Solids · 1–7";
    if (gl.startsWith("stripe")) return "Stripes · 9–15";
    return g;
  };
  const trayFor = (g: string | null): Ball[] => {
    if (g == null) return [];
    const gl = g.toLowerCase();
    if (gl.startsWith("solid")) return syncedState.pocketedSolids;
    if (gl.startsWith("stripe")) return syncedState.pocketedStripes;
    return [];
  };

  let statusMsg = "";
  if (!gameOver) {
    if (gameState.message) statusMsg = gameState.message;
    else if (gameState.isMyTurn) statusMsg = gameState.break_shot ? "Your break — drag to aim, pull back to shoot" : "Your turn";
    else statusMsg = gameState.break_shot ? `${opponentName} to break` : `${opponentName} is shooting…`;
  }

  const iWon = gameOver?.winnerId === youId;
  const winnerName = gameOver?.winnerId ? (gameState.playerNames[gameOver.winnerId] ?? "Opponent") : null;

  return (
    <div className="pool8-root" style={{ "--pool8-accent": accent } as CSSProperties}>
      <style>{POOL8_CSS}</style>

      <header className="pool8-header">
        <button className="pool8-iconbtn" onClick={onLeave} aria-label="Leave game">
          <LeaveIcon />
        </button>
        <div className="pool8-title">
          <h1>8-Ball Pool</h1>
          <span>{gameName}</span>
        </div>
        <button
          className="pool8-iconbtn"
          onClick={() => { sfxRef.current!.ensure(); setMuted((m) => !m); }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <SoundIcon off={muted} />
        </button>
      </header>

      <div className="pool8-players">
        <PlayerCard
          name={gameState.playerNames[pidA] ?? "Player 1"}
          isYou={pidA === youId}
          isTurn={gameState.currentTurn === pidA && !gameOver}
          groupLabel={groupLabelFor(gameState.assignments[0])}
          tray={trayFor(gameState.assignments[0])}
        />
        <PlayerCard
          name={gameState.playerNames[pidB] ?? "Player 2"}
          isYou={pidB === youId}
          isTurn={gameState.currentTurn === pidB && !gameOver}
          groupLabel={groupLabelFor(gameState.assignments[1])}
          tray={trayFor(gameState.assignments[1])}
        />
      </div>

      <div className="pool8-msg">{statusMsg}</div>

      <div className="pool8-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="pool8-canvas"
          style={{ width: canvasSize.w, height: canvasSize.h }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        />

        {gameOver && (
          <div className="pool8-over">
            <div className="pool8-card">
              <EightBallMark />
              <div className="pool8-wintitle">
                {iWon ? "You win" : winnerName ? `${winnerName} wins` : "Game over"}
              </div>
              <div className="pool8-winsub">
                {iWon ? "Rack cleared — well played." : "Better luck next rack."}
              </div>
              <button className="pool8-btn" onClick={onLeave}>Leave table</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
