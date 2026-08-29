// import { useState, useRef, useEffect, useCallback, useMemo } from "react";
// import type { Room } from "../../../shared/types";
// import { T } from "./theme";

// export interface PoolView {
//   currentTurn: string;
//   isMyTurn: boolean;
//   assignments: [string | null, string | null];
//   myAssignment: string | null;
//   foul: string | null;
//   winnerId: string | null;
//   message: string;
//   playerNames: Record<string, string>;
//   playerIds: [string, string];
//   breakShot: boolean;
//   ballPositions?: { id: number; x: number; y: number; pocketed: boolean }[];
//   incomingShot?: { angle: number; power: number };
// }

// interface Vec2 { x: number; y: number }

// interface Ball {
//   id: number;
//   pos: Vec2;
//   vel: Vec2;
//   radius: number;
//   color: string;
//   stripe: boolean;
//   solid: boolean;
//   isEight: boolean;
//   isCue: boolean;
//   pocketed: boolean;
//   label: string;
// }

// const TABLE_W = 340;
// const TABLE_H = 600;
// const CUSHION = 26;
// const BALL_R = 9;
// const POCKET_R = 16;
// const FRICTION = 0.986;
// const MIN_VEL = 0.06;
// const MAX_POWER = 14;
// const POWER_SCALE = 0.1;

// const BALL_COLORS: Record<number, { color: string; stripe: boolean; solid: boolean }> = {
//   0: { color: "#f5f5f0", stripe: false, solid: false },
//   1: { color: "#f5c518", stripe: false, solid: true },
//   2: { color: "#2563eb", stripe: false, solid: true },
//   3: { color: "#dc2626", stripe: false, solid: true },
//   4: { color: "#7c3aed", stripe: false, solid: true },
//   5: { color: "#f97316", stripe: false, solid: true },
//   6: { color: "#16a34a", stripe: false, solid: true },
//   7: { color: "#92400e", stripe: false, solid: true },
//   8: { color: "#111111", stripe: false, solid: false },
//   9: { color: "#f5c518", stripe: true, solid: false },
//   10: { color: "#2563eb", stripe: true, solid: false },
//   11: { color: "#dc2626", stripe: true, solid: false },
//   12: { color: "#7c3aed", stripe: true, solid: false },
//   13: { color: "#f97316", stripe: true, solid: false },
//   14: { color: "#16a34a", stripe: true, solid: false },
//   15: { color: "#92400e", stripe: true, solid: false },
// };

// const POCKETS: Vec2[] = [
//   { x: -2, y: -2 },
//   { x: TABLE_W + 2, y: -2 },
//   { x: -4, y: TABLE_H / 2 },
//   { x: TABLE_W + 4, y: TABLE_H / 2 },
//   { x: -2, y: TABLE_H + 2 },
//   { x: TABLE_W + 2, y: TABLE_H + 2 },
// ];

// function dist(a: Vec2, b: Vec2): number {
//   return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
// }

// function normalize(v: Vec2): Vec2 {
//   const len = Math.sqrt(v.x * v.x + v.y * v.y);
//   if (len === 0) return { x: 0, y: 0 };
//   return { x: v.x / len, y: v.y / len };
// }

// function lerpAngle(a: number, b: number, t: number): number {
//   let diff = b - a;
//   while (diff > Math.PI) diff -= Math.PI * 2;
//   while (diff < -Math.PI) diff += Math.PI * 2;
//   return a + diff * t;
// }

// function createBall(id: number, pos: Vec2): Ball {
//   const info = BALL_COLORS[id] ?? { color: "#888", stripe: false, solid: false };
//   return {
//     id, pos: { ...pos }, vel: { x: 0, y: 0 }, radius: BALL_R,
//     color: info.color, stripe: info.stripe, solid: info.solid,
//     isEight: id === 8, isCue: id === 0, pocketed: false,
//     label: id === 0 ? "" : String(id),
//   };
// }

// function rackBalls(): Ball[] {
//   const balls: Ball[] = [];
//   balls.push(createBall(0, { x: TABLE_W / 2, y: TABLE_H * 0.22 }));

//   const rackX = TABLE_W / 2;
//   const rackY = TABLE_H * 0.73;
//   const spacing = BALL_R * 2.08;
//   const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
//   let idx = 0;

//   for (let row = 0; row < 5; row++) {
//     for (let col = 0; col <= row; col++) {
//       const x = rackX + (col - row / 2) * spacing;
//       const y = rackY - row * spacing * 0.866;
//       balls.push(createBall(rackOrder[idx]!, { x, y }));
//       idx++;
//     }
//   }
//   return balls;
// }

// function isNearPocket(pos: Vec2): boolean {
//   return POCKETS.some((p) => dist(pos, p) < POCKET_R * 1.7);
// }

// function serializeBalls(balls: Ball[]) {
//   return balls.map((b) => ({ id: b.id, x: Math.round(b.pos.x * 100) / 100, y: Math.round(b.pos.y * 100) / 100, pocketed: b.pocketed }));
// }

// function applyBallState(balls: Ball[], state: { id: number; x: number; y: number; pocketed: boolean }[]): Ball[] {
//   const stateMap = new Map(state.map((s) => [s.id, s]));
//   return balls.map((b) => {
//     const s = stateMap.get(b.id);
//     if (!s) return b;
//     return { ...b, pos: { x: s.x, y: s.y }, pocketed: s.pocketed, vel: { x: 0, y: 0 } };
//   });
// }

// // ─── Physics ─────────────────────────────────────────────────────────

// function runPhysicsUntilStopped(
//   balls: Ball[],
//   shotAngle: number,
//   shotPower: number,
//   onProgress?: (balls: Ball[]) => void
// ): { finalBalls: Ball[]; pocketedIds: number[]; cuePocketed: boolean; firstHit: number | null } {
//   const simBalls = balls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } }));

//   const cue = simBalls.find((b) => b.isCue);
//   if (cue && !cue.pocketed) {
//     cue.vel = { x: Math.cos(shotAngle) * shotPower, y: Math.sin(shotAngle) * shotPower };
//   }

//   let firstHit: number | null = null;
//   const pocketedIds: number[] = [];
//   let frame = 0;

//   while (frame < 800) {
//     let moving = false;

//     for (const ball of simBalls) {
//       if (ball.pocketed) continue;
//       ball.pos.x += ball.vel.x;
//       ball.pos.y += ball.vel.y;
//       ball.vel.x *= FRICTION;
//       ball.vel.y *= FRICTION;
//       if (Math.abs(ball.vel.x) < MIN_VEL && Math.abs(ball.vel.y) < MIN_VEL) {
//         ball.vel.x = 0;
//         ball.vel.y = 0;
//       } else {
//         moving = true;
//       }
//     }

