import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Room } from "../../../shared/types";
import { T } from "./theme";

// ─── Types ───────────────────────────────────────────────────────────

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
  breakShot: boolean;
}

interface Vec2 {
  x: number;
  y: number;
}

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
}

// ─── Constants ───────────────────────────────────────────────────────

const TABLE_W = 780;
const TABLE_H = 400;
const CUSHION = 32;
const BALL_R = 11;
const POCKET_R = 22;
const FRICTION = 0.985;
const MIN_VEL = 0.08;
const MAX_POWER = 18;
const POWER_SCALE = 0.15;

const BALL_COLORS: Record<number, { color: string; stripe: boolean; solid: boolean }> = {
  0: { color: "#f5f5f0", stripe: false, solid: false },
  1: { color: "#f5c518", stripe: false, solid: true },
  2: { color: "#1a56db", stripe: false, solid: true },
  3: { color: "#dc2626", stripe: false, solid: true },
  4: { color: "#7c3aed", stripe: false, solid: true },
  5: { color: "#f97316", stripe: false, solid: true },
  6: { color: "#16a34a", stripe: false, solid: true },
  7: { color: "#92400e", stripe: false, solid: true },
  8: { color: "#1a1a1a", stripe: false, solid: false },
  9: { color: "#f5c518", stripe: true, solid: false },
  10: { color: "#1a56db", stripe: true, solid: false },
  11: { color: "#dc2626", stripe: true, solid: false },
  12: { color: "#7c3aed", stripe: true, solid: false },
  13: { color: "#f97316", stripe: true, solid: false },
  14: { color: "#16a34a", stripe: true, solid: false },
  15: { color: "#92400e", stripe: true, solid: false },
};

const POCKETS: Vec2[] = [
  { x: 0, y: 0 },
  { x: TABLE_W / 2, y: -4 },
  { x: TABLE_W, y: 0 },
  { x: 0, y: TABLE_H },
  { x: TABLE_W / 2, y: TABLE_H + 4 },
  { x: TABLE_W, y: TABLE_H },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function dist(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function createBall(id: number, pos: Vec2): Ball {
  const info = BALL_COLORS[id] ?? { color: "#888", stripe: false, solid: false };
  return {
    id,
    pos: { ...pos },
    vel: { x: 0, y: 0 },
    radius: BALL_R,
    color: info.color,
    stripe: info.stripe,
    solid: info.solid,
    isEight: id === 8,
    isCue: id === 0,
    pocketed: false,
    label: id === 0 ? "" : String(id),
  };
}

function rackBalls(): Ball[] {
  const balls: Ball[] = [];
  balls.push(createBall(0, { x: TABLE_W * 0.25, y: TABLE_H / 2 }));

  const startX = TABLE_W * 0.73;
  const startY = TABLE_H / 2;
  const spacing = BALL_R * 2.05;
  const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  let idx = 0;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      const x = startX + row * spacing * Math.cos(Math.PI / 6);
      const y = startY + (col - row / 2) * spacing;
      balls.push(createBall(rackOrder[idx]!, { x, y }));
      idx++;
    }
  }

  return balls;
}

function isNearPocket(pos: Vec2): boolean {
  return POCKETS.some((p) => dist(pos, p) < POCKET_R * 1.5);
}

// ─── Physics ─────────────────────────────────────────────────────────