//     for (const ball of simBalls) {
//       if (ball.pocketed || isNearPocket(ball.pos)) continue;
//       if (ball.pos.x - ball.radius < 0) { ball.pos.x = ball.radius; ball.vel.x = Math.abs(ball.vel.x) * 0.78; }
//       if (ball.pos.x + ball.radius > TABLE_W) { ball.pos.x = TABLE_W - ball.radius; ball.vel.x = -Math.abs(ball.vel.x) * 0.78; }
//       if (ball.pos.y - ball.radius < 0) { ball.pos.y = ball.radius; ball.vel.y = Math.abs(ball.vel.y) * 0.78; }
//       if (ball.pos.y + ball.radius > TABLE_H) { ball.pos.y = TABLE_H - ball.radius; ball.vel.y = -Math.abs(ball.vel.y) * 0.78; }
//     }

//     for (let i = 0; i < simBalls.length; i++) {
//       for (let j = i + 1; j < simBalls.length; j++) {
//         const a = simBalls[i]!;
//         const b = simBalls[j]!;
//         if (a.pocketed || b.pocketed) continue;
//         const d = dist(a.pos, b.pos);
//         const minDist = a.radius + b.radius;
//         if (d < minDist && d > 0.001) {
//           if (firstHit === null && (a.isCue || b.isCue)) {
//             firstHit = a.isCue ? b.id : a.id;
//           }
//           const normal = normalize({ x: b.pos.x - a.pos.x, y: b.pos.y - a.pos.y });
//           const relVel = { x: a.vel.x - b.vel.x, y: a.vel.y - b.vel.y };
//           const velAlongNormal = relVel.x * normal.x + relVel.y * normal.y;
//           if (velAlongNormal > 0) {
//             const impulse = velAlongNormal * 0.96;
//             a.vel.x -= impulse * normal.x;
//             a.vel.y -= impulse * normal.y;
//             b.vel.x += impulse * normal.x;
//             b.vel.y += impulse * normal.y;
//             const overlap = minDist - d;
//             a.pos.x -= normal.x * overlap * 0.5;
//             a.pos.y -= normal.y * overlap * 0.5;
//             b.pos.x += normal.x * overlap * 0.5;
//             b.pos.y += normal.y * overlap * 0.5;
//           }
//         }
//       }
//     }

//     for (const ball of simBalls) {
//       if (ball.pocketed) continue;
//       for (const pocket of POCKETS) {
//         if (dist(ball.pos, pocket) < POCKET_R) {
//           ball.pocketed = true;
//           ball.vel.x = 0;
//           ball.vel.y = 0;
//           if (!ball.isCue) pocketedIds.push(ball.id);
//           break;
//         }
//       }
//     }

//     frame++;
//     if (onProgress && frame % 2 === 0) {
//       onProgress(simBalls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
//     }

//     if (!moving) break;
//   }

//   return {
//     finalBalls: simBalls,
//     pocketedIds,
//     cuePocketed: simBalls.find((b) => b.isCue)?.pocketed ?? false,
//     firstHit,
//   };
// }

// // ─── Drawing ─────────────────────────────────────────────────────────

// function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, s: number) {
//   if (ball.pocketed) return;
//   const x = ball.pos.x * s;
//   const y = ball.pos.y * s;
//   const r = ball.radius * s;

//   ctx.beginPath();
//   ctx.arc(x + 1.2 * s, y + 1.5 * s, r * 0.95, 0, Math.PI * 2);
//   ctx.fillStyle = "rgba(0,0,0,0.28)";
//   ctx.fill();

//   const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
//   ballGrad.addColorStop(0, lightenColor(ball.color, 30));
//   ballGrad.addColorStop(0.7, ball.color);
//   ballGrad.addColorStop(1, darkenColor(ball.color, 30));
//   ctx.beginPath();
//   ctx.arc(x, y, r, 0, Math.PI * 2);
//   ctx.fillStyle = ballGrad;
//   ctx.fill();

//   if (ball.stripe) {
//     ctx.save();
//     ctx.beginPath();
//     ctx.arc(x, y, r - 0.5, 0, Math.PI * 2);
//     ctx.clip();
//     ctx.fillStyle = "#f8f8f5";
//     ctx.fillRect(x - r, y - r * 0.38, r * 2, r * 0.32);
//     ctx.fillRect(x - r, y + r * 0.06, r * 2, r * 0.32);
//     ctx.restore();
//   }

//   if (!ball.isCue) {
//     ctx.beginPath();
//     ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
//     ctx.fillStyle = "#f8f8f5";
//     ctx.fill();
//     ctx.fillStyle = ball.isEight ? "#f8f8f5" : "#222";
//     ctx.font = `bold ${Math.max(1, r * 0.6)}px monospace`;
//     ctx.textAlign = "center";
//     ctx.textBaseline = "middle";
//     ctx.fillText(ball.label, x, y + 0.3);
//   }

//   ctx.beginPath();
//   ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.25, 0, Math.PI * 2);
//   ctx.fillStyle = "rgba(255,255,255,0.45)";
//   ctx.fill();

//   ctx.beginPath();
//   ctx.arc(x, y, r, 0, Math.PI * 2);
//   ctx.strokeStyle = "rgba(0,0,0,0.1)";
//   ctx.lineWidth = 0.4;
//   ctx.stroke();
// }

// function lightenColor(hex: string, amount: number): string {
//   const num = parseInt(hex.replace("#", ""), 16);
//   const r = Math.min(255, (num >> 16) + amount);
//   const g = Math.min(255, ((num >> 8) & 0xff) + amount);
//   const b = Math.min(255, (num & 0xff) + amount);
//   return `rgb(${r},${g},${b})`;
// }

// function darkenColor(hex: string, amount: number): string {
//   const num = parseInt(hex.replace("#", ""), 16);
//   const r = Math.max(0, (num >> 16) - amount);
//   const g = Math.max(0, ((num >> 8) & 0xff) - amount);
//   const b = Math.max(0, (num & 0xff) - amount);
//   return `rgb(${r},${g},${b})`;
// }

// function drawTable(ctx: CanvasRenderingContext2D, s: number) {
//   const w = TABLE_W * s;
//   const h = TABLE_H * s;
//   const c = CUSHION * s;
//   const pr = POCKET_R * s;

//   const woodGrad = ctx.createLinearGradient(-c, -c, w + c, h + c);
//   woodGrad.addColorStop(0, "#4a3425");
//   woodGrad.addColorStop(0.3, "#5a3f2d");
//   woodGrad.addColorStop(0.7, "#4a3425");
//   woodGrad.addColorStop(1, "#3d2b1f");
//   ctx.fillStyle = woodGrad;
//   ctx.beginPath();
//   ctx.roundRect(-c * 0.65, -c * 0.65, w + c * 1.3, h + c * 1.3, 10 * s);
//   ctx.fill();

//   ctx.strokeStyle = "#2a1a10";
//   ctx.lineWidth = 1.5 * s;
//   ctx.beginPath();
//   ctx.roundRect(-c * 0.5, -c * 0.5, w + c, h + c, 8 * s);
//   ctx.stroke();

//   const cushionGrad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
//   cushionGrad.addColorStop(0, "#1f7a45");
//   cushionGrad.addColorStop(1, "#15633a");
//   ctx.fillStyle = cushionGrad;
//   ctx.fillRect(-c * 0.35, -c * 0.35, w + c * 0.7, h + c * 0.7);

//   const feltGrad = ctx.createLinearGradient(0, 0, 0, h);
//   feltGrad.addColorStop(0, "#1d8848");
//   feltGrad.addColorStop(0.5, "#1a7c42");
//   feltGrad.addColorStop(1, "#167038");
//   ctx.fillStyle = feltGrad;
//   ctx.fillRect(0, 0, w, h);

//   ctx.globalAlpha = 0.02;
//   for (let i = 0; i < 100; i++) {
//     ctx.fillStyle = Math.random() > 0.5 ? "#000" : "#fff";
//     ctx.fillRect(Math.random() * w, Math.random() * h, 1.2 * s, 1.2 * s);
//   }
//   ctx.globalAlpha = 1;

//   ctx.setLineDash([2.5 * s, 2.5 * s]);
//   ctx.strokeStyle = "rgba(255,255,255,0.05)";
//   ctx.lineWidth = 0.8;
//   ctx.beginPath();
//   ctx.moveTo(0, TABLE_H * 0.25 * s);
//   ctx.lineTo(w, TABLE_H * 0.25 * s);
//   ctx.stroke();
//   ctx.setLineDash([]);

//   ctx.beginPath();
//   ctx.arc(TABLE_W / 2 * s, TABLE_H * 0.73 * s, 1.8 * s, 0, Math.PI * 2);
//   ctx.fillStyle = "rgba(255,255,255,0.1)";
//   ctx.fill();

//   for (const pocket of POCKETS) {
//     const px = pocket.x * s;
//     const py = pocket.y * s;

//     ctx.beginPath();
//     ctx.arc(px, py, pr * 1.2, 0, Math.PI * 2);
//     ctx.fillStyle = "rgba(0,0,0,0.4)";
//     ctx.fill();

//     const pocketGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
//     pocketGrad.addColorStop(0, "#050505");
//     pocketGrad.addColorStop(0.8, "#0a0a0a");
//     pocketGrad.addColorStop(1, "#1a1a1a");
//     ctx.beginPath();
//     ctx.arc(px, py, pr, 0, Math.PI * 2);
//     ctx.fillStyle = pocketGrad;
//     ctx.fill();

//     ctx.beginPath();
//     ctx.arc(px, py, pr + 1, 0, Math.PI * 2);
//     ctx.strokeStyle = "#3a2515";
//     ctx.lineWidth = 2.2 * s;
//     ctx.stroke();
//   }

//   ctx.strokeStyle = "#0e5028";
//   ctx.lineWidth = 1.2 * s;

//   ctx.beginPath();
//   ctx.moveTo(-0.5 * s, pr * 0.85);
//   ctx.lineTo(-0.5 * s, TABLE_H / 2 * s - pr * 1.1);
//   ctx.stroke();
//   ctx.beginPath();
//   ctx.moveTo(-0.5 * s, TABLE_H / 2 * s + pr * 1.1);
//   ctx.lineTo(-0.5 * s, h - pr * 0.85);
//   ctx.stroke();

//   ctx.beginPath();
//   ctx.moveTo(w + 0.5 * s, pr * 0.85);
//   ctx.lineTo(w + 0.5 * s, TABLE_H / 2 * s - pr * 1.1);
//   ctx.stroke();
//   ctx.beginPath();
//   ctx.moveTo(w + 0.5 * s, TABLE_H / 2 * s + pr * 1.1);
//   ctx.lineTo(w + 0.5 * s, h - pr * 0.85);
//   ctx.stroke();

//   ctx.beginPath();
//   ctx.moveTo(pr * 0.85, -0.5 * s);
//   ctx.lineTo(w - pr * 0.85, -0.5 * s);
//   ctx.stroke();

//   ctx.beginPath();
//   ctx.moveTo(pr * 0.85, h + 0.5 * s);
//   ctx.lineTo(w - pr * 0.85, h + 0.5 * s);
//   ctx.stroke();

//   ctx.fillStyle = "rgba(255,255,255,0.08)";
//   const vD = [0.25, 0.5, 0.75];
//   for (const d of vD) {
//     ctx.beginPath(); ctx.arc(-c * 0.18, d * h, 1.8 * s, 0, Math.PI * 2); ctx.fill();
//     ctx.beginPath(); ctx.arc(w + c * 0.18, d * h, 1.8 * s, 0, Math.PI * 2); ctx.fill();
//   }
//   const hD = [0.25, 0.5, 0.75];
//   for (const d of hD) {
//     ctx.beginPath(); ctx.arc(d * w, -c * 0.18, 1.8 * s, 0, Math.PI * 2); ctx.fill();
//     ctx.beginPath(); ctx.arc(d * w, h + c * 0.18, 1.8 * s, 0, Math.PI * 2); ctx.fill();
//   }
// }

// function drawCue(
//   ctx: CanvasRenderingContext2D,
//   cueBall: Ball,
//   angle: number,
//   power: number,
//   s: number,
//   pulling: boolean
// ) {
//   if (cueBall.pocketed) return;
//   const x = cueBall.pos.x * s;
//   const y = cueBall.pos.y * s;
//   const len = 160 * s;
//   const w = 3 * s;

//   ctx.save();
//   ctx.translate(x, y);
//   ctx.rotate(angle + Math.PI);

//   ctx.fillStyle = "rgba(0,0,0,0.15)";
//   ctx.beginPath();
//   ctx.roundRect(1, -w / 2 + 1, len, w, 1);
//   ctx.fill();

//   ctx.fillStyle = "#5b9bd5";
//   ctx.beginPath();
//   ctx.roundRect(-1.5 * s, -w * 0.3, 2.5 * s, w * 0.6, 0.5);
//   ctx.fill();

//   ctx.fillStyle = "#f0e8d8";
//   ctx.fillRect(1 * s, -w * 0.35, 5 * s, w * 0.7);

//   const shaftGrad = ctx.createLinearGradient(6 * s, 0, len * 0.42, 0);
//   shaftGrad.addColorStop(0, "#f5e8c8");
//   shaftGrad.addColorStop(0.5, "#eddbb5");
//   shaftGrad.addColorStop(1, "#e5d0a8");
//   ctx.fillStyle = shaftGrad;
//   ctx.fillRect(6 * s, -w / 2, len * 0.38, w);

//   ctx.fillStyle = "#c8a870";
//   ctx.fillRect(len * 0.44, -w / 2, 3 * s, w);