function updatePhysics(balls: Ball[], onFirstHit?: (ballId: number) => void): boolean {
  let moving = false;
  let firstHitRecorded = false;

  for (const ball of balls) {
    if (ball.pocketed) continue;
    ball.pos.x += ball.vel.x;
    ball.pos.y += ball.vel.y;
    ball.vel.x *= FRICTION;
    ball.vel.y *= FRICTION;
    if (Math.abs(ball.vel.x) < MIN_VEL && Math.abs(ball.vel.y) < MIN_VEL) {
      ball.vel.x = 0;
      ball.vel.y = 0;
    } else {
      moving = true;
    }
  }

  for (const ball of balls) {
    if (ball.pocketed) continue;
    if (isNearPocket(ball.pos)) continue;
    if (ball.pos.x - ball.radius < 0) { ball.pos.x = ball.radius; ball.vel.x = Math.abs(ball.vel.x) * 0.8; }
    if (ball.pos.x + ball.radius > TABLE_W) { ball.pos.x = TABLE_W - ball.radius; ball.vel.x = -Math.abs(ball.vel.x) * 0.8; }
    if (ball.pos.y - ball.radius < 0) { ball.pos.y = ball.radius; ball.vel.y = Math.abs(ball.vel.y) * 0.8; }
    if (ball.pos.y + ball.radius > TABLE_H) { ball.pos.y = TABLE_H - ball.radius; ball.vel.y = -Math.abs(ball.vel.y) * 0.8; }
  }

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i]!;
      const b = balls[j]!;
      if (a.pocketed || b.pocketed) continue;
      const d = dist(a.pos, b.pos);
      const minDist = a.radius + b.radius;
      if (d < minDist && d > 0) {
        if (!firstHitRecorded && (a.isCue || b.isCue)) {
          onFirstHit?.(a.isCue ? b.id : a.id);
          firstHitRecorded = true;
        }
        const normal = normalize({ x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y });
        const relVel = { x: a.vel.x - b.vel.x, y: a.vel.y - b.vel.y };
        const velAlongNormal = relVel.x * normal.x + relVel.y * normal.y;
        if (velAlongNormal > 0) {
          const restitution = 0.95;
          const impulse = velAlongNormal * restitution;
          a.vel.x -= impulse * normal.x;
          a.vel.y -= impulse * normal.y;
          b.vel.x += impulse * normal.x;
          b.vel.y += impulse * normal.y;
          const overlap = minDist - d;
          a.pos.x -= normal.x * overlap * 0.5;
          a.pos.y -= normal.y * overlap * 0.5;
          b.pos.x += normal.x * overlap * 0.5;
          b.pos.y += normal.y * overlap * 0.5;
        }
      }
    }
  }

  for (const ball of balls) {
    if (ball.pocketed) continue;
    for (const pocket of POCKETS) {
      if (dist(ball.pos, pocket) < POCKET_R) {
        ball.pocketed = true;
        ball.vel.x = 0;
        ball.vel.y = 0;
        break;
      }
    }
  }

  return moving;
}

// ─── Drawing ─────────────────────────────────────────────────────────

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, scale: number) {
  if (ball.pocketed) return;
  const x = ball.pos.x * scale;
  const y = ball.pos.y * scale;
  const r = ball.radius * scale;

  ctx.beginPath();
  ctx.arc(x + 2 * scale, y + 2 * scale, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = ball.color;
  ctx.fill();

  if (ball.stripe) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f5f5f0";
    ctx.fillRect(x - r, y - r * 0.35, r * 2, r * 0.35);
    ctx.fillRect(x - r, y + r * 0.05, r * 2, r * 0.35);
    ctx.restore();
  }

  if (!ball.isCue) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = "#f5f5f0";
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${r * 0.7}px ${T.fontMono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.label, x, y + 0.5);
  }

  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawTable(ctx: CanvasRenderingContext2D, scale: number) {
  const w = TABLE_W * scale;
  const h = TABLE_H * scale;
  const c = CUSHION * scale;
  const pr = POCKET_R * scale;

  ctx.fillStyle = "#3d2b1f";
  ctx.beginPath();
  ctx.roundRect(-c * 0.6, -c * 0.6, w + c * 1.2, h + c * 1.2, 12 * scale);
  ctx.fill();

  ctx.fillStyle = "#1a6b3c";
  ctx.fillRect(-c * 0.3, -c * 0.3, w + c * 0.6, h + c * 0.6);

  const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
  gradient.addColorStop(0, "#1e8c4e");
  gradient.addColorStop(1, "#16703d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "rgba(0,0,0,0.02)";
  for (let i = 0; i < 50; i++) {
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 * scale, 2 * scale);
  }

  ctx.setLineDash([4 * scale, 4 * scale]);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(TABLE_W * 0.25 * scale, 0);
  ctx.lineTo(TABLE_W * 0.25 * scale, h);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(TABLE_W * 0.73 * scale, TABLE_H / 2 * scale, 2 * scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();

  for (const pocket of POCKETS) {
    const px = pocket.x * scale;
    const py = pocket.y * scale;
    ctx.beginPath();
    ctx.arc(px, py, pr * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0a0a";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.strokeStyle = "#2d1a0f";
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
  }

  ctx.strokeStyle = "#0d4a25";
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath(); ctx.moveTo(pr * 0.8, 0); ctx.lineTo(TABLE_W / 2 * scale - pr, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(TABLE_W / 2 * scale + pr, 0); ctx.lineTo(w - pr * 0.8, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(pr * 0.8, h); ctx.lineTo(TABLE_W / 2 * scale - pr, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(TABLE_W / 2 * scale + pr, h); ctx.lineTo(w - pr * 0.8, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, pr * 0.8); ctx.lineTo(0, h - pr * 0.8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w, pr * 0.8); ctx.lineTo(w, h - pr * 0.8); ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  for (const d of [0.25, 0.5, 0.75]) {
    ctx.beginPath(); ctx.arc(d * w, -c * 0.15, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(d * w, h + c * 0.15, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-c * 0.15, d * h, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w + c * 0.15, d * h, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCue(ctx: CanvasRenderingContext2D, cueBall: Ball, angle: number, power: number, scale: number, pulling: boolean) {
  if (cueBall.pocketed) return;
  const x = cueBall.pos.x * scale;
  const y = cueBall.pos.y * scale;
  const cueLength = 200 * scale;
  const cueOffset = (BALL_R + 8 + (pulling ? power * 4 : 0)) * scale;
  const cueWidth = 4 * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle + Math.PI);

  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.roundRect(2, -cueWidth / 2 + 2, cueLength, cueWidth, 2);
  ctx.fill();

  ctx.fillStyle = "#e8dcc8";
  ctx.fillRect(0, -cueWidth * 0.4, 8 * scale, cueWidth * 0.8);
  ctx.fillStyle = "#4a90d9";
  ctx.fillRect(-2 * scale, -cueWidth * 0.35, 3 * scale, cueWidth * 0.7);

  const shaftGrad = ctx.createLinearGradient(10 * scale, 0, cueLength * 0.5, 0);
  shaftGrad.addColorStop(0, "#f4e4c1");
  shaftGrad.addColorStop(1, "#e6d4a5");
  ctx.fillStyle = shaftGrad;
  ctx.fillRect(8 * scale, -cueWidth / 2, cueLength * 0.45, cueWidth);

  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(cueLength * 0.45, -cueWidth / 2, cueLength * 0.12, cueWidth);

  const buttGrad = ctx.createLinearGradient(cueLength * 0.57, 0, cueLength, 0);
  buttGrad.addColorStop(0, "#2d1810");
  buttGrad.addColorStop(1, "#1a0f09");
  ctx.fillStyle = buttGrad;
  ctx.fillRect(cueLength * 0.57, -cueWidth / 2, cueLength * 0.43, cueWidth);

  ctx.fillStyle = "#1a1a1a";
  ctx.beginPath();
  ctx.roundRect(cueLength - 4 * scale, -cueWidth / 2, 4 * scale, cueWidth, [0, 2, 2, 0]);
  ctx.fill();

  ctx.restore();

  if (!pulling) {
    ctx.setLineDash([4 * scale, 6 * scale]);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * 300 * scale, y + Math.sin(angle) * 300 * scale);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawPowerBar(ctx: CanvasRenderingContext2D, power: number, maxPower: number, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();

  const fillH = (power / maxPower) * (h - 4);
  const gradient = ctx.createLinearGradient(x, y + h - 2, x, y + 2);
  gradient.addColorStop(0, "#4ade80");
  gradient.addColorStop(0.5, "#facc15");
  gradient.addColorStop(1, "#ef4444");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + h - 2 - fillH, w - 4, fillH, 4);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `bold 9px ${T.fontMono}`;
  ctx.textAlign = "center";
  ctx.fillText("PWR", x + w / 2, y - 6);
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

export function PoolFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 500 });
  const [scale, setScale] = useState(1);
  const [balls, setBalls] = useState<Ball[]>(() => rackBalls());
  const [phase, setPhase] = useState<"aiming" | "moving" | "placing-cue">("aiming");
  const [aimAngle, setAimAngle] = useState(0);
  const [power, setPower] = useState(0);
  const [pocketedSolids, setPocketedSolids] = useState<Ball[]>([]);
  const [pocketedStripes, setPocketedStripes] = useState<Ball[]>([]);
  const [pocketedEight, setPocketedEight] = useState(false);

  const mouseRef = useRef({ x: 0, y: 0 });
  const pullingRef = useRef(false);
  const pullStartRef = useRef({ x: 0, y: 0 });
  const firstHitRef = useRef<number | null>(null);
  const shotPocketedRef = useRef<number[]>([]);

  const myAssignment = gameState.myAssignment;
  const isMyTurn = gameState.isMyTurn;

  const cueBall = useMemo(() => balls.find((b) => b.isCue)!, [balls]);

  // Responsive canvas
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxW = rect.width - 16;
      const tableAspect = (TABLE_W + CUSHION) / (TABLE_H + CUSHION);
      let w = maxW;
      let h = w / tableAspect;
      if (h > window.innerHeight * 0.55) {
        h = window.innerHeight * 0.55;
        w = h * tableAspect;
      }
      setCanvasSize({ w: Math.floor(w), h: Math.floor(h) });
      setScale(w / (TABLE_W + CUSHION));
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Reset balls when game restarts
  useEffect(() => {
    if (gameOver) {
      setBalls(rackBalls());
      setPhase("aiming");
      setPocketedSolids([]);
      setPocketedStripes([]);
      setPocketedEight(false);
    }
  }, [gameOver]);

  // Sync phase from server state
  useEffect(() => {
    if (gameState.foul === "placing-cue") {
      setPhase("placing-cue");
    } else if (isMyTurn && phase !== "moving") {
      setPhase("aiming");
    }
  }, [gameState.foul, isMyTurn]);

  // Get table position from pointer
  const getTablePos = useCallback(
    (clientX: number, clientY: number): Vec2 | null => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const padding = CUSHION * scale;
      const x = (clientX - rect.left - padding) / scale;
      const y = (clientY - rect.top - padding) / scale;
      if (x < -50 || x > TABLE_W + 50 || y < -50 || y > TABLE_H + 50) return null;
      return { x, y };
    },
    [scale]
  );

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pos = getTablePos(e.clientX, e.clientY);
      if (!pos) return;

      if (phase === "placing-cue") {
        const clampedX = Math.max(BALL_R, Math.min(TABLE_W * 0.25 - BALL_R, pos.x));
        const clampedY = Math.max(BALL_R, Math.min(TABLE_H - BALL_R, pos.y));
        const overlapping = balls.some(
          (b) => !b.isCue && !b.pocketed && dist({ x: clampedX, y: clampedY }, b.pos) < BALL_R * 2.2
        );
        if (!overlapping) {
          setBalls((prev) => prev.map((b) => (b.isCue ? { ...b, pos: { x: clampedX, y: clampedY } } : b)));
          setPhase("aiming");
          onSubmitAction({ type: "place_cue", x: clampedX, y: clampedY });
        }
        return;
      }

      if (phase === "aiming" && isMyTurn) {
        pullingRef.current = true;
        pullStartRef.current = { x: e.clientX, y: e.clientY };
        mouseRef.current = { x: e.clientX, y: e.clientY };
      }
    },
    [phase, isMyTurn, getTablePos, balls, onSubmitAction]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const pos = getTablePos(e.clientX, e.clientY);
      if (!pos) return;

      if (phase === "aiming" && !pullingRef.current && isMyTurn) {
        setAimAngle(Math.atan2(pos.y - cueBall.pos.y, pos.x - cueBall.pos.x));
      }

      if (phase === "aiming" && pullingRef.current) {
        mouseRef.current = { x: e.clientX, y: e.clientY };
        const dx = pullStartRef.current.x - e.clientX;
        const dy = pullStartRef.current.y - e.clientY;
        const pullDist = Math.sqrt(dx * dx + dy * dy);
        setPower(Math.min(MAX_POWER, pullDist * POWER_SCALE));
      }
    },
    [phase, isMyTurn, getTablePos, cueBall]
  );

  const handlePointerUp = useCallback(() => {
    if (phase === "aiming" && pullingRef.current && isMyTurn) {
      pullingRef.current = false;
      if (power > 0.5) {
        firstHitRef.current = null;
        shotPocketedRef.current = [];
        setBalls((prev) =>
          prev.map((b) =>
            b.isCue
              ? { ...b, vel: { x: Math.cos(aimAngle) * power, y: Math.sin(aimAngle) * power } }
              : b
          )
        );
        setPhase("moving");
      } else {
        setPower(0);
      }
    }
  }, [phase, isMyTurn, power, aimAngle]);

  // Physics loop
  useEffect(() => {
    if (phase !== "moving") return;

    const loop = () => {
      setBalls((prev) => {
        const newBalls = prev.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } }));
        const stillMoving = updatePhysics(newBalls, (ballId) => {
          if (firstHitRef.current === null) firstHitRef.current = ballId;
        });

        // Track newly pocketed
        for (const b of newBalls) {
          if (b.pocketed && !shotPocketedRef.current.includes(b.id) && !b.isCue) {
            shotPocketedRef.current.push(b.id);
          }
        }

        if (!stillMoving) {
          // Turn ended
          const cuePocketed = newBalls.find((b) => b.isCue)?.pocketed ?? false;
          onSubmitAction({
            type: "turn_result",
            pocketedIds: shotPocketedRef.current,
            cuePocketed,
            firstHit: firstHitRef.current,
          });
          setPower(0);
          setPhase(gameState.foul === "placing-cue" ? "placing-cue" : "aiming");

          // Update pocketed display
          const solids = newBalls.filter((b) => b.pocketed && b.solid);
          const stripes = newBalls.filter((b) => b.pocketed && b.stripe);
          setPocketedSolids(solids);
          setPocketedStripes(stripes);
          setPocketedEight(newBalls.find((b) => b.isEight)?.pocketed ?? false);

          return newBalls;
        }
        return newBalls;
      });
    };

    animRef.current = window.setInterval(loop, 1000 / 60);
    return () => clearInterval(animRef.current);
  }, [phase, onSubmitAction, gameState.foul]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    const padding = CUSHION * scale;
    ctx.save();
    ctx.translate(padding, padding);

    drawTable(ctx, scale);

    const sortedBalls = [...balls].sort((a, b) => a.pos.y - b.pos.y);
    for (const ball of sortedBalls) {
      drawBall(ctx, ball, scale);
    }

    if (phase === "aiming" && !cueBall.pocketed && isMyTurn) {
      drawCue(ctx, cueBall, aimAngle, power, scale, pullingRef.current);
    }

    if (phase === "aiming" && pullingRef.current) {
      drawPowerBar(ctx, power, MAX_POWER, TABLE_W * scale + CUSHION * scale * 0.4, 20, 14 * scale, 150 * scale);
    }

    if (phase === "placing-cue") {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, TABLE_W * 0.25 * scale, TABLE_H * scale);
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(0, 0, TABLE_W * 0.25 * scale, TABLE_H * scale);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = `12px ${T.fontBody}`;
      ctx.textAlign = "center";
      ctx.fillText("Tap to place cue ball", TABLE_W * 0.125 * scale, TABLE_H * scale + 20);
    }

    ctx.restore();
  }, [balls, canvasSize, scale, phase, cueBall, aimAngle, power, isMyTurn]);

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bgDeep, display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
        <button onClick={onLeave} style={{ ...T.glass(), color: T.chalk, width: 44, height: 44, borderRadius: 14, fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>&#8249;</button>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, letterSpacing: "0.02em", margin: 0 }}>{gameName}</h1>
        </div>
        <div style={{ width: 44 }} />
      </div>

      {/* Player info */}
      <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", padding: "0 16px 8px", gap: 12 }}>
        {gameState.playerIds.map((pid, idx) => {
          const isActive = gameState.currentTurn === pid;
          const assignment = gameState.assignments[idx];
          return (
            <div
              key={pid}
              style={{
                flex: 1,
                maxWidth: 200,
                padding: "10px 12px",
                borderRadius: 12,
                background: isActive ? `${accent}12` : "transparent",
                border: `1.5px solid ${isActive ? accent : "transparent"}`,
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: isActive ? accent : T.chalkMuted, boxShadow: isActive ? `0 0 8px ${accent}` : "none" }} />
                <span style={{ fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 700, color: isActive ? accent : T.chalkMuted }}>
                  {gameState.playerNames[pid]}{pid === youId ? " (you)" : ""}
                </span>
                {assignment && (
                  <span style={{ fontSize: 10, fontFamily: T.fontMono, color: T.chalkMuted, marginLeft: "auto", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {assignment}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 3, minHeight: 16 }}>
                {(assignment === "solids" ? pocketedSolids : assignment === "stripes" ? pocketedStripes : []).map((b) => (
                  <div key={b.id} style={{ width: 14, height: 14, borderRadius: "50%", background: b.color, border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff", fontWeight: 700 }}>
                    {b.id}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Message */}
      <div style={{ flexShrink: 0, textAlign: "center", padding: "4px 16px" }}>
        <span style={{ fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 600, color: gameState.foul ? "#ef4444" : gameState.winnerId ? accent : T.chalkMuted }}>
          {gameState.message}
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px", minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize.w,
            height: canvasSize.h,
            cursor: phase === "placing-cue" ? "crosshair" : phase === "aiming" && isMyTurn ? "none" : "default",
            touchAction: "none",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* 8-ball pocketed indicator */}
      {pocketedEight && (
        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "8px 16px", background: "rgba(0,0,0,0.8)", borderRadius: 8, border: "1px solid #333", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #444", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>8</div>
          <span style={{ fontSize: 12, color: T.chalkMuted }}>8-ball pocketed</span>
        </div>
      )}

      {/* Game over overlay */}
      {gameOver && (
        <div style={{ position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}>
          <div style={{ textAlign: "center", padding: 32 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>{gameOver.winnerId === youId ? "\uD83C\uDFC6" : "\uD83C\uDF89"}</div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 28, fontWeight: 800, color: gameOver.winnerId === youId ? T.green : T.red, marginBottom: 8 }}>
              {gameOver.winnerId === youId ? "You Win!" : "You Lose"}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 13, color: T.chalkDim, marginBottom: 24 }}>{gameState.message}</div>
            <button onClick={onLeave} style={{ padding: "12px 36px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
          </div>
        </div>
      )}
    </div>
  );
}