//   ctx.fillStyle = "#1a1a1a";
//   ctx.fillRect(len * 0.47, -w / 2, len * 0.1, w);
//   ctx.strokeStyle = "#333";
//   ctx.lineWidth = 0.3;
//   for (let i = 0; i < 4; i++) {
//     const wx = len * 0.47 + (len * 0.1 / 4) * (i + 0.5);
//     ctx.beginPath();
//     ctx.moveTo(wx, -w / 2);
//     ctx.lineTo(wx, w / 2);
//     ctx.stroke();
//   }

//   const buttGrad = ctx.createLinearGradient(len * 0.57, 0, len, 0);
//   buttGrad.addColorStop(0, "#352015");
//   buttGrad.addColorStop(0.5, "#2a1810");
//   buttGrad.addColorStop(1, "#1f100a");
//   ctx.fillStyle = buttGrad;
//   ctx.fillRect(len * 0.57, -w / 2, len * 0.43, w);

//   ctx.fillStyle = "#111";
//   ctx.beginPath();
//   ctx.roundRect(len - 2.5 * s, -w / 2, 2.5 * s, w, [0, 1, 1, 0]);
//   ctx.fill();

//   ctx.restore();

//   if (!pulling) {
//     ctx.save();
//     ctx.setLineDash([2.5 * s, 4 * s]);
//     ctx.strokeStyle = "rgba(255,255,255,0.1)";
//     ctx.lineWidth = 0.8;
//     ctx.beginPath();
//     ctx.moveTo(x, y);
//     ctx.lineTo(x + Math.cos(angle) * 200 * s, y + Math.sin(angle) * 200 * s);
//     ctx.stroke();
//     ctx.setLineDash([]);
//     ctx.restore();
//   }
// }

// function drawPowerBar(ctx: CanvasRenderingContext2D, power: number, x: number, y: number, w: number, h: number, _accent: string) {
//   ctx.fillStyle = "rgba(0,0,0,0.5)";
//   ctx.beginPath();
//   ctx.roundRect(x, y, w, h, 6);
//   ctx.fill();

//   const pct = power / MAX_POWER;
//   const fillH = pct * (h - 4);
//   if (fillH > 1) {
//     const gradient = ctx.createLinearGradient(x, y + h - 2, x, y + 2);
//     gradient.addColorStop(0, "#4ade80");
//     gradient.addColorStop(0.35, "#a3e635");
//     gradient.addColorStop(0.6, "#facc15");
//     gradient.addColorStop(0.8, "#f97316");
//     gradient.addColorStop(1, "#ef4444");
//     ctx.fillStyle = gradient;
//     ctx.beginPath();
//     ctx.roundRect(x + 2, y + h - 2 - fillH, w - 4, fillH, 4);
//     ctx.fill();

//     ctx.beginPath();
//     ctx.roundRect(x + 2, y + h - 2 - fillH, w - 4, 3, 2);
//     ctx.fillStyle = "rgba(255,255,255,0.3)";
//     ctx.fill();
//   }

//   ctx.strokeStyle = "rgba(255,255,255,0.15)";
//   ctx.lineWidth = 0.8;
//   ctx.beginPath();
//   ctx.roundRect(x, y, w, h, 6);
//   ctx.stroke();

//   ctx.fillStyle = "rgba(255,255,255,0.7)";
//   ctx.font = `bold 8px monospace`;
//   ctx.textAlign = "center";
//   ctx.fillText(`${Math.round(pct * 100)}%`, x + w / 2, y + h + 12);
// }

// // ─── Component ───────────────────────────────────────────────────────

// interface Props {
//   gameState: PoolView;
//   youId: string;
//   gameOver: { winnerId?: string } | null;
//   room: Room;
//   gameName: string;
//   accent: string;
//   onLeave: () => void;
//   onSubmitAction: (action: unknown) => void;
// }

// export function PoolFullscreen({ gameState, youId, gameOver, room, gameName, accent, onLeave, onSubmitAction }: Props) {
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const containerRef = useRef<HTMLDivElement>(null);

//   const [canvasSize, setCanvasSize] = useState({ w: 380, h: 660 });
//   const [scale, setScale] = useState(1);
//   const [balls, setBalls] = useState<Ball[]>(() => rackBalls());
//   const [phase, setPhase] = useState<"idle" | "aiming" | "simulating" | "placing-cue">("idle");

//   const [targetAngle, setTargetAngle] = useState(Math.PI / 2);
//   const [displayAngle, setDisplayAngle] = useState(Math.PI / 2);
//   const [power, setPower] = useState(0);
//   const [displayPower, setDisplayPower] = useState(0);

//   const [syncedState, setSyncedState] = useState({
//     pocketedSolids: [] as Ball[],
//     pocketedStripes: [] as Ball[],
//     pocketedEight: false,
//   });

//   const pullingRef = useRef(false);
//   const pullStartRef = useRef({ x: 0, y: 0 });
//   const lastBallStateRef = useRef("");
//   const animFrameRef = useRef<number>(0);

//   const isMyTurn = gameState.isMyTurn;
//   const cueBall = useMemo(() => balls.find((b) => b.isCue)!, [balls]);

//   useEffect(() => {
//     let raf: number;
//     const smooth = () => {
//       setDisplayAngle((prev) => lerpAngle(prev, targetAngle, 0.25));
//       setDisplayPower((prev) => prev + (power - prev) * 0.3);
//       raf = requestAnimationFrame(smooth);
//     };
//     raf = requestAnimationFrame(smooth);
//     return () => cancelAnimationFrame(raf);
//   }, [targetAngle, power]);

//   useEffect(() => {
//     const updateSize = () => {
//       if (!containerRef.current) return;
//       const rect = containerRef.current.getBoundingClientRect();
//       const tableAspect = (TABLE_W + CUSHION * 1.3) / (TABLE_H + CUSHION * 1.3);
//       const maxH = rect.height - 4;
//       const maxW = rect.width - 4;
//       let h = maxH;
//       let w = h * tableAspect;
//       if (w > maxW) {
//         w = maxW;
//         h = w / tableAspect;
//       }
//       setCanvasSize({ w: Math.floor(w), h: Math.floor(h) });
//       setScale(w / (TABLE_W + CUSHION * 1.3));
//     };
//     updateSize();
//     window.addEventListener("resize", updateSize);
//     return () => window.removeEventListener("resize", updateSize);
//   }, []);

//   useEffect(() => {
//     if (gameState.ballPositions) {
//       const stateKey = JSON.stringify(gameState.ballPositions);
//       if (stateKey !== lastBallStateRef.current) {
//         lastBallStateRef.current = stateKey;
//         setBalls((prev) => applyBallState(prev, gameState.ballPositions!));
//         const allBalls = applyBallState(rackBalls(), gameState.ballPositions);
//         setSyncedState({
//           pocketedSolids: allBalls.filter((b) => b.pocketed && b.solid),
//           pocketedStripes: allBalls.filter((b) => b.pocketed && b.stripe),
//           pocketedEight: allBalls.find((b) => b.isEight)?.pocketed ?? false,
//         });
//       }
//     }
//   }, [gameState.ballPositions]);

//   useEffect(() => {
//     if (gameState.incomingShot && !isMyTurn) {
//       const { angle, power: shotPower } = gameState.incomingShot;
//       setPhase("simulating");
//       setDisplayAngle(angle);
//       setTargetAngle(angle);

//       const result = runPhysicsUntilStopped(balls, angle, shotPower, (progressBalls) => {
//         setBalls(progressBalls.map((b) => ({ ...b })));
//       });

//       setBalls(result.finalBalls);
//       setSyncedState({
//         pocketedSolids: result.finalBalls.filter((b) => b.pocketed && b.solid),
//         pocketedStripes: result.finalBalls.filter((b) => b.pocketed && b.stripe),
//         pocketedEight: result.finalBalls.find((b) => b.isEight)?.pocketed ?? false,
//       });

//       onSubmitAction({
//         type: "shot_result",
//         pocketedIds: result.pocketedIds,
//         cuePocketed: result.cuePocketed,
//         firstHit: result.firstHit,
//         finalPositions: serializeBalls(result.finalBalls),
//       });

//       setTimeout(() => {
//         setPhase(result.cuePocketed ? "placing-cue" : "idle");
//       }, 150);
//     }
//   }, [gameState.incomingShot]);

//   useEffect(() => {
//     if (phase === "simulating") return;
//     if (gameState.foul === "placing-cue" && isMyTurn) {
//       setPhase("placing-cue");
//     } else if (isMyTurn) {
//       setPhase("aiming");
//     } else {
//       setPhase("idle");
//     }
//   }, [gameState.currentTurn, gameState.foul, isMyTurn]);

//   const getTablePos = useCallback(
//     (clientX: number, clientY: number): Vec2 | null => {
//       if (!canvasRef.current) return null;
//       const rect = canvasRef.current.getBoundingClientRect();
//       const padding = CUSHION * scale * 0.65;
//       const x = (clientX - rect.left - padding) / scale;
//       const y = (clientY - rect.top - padding) / scale;
//       if (x < -50 || x > TABLE_W + 50 || y < -50 || y > TABLE_H + 50) return null;
//       return { x, y };
//     },
//     [scale]
//   );

//   const handlePointerDown = useCallback(
//     (e: React.PointerEvent) => {
//       const pos = getTablePos(e.clientX, e.clientY);
//       if (!pos) return;

//       if (phase === "placing-cue" && isMyTurn) {
//         const clampedX = Math.max(BALL_R, Math.min(TABLE_W - BALL_R, pos.x));
//         const clampedY = Math.max(BALL_R, Math.min(TABLE_H * 0.25 - BALL_R, pos.y));
//         const overlapping = balls.some(
//           (b) => !b.isCue && !b.pocketed && dist({ x: clampedX, y: clampedY }, b.pos) < BALL_R * 2.2
//         );
//         if (!overlapping) {
//           setBalls((prev) => prev.map((b) => (b.isCue ? { ...b, pos: { x: clampedX, y: clampedY } } : b)));
//           setPhase("aiming");
//           onSubmitAction({ type: "place_cue", x: clampedX, y: clampedY });
//         }
//         return;
//       }

//       if (phase === "aiming" && isMyTurn) {
//         pullingRef.current = true;
//         pullStartRef.current = { x: e.clientX, y: e.clientY };
//         (e.target as HTMLElement).setPointerCapture(e.pointerId);
//       }
//     },
//     [phase, isMyTurn, getTablePos, balls, onSubmitAction]
//   );

//   const handlePointerMove = useCallback(
//     (e: React.PointerEvent) => {
//       const pos = getTablePos(e.clientX, e.clientY);
//       if (!pos || !isMyTurn) return;

//       if (phase === "aiming" && !pullingRef.current) {
//         const newAngle = Math.atan2(pos.y - cueBall.pos.y, pos.x - cueBall.pos.x);
//         setTargetAngle(newAngle);
//       }

//       if (phase === "aiming" && pullingRef.current) {
//         const dx = pullStartRef.current.x - e.clientX;
//         const dy = pullStartRef.current.y - e.clientY;
//         const pullDist = Math.sqrt(dx * dx + dy * dy);
//         setPower(Math.min(MAX_POWER, pullDist * POWER_SCALE));
//       }
//     },
//     [phase, isMyTurn, getTablePos, cueBall]
//   );

//   const handlePointerUp = useCallback(() => {
//     if (phase === "aiming" && pullingRef.current && isMyTurn) {
//       pullingRef.current = false;

//       if (power > 0.3) {
//         setPhase("simulating");

//         onSubmitAction({
//           type: "shoot",
//           angle: targetAngle,
//           power: power,
//         });

//         const result = runPhysicsUntilStopped(balls, targetAngle, power, (progressBalls) => {
//           setBalls(progressBalls.map((b) => ({ ...b })));
//         });

//         setBalls(result.finalBalls);
//         setSyncedState({
//           pocketedSolids: result.finalBalls.filter((b) => b.pocketed && b.solid),
//           pocketedStripes: result.finalBalls.filter((b) => b.pocketed && b.stripe),
//           pocketedEight: result.finalBalls.find((b) => b.isEight)?.pocketed ?? false,
//         });

//         onSubmitAction({
//           type: "shot_result",
//           pocketedIds: result.pocketedIds,
//           cuePocketed: result.cuePocketed,
//           firstHit: result.firstHit,
//           finalPositions: serializeBalls(result.finalBalls),
//         });

//         setPower(0);
//         setTimeout(() => {
//           setPhase(result.cuePocketed ? "placing-cue" : "idle");
//         }, 200);
//       } else {
//         setPower(0);
//       }
//     }
//   }, [phase, isMyTurn, power, targetAngle, balls, onSubmitAction]);

//   useEffect(() => {
//     const canvas = canvasRef.current;
//     if (!canvas) return;
//     const ctx = canvas.getContext("2d");
//     if (!ctx) return;

//     const render = () => {
//       const dpr = window.devicePixelRatio || 1;
//       canvas.width = canvasSize.w * dpr;
//       canvas.height = canvasSize.h * dpr;
//       ctx.scale(dpr, dpr);
//       ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

//       const padding = CUSHION * scale * 0.65;
//       const s = scale;
//       ctx.save();
//       ctx.translate(padding, padding);

//       drawTable(ctx, s);

//       const sortedBalls = [...balls].sort((a, b) => a.pos.y - b.pos.y);
//       for (const ball of sortedBalls) {
//         drawBall(ctx, ball, s);
//       }

//       if (phase === "aiming" && !cueBall.pocketed && isMyTurn) {
//         drawCue(ctx, cueBall, displayAngle, displayPower, s, pullingRef.current);
//       }

//       if (phase === "aiming" && pullingRef.current && displayPower > 0.1) {
//         const barX = TABLE_W * s + CUSHION * s * 0.15;
//         drawPowerBar(ctx, displayPower, barX, 25 * s, 12 * s, 160 * s, accent);
//       }

//       if (phase === "placing-cue" && isMyTurn) {
//         ctx.save();
//         ctx.setLineDash([3, 3]);
//         ctx.strokeStyle = "rgba(255,255,255,0.2)";
//         ctx.lineWidth = 0.8;
//         ctx.strokeRect(0, 0, TABLE_W * s, TABLE_H * 0.25 * s);
//         ctx.setLineDash([]);
//         ctx.fillStyle = "rgba(255,255,255,0.05)";
//         ctx.fillRect(0, 0, TABLE_W * s, TABLE_H * 0.25 * s);
//         ctx.fillStyle = "rgba(255,255,255,0.5)";
//         ctx.font = `10px ${T.fontBody}`;
//         ctx.textAlign = "center";
//         ctx.fillText("Tap here to place cue ball", TABLE_W / 2 * s, TABLE_H * 0.25 * s + 14);
//         ctx.restore();
//       }

//       if (phase === "idle" && !isMyTurn && !gameOver) {
//         ctx.fillStyle = "rgba(0,0,0,0.35)";
//         ctx.beginPath();
//         ctx.roundRect(TABLE_W * s * 0.12, TABLE_H * s * 0.46, TABLE_W * s * 0.76, 30, 8);
//         ctx.fill();
//         ctx.fillStyle = "rgba(255,255,255,0.6)";
//         ctx.font = `11px ${T.fontBody}`;
//         ctx.textAlign = "center";
//         ctx.textBaseline = "middle";
//         ctx.fillText("⏳ Waiting for opponent...", TABLE_W / 2 * s, TABLE_H * s * 0.46 + 15);
//       }

//       ctx.restore();
//       animFrameRef.current = requestAnimationFrame(render);
//     };

//     animFrameRef.current = requestAnimationFrame(render);
//     return () => cancelAnimationFrame(animFrameRef.current);
//   }, [balls, canvasSize, scale, phase, cueBall, displayAngle, displayPower, isMyTurn, gameOver, accent]);

//   return (
//     <div style={{
//       position: "fixed", inset: 0, background: T.bgDeep,
//       display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden"
//     }}>
//       <div style={{
//         flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
//         padding: "8px 10px", background: T.charcoal, borderBottom: `1px solid ${T.line}`
//       }}>
//         <button onClick={onLeave} style={{
//           ...T.glass(), color: T.chalk, width: 36, height: 36, borderRadius: 10,
//           fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
//           cursor: "pointer", border: "none"
//         }}>‹</button>
//         <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700 }}>🎱 8-Ball</div>
//         <div style={{ width: 36 }} />
//       </div>

//       <div style={{ flexShrink: 0, display: "flex", padding: "6px 10px", gap: 6 }}>
//         {gameState.playerIds.map((pid, idx) => {
//           const isActive = gameState.currentTurn === pid;
//           const assignment = gameState.assignments[idx];
//           return (
//             <div key={pid} style={{
//               flex: 1, padding: "6px 8px", borderRadius: 8,
//               background: isActive ? `${accent}12` : `${T.chalk}04`,
//               border: `1.5px solid ${isActive ? accent : "transparent"}`,
//               transition: "all 0.25s ease",
//             }}>
//               <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
//                 <div style={{
//                   width: 5, height: 5, borderRadius: "50%",
//                   background: isActive ? accent : T.chalkMuted,
//                   boxShadow: isActive ? `0 0 5px ${accent}` : "none",
//                 }} />
//                 <span style={{
//                   fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
//                   color: isActive ? accent : T.chalkMuted,
//                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
//                 }}>
//                   {gameState.playerNames[pid]}
//                 </span>
//                 {assignment && (
//                   <span style={{ fontSize: 9, color: T.chalkMuted, marginLeft: "auto" }}>
//                     {assignment === "solids" ? "●" : "◐"}
//                   </span>
//                 )}
//               </div>
//               <div style={{ display: "flex", gap: 2, marginTop: 3, minHeight: 12, flexWrap: "wrap" }}>
//                 {(assignment === "solids" ? syncedState.pocketedSolids : assignment === "stripes" ? syncedState.pocketedStripes : []).map((b) => (
//                   <div key={b.id} style={{
//                     width: 10, height: 10, borderRadius: "50%", background: b.color,
//                     border: "0.5px solid rgba(255,255,255,0.2)",
//                     display: "flex", alignItems: "center", justifyContent: "center",
//                     fontSize: 5, color: "#333", fontWeight: 700
//                   }}>{b.id}</div>
//                 ))}
//               </div>
//             </div>
//           );
//         })}
//       </div>

//       <div style={{ flexShrink: 0, textAlign: "center", padding: "1px 10px 4px" }}>
//         <span style={{
//           fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600,
//           color: gameState.foul && gameState.foul !== "placing-cue" ? "#ef4444" : gameState.winnerId ? accent : T.chalkMuted
//         }}>
//           {gameState.message}
//         </span>
//       </div>

//       <div ref={containerRef} style={{
//         flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
//         padding: "0 2px", minHeight: 0, minWidth: 0
//       }}>
//         <canvas
//           ref={canvasRef}
//           style={{
//             width: canvasSize.w, height: canvasSize.h,
//             cursor: phase === "placing-cue" ? "crosshair" : phase === "aiming" && isMyTurn ? "none" : "default",
//             touchAction: "none",
//           }}
//           onPointerDown={handlePointerDown}
//           onPointerMove={handlePointerMove}
//           onPointerUp={handlePointerUp}
//           onPointerLeave={() => { if (pullingRef.current) handlePointerUp(); }}
//         />
//       </div>

//       {syncedState.pocketedEight && !gameOver && (
//         <div style={{
//           position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
//           padding: "5px 12px", background: "rgba(0,0,0,0.8)", borderRadius: 6,
//           border: "1px solid #333", display: "flex", alignItems: "center", gap: 5
//         }}>
//           <div style={{
//             width: 14, height: 14, borderRadius: "50%", background: "#111", border: "1px solid #444",
//             display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff", fontWeight: 700
//           }}>8</div>
//           <span style={{ fontSize: 10, color: T.chalkMuted }}>8-ball sunk</span>
//         </div>
//       )}

//       {gameOver && (
//         <div style={{
//           position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)",
//           display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200
//         }}>
//           <div style={{ textAlign: "center", padding: 28 }}>
//             <div style={{ fontSize: 48, marginBottom: 10 }}>{gameOver.winnerId === youId ? "🏆" : "😔"}</div>
//             <div style={{
//               fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800,
//               color: gameOver.winnerId === youId ? T.green : T.red, marginBottom: 6
//             }}>
//               {gameOver.winnerId === youId ? "You Win!" : "You Lose"}
//             </div>
//             <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkDim, marginBottom: 20 }}>{gameState.message}</div>
//             <button onClick={onLeave} style={{ padding: "10px 28px", ...T.btn, ...T.btnPrimary(accent) }}>Back to Lobby</button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

import { useState, useRef, useEffect, useCallback } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
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
  breakShot: boolean;
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
}

type BallPos = { id: number; x: number; y: number; pocketed: boolean };

const TABLE_W = 340;
const TABLE_H = 600;
const CUSHION = 26;
const BALL_R = 9;
const POCKET_R = 16;
const FRICTION = 0.986;
const MIN_VEL = 0.06;
const MAX_POWER = 14;
const CUSHION_LOSS = 0.78;
const BALL_RESTITUTION = 0.96;

const PLAYBACK_TPS = 110;
const PLAYBACK_FAST_TPS = 250;
const CHARGE_GRAB_R = 60;
const PULL_SCALE = 0.1;
const STRIKE_MS = 90;
const WINDUP_MS = 170;

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

function createBall(id: number, pos: Vec2): Ball {
  const info = BALL_COLORS[id] ?? { color: "#888", stripe: false, solid: false };
  return {
    id, pos: { ...pos }, vel: { x: 0, y: 0 }, radius: BALL_R,
    color: info.color, stripe: info.stripe, solid: info.solid,
    isEight: id === 8, isCue: id === 0, pocketed: false,
    label: id === 0 ? "" : String(id),
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
  return POCKETS.some((p) => dist(pos, p) < POCKET_R * 1.7);
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
  const sim = balls.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } }));

  const cue = sim.find((b) => b.isCue);
  if (cue && !cue.pocketed) {
    cue.vel.x = Math.cos(shotAngle) * shotPower;
    cue.vel.y = Math.sin(shotAngle) * shotPower;
  }

  const frames: Ball[][] = [];
  const events: SimEvent[] = [];
  const pocketedIds: number[] = [];
  let firstHit: number | null = null;

  for (let tick = 0; tick < 1000; tick++) {
    const spd = maxBallSpeed(sim);
    if (spd === 0) break;

    // adaptive substeps prevent fast balls tunneling through others
    const substeps = Math.max(1, Math.ceil(spd / (BALL_R * 0.75)));

    for (let ss = 0; ss < substeps; ss++) {
      for (const b of sim) {
        if (b.pocketed) continue;
        b.pos.x += b.vel.x / substeps;
        b.pos.y += b.vel.y / substeps;
      }

      for (const b of sim) {
        if (b.pocketed || isNearPocket(b.pos)) continue;
        let impact = 0;
        let hx = b.pos.x;
        let hy = b.pos.y;
        if (b.pos.x - b.radius < 0) {
          impact = Math.abs(b.vel.x); hx = 0;
          b.pos.x = b.radius; b.vel.x = impact * CUSHION_LOSS;
        } else if (b.pos.x + b.radius > TABLE_W) {
          impact = Math.abs(b.vel.x); hx = TABLE_W;
          b.pos.x = TABLE_W - b.radius; b.vel.x = -impact * CUSHION_LOSS;
        }
        if (b.pos.y - b.radius < 0) {
          const v = Math.abs(b.vel.y);
          if (v > impact) { impact = v; hx = b.pos.x; hy = 0; }
          b.pos.y = b.radius; b.vel.y = v * CUSHION_LOSS;
        } else if (b.pos.y + b.radius > TABLE_H) {
          const v = Math.abs(b.vel.y);
          if (v > impact) { impact = v; hx = b.pos.x; hy = TABLE_H; }
          b.pos.y = TABLE_H - b.radius; b.vel.y = -v * CUSHION_LOSS;
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
        for (const p of POCKETS) {
          if (dist(b.pos, p) < POCKET_R) {
            b.pocketed = true;
            b.vel.x = 0; b.vel.y = 0;
            events.push({ tick, type: "pocket", x: p.x, y: p.y, strength: 1 });
            if (!b.isCue) pocketedIds.push(b.id);
            break;
          }
        }
      }
    }

    for (const b of sim) {
      if (b.pocketed) continue;
      b.vel.x *= FRICTION;
      b.vel.y *= FRICTION;
      if (Math.abs(b.vel.x) < MIN_VEL && Math.abs(b.vel.y) < MIN_VEL) { b.vel.x = 0; b.vel.y = 0; }
    }

    frames.push(sim.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
  }

  if (frames.length === 0) {
    frames.push(sim.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } })));
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
}

interface Fx { x: number; y: number; start: number }

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

// ─── Drawing ─────────────────────────────────────────────────────────

function lightenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, s: number) {
  if (ball.pocketed) return;
  const x = ball.pos.x * s;
  const y = ball.pos.y * s;
  const r = ball.radius * s;

  ctx.beginPath();
  ctx.arc(x + 1.2 * s, y + 1.6 * s, r * 0.95, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();

  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, lightenColor(ball.color, 34));
  g.addColorStop(0.65, ball.color);
  g.addColorStop(1, darkenColor(ball.color, 34));
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();

  if (ball.stripe) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 0.4, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#f6f6f1";
    ctx.fillRect(x - r, y - r * 0.55, r * 2, r * 0.38);
    ctx.fillRect(x - r, y + r * 0.17, r * 2, r * 0.38);
    ctx.restore();
  }

  if (!ball.isCue) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = "#f6f6f1";
    ctx.fill();
    ctx.fillStyle = "#1c1c1c";
    ctx.font = `bold ${Math.max(1, r * 0.55)}px ${T.fontMono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ball.label, x, y + 0.3);
  }

  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.34, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

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
    const pre = ballsRef.current.map((b) => ({ ...b, pos: { ...b.pos }, vel: { ...b.vel } }));
    playbackRef.current = {
      result, own, angle, power,
      startedAt: now, done: false,
      frames: [pre, ...result.frames],
      events: result.events, eventIdx: 0,
      t: 0, lastTime: 0,
      cue: own
        ? { start: now, dur: STRIKE_MS, fromPull: power / MAX_POWER, windup: 0 }
        : { start: now, dur: WINDUP_MS + STRIKE_MS, fromPull: power / MAX_POWER, windup: WINDUP_MS },
    };
  }, []);

  const finishPlayback = useCallback((instant = false) => {
    const pb = playbackRef.current;
    if (!pb || pb.done) return;
    pb.done = true;
    if (instant) {
      for (; pb.eventIdx < pb.events.length; pb.eventIdx++) {
        const ev = pb.events[pb.eventIdx]!;
        if (ev.type === "pocket") fxRef.current.push({ x: ev.x, y: ev.y, start: performance.now() });
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
      if (ev.type === "ball") sfxRef.current!.clack(ev.strength * 0.08);
      else if (ev.type === "cushion") sfxRef.current!.thud(ev.strength * 0.06);
      else {
        sfxRef.current!.pocket();
        vibrate([12, 40, 14]);
        fxRef.current.push({ x: ev.x, y: ev.y, start: now });
      }
    }

    ballsRef.current = pb.frames[Math.max(0, Math.min(pb.frames.length - 1, Math.floor(pb.t)))];
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
      for (const f of fxRef.current) drawPocketFx(ctx, f, now, s);

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

      for (const ball of [...drawBalls].sort((a, b) => a.pos.y - b.pos.y)) {
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
        drawHint(ctx, s, now);
      }

      if (phaseRef.current === "idle" && !gs.isMyTurn && !gameOverRef.current && !playbackRef.current) {
        drawWaiting(ctx, s, now);
      }

      ctx.restore();
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [stepPlayback]);

  // ── UI ────────────────────────────────────────────────────────────

  const myTray = gameState.myAssignment === "solids"
    ? syncedState.pocketedSolids
    : gameState.myAssignment === "stripes"
      ? syncedState.pocketedStripes
      : [];

  return (
    <div style={{
      position: "fixed", inset: 0, background: T.bgDeep,
      display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden"
    }}>
      <style>{`
        @keyframes pool-pop { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pool-fade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{
        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", background: T.charcoal, borderBottom: `1px solid ${T.line}`
      }}>
        <button onClick={onLeave} aria-label="Leave game" style={{
          ...T.glass(), color: T.chalk, width: 36, height: 36, borderRadius: 10,
          fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", border: "none"
        }}>‹</button>

        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #3c3c3c, #0b0b0b)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              width: 9, height: 9, borderRadius: "50%", background: "#f2f2ee", color: "#111",
              fontSize: 6.5, fontWeight: 800, fontFamily: T.fontMono,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>8</div>
          </div>
          <span style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: 0.3 }}>
            {gameName || "8-Ball"}
          </span>
        </div>

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          style={{
            ...T.glass(), color: muted ? T.chalkMuted : T.chalk, width: 36, height: 36, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", border: "none"
          }}
        >
          <SoundIcon off={muted} />
        </button>
      </div>

      <div style={{ flexShrink: 0, display: "flex", padding: "6px 10px", gap: 6 }}>
        {gameState.playerIds.map((pid, idx) => {
          const isActive = gameState.currentTurn === pid;
          const assignment = gameState.assignments[idx];
          const tray = assignment === "solids"
            ? syncedState.pocketedSolids
            : assignment === "stripes"
              ? syncedState.pocketedStripes
              : [];
          return (
            <div key={pid} style={{
              flex: 1, padding: "6px 8px", borderRadius: 8,
              background: isActive ? `${accent}14` : `${T.chalk}05`,
              border: `1.5px solid ${isActive ? accent : "transparent"}`,
              boxShadow: isActive ? `0 0 14px ${accent}22` : "none",
              transition: "all 0.25s ease",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: isActive ? accent : T.chalkMuted,
                  boxShadow: isActive ? `0 0 5px ${accent}` : "none",
                }} />
                <span style={{
                  fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
                  color: isActive ? accent : T.chalkMuted,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {gameState.playerNames[pid]}{pid === youId ? " (you)" : ""}
                </span>
                {assignment && (
                  <span style={{ fontSize: 8.5, color: T.chalkMuted, marginLeft: "auto", letterSpacing: 0.3 }}>
                    {assignment === "solids" ? "SOLIDS" : "STRIPES"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 3, marginTop: 4, minHeight: 13, flexWrap: "wrap" }}>
                {tray.map((b) => (
                  <div key={b.id} style={{
                    width: 13, height: 13, borderRadius: "50%",
                    background: b.stripe
                      ? `linear-gradient(to bottom, #f2f2ee 22%, ${b.color} 22%, ${b.color} 78%, #f2f2ee 78%)`
                      : b.color,
                    border: "0.5px solid rgba(255,255,255,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 6.5, color: "#fff", fontWeight: 700,
                    textShadow: "0 1px 1px rgba(0,0,0,0.6)"
                  }}>{b.id}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ flexShrink: 0, textAlign: "center", padding: "1px 10px 5px", minHeight: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {gameState.breakShot && (
          <span style={{
            fontSize: 8, fontWeight: 800, letterSpacing: 0.8, color: accent,
            border: `1px solid ${accent}55`, borderRadius: 4, padding: "1px 5px"
          }}>BREAK</span>
        )}
        <span style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600,
          color: gameState.foul && gameState.foul !== "placing-cue" ? "#ef4444" : gameState.winnerId ? accent : T.chalkMuted
        }}>
          {gameState.message}
        </span>
      </div>

      <div ref={containerRef} style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "0 2px", minHeight: 0, minWidth: 0
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: canvasSize.w, height: canvasSize.h,
            cursor: phase === "placing-cue" ? "crosshair" : phase === "aiming" && gameState.isMyTurn && !gameOver ? "none" : "default",
            touchAction: "none", userSelect: "none", WebkitUserSelect: "none"
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {syncedState.pocketedEight && !gameOver && (
        <div style={{
          position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
          padding: "6px 14px", background: "rgba(10,10,10,0.85)", borderRadius: 8,
          border: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 7,
          animation: "pool-fade .3s ease"
        }}>
          <div style={{
            width: 15, height: 15, borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #3a3a3a, #0d0d0d)",
            border: "1px solid #3f3f3f", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, color: "#fff", fontWeight: 800
          }}>8</div>
          <span style={{ fontSize: 10, color: T.chalkMuted, letterSpacing: 0.3 }}>8-ball down — awaiting result</span>
        </div>
      )}

      {gameOver && (
        <div style={{
          position: "absolute", inset: 0, background: `${T.bgDeep}E6`, backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          animation: "pool-fade .25s ease"
        }}>
          <div style={{
            textAlign: "center", padding: "30px 36px", background: T.charcoal,
            border: `1px solid ${T.line}`, borderRadius: 16,
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            animation: "pool-pop .4s cubic-bezier(.18,.9,.28,1.2)"
          }}>
            <div style={{
              width: 58, height: 58, borderRadius: "50%", margin: "0 auto 14px",
              background: "radial-gradient(circle at 35% 30%, #3c3c3c, #0b0b0b)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px rgba(0,0,0,0.5)"
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%", background: "#f2f2ee", color: "#111",
                fontSize: 15, fontWeight: 800, fontFamily: T.fontMono,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>8</div>
            </div>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 800, letterSpacing: 0.5,
              color: gameOver.winnerId === youId ? T.green : T.red, marginBottom: 6
            }}>
              {gameOver.winnerId === youId ? "Victory" : "Defeat"}
            </div>
            <div style={{ fontFamily: T.fontMono, fontSize: 11, color: T.chalkDim, marginBottom: 6 }}>
              {gameState.message}
            </div>
            <div style={{ fontSize: 10, color: T.chalkMuted, marginBottom: 20 }}>
              {myTray.length > 0 ? `You sank ${myTray.length} ball${myTray.length === 1 ? "" : "s"}` : "Better luck next time"}
            </div>
            <button onClick={onLeave} style={{
              padding: "11px 30px", ...T.btn, ...T.btnPrimary(accent), fontSize: 13, fontWeight: 700
            }}>
              Back to Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
