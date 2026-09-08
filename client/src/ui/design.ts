/* ═══════════════════════════════════════════════════════════
   MOLLY ARCADE — Design System (v2 · Clean Minimal / Light)
   ───────────────────────────────────────────────────────────
   Self-contained light theme used by the app "shell" (Home +
   Lobby) and the shared primitives in ./components.tsx.

   NOTE: The legacy dark theme in ./theme.ts (`T`) is still used
   by the 9 fullscreen game screens and is intentionally left
   untouched until those screens are revamped.
   ═══════════════════════════════════════════════════════════ */

/** Convert a #rrggbb hex + 0..1 alpha into an rgba() string. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const D = {
  /* ── Surfaces (light, layered) ── */
  canvas: "#f5f6f8", // app background
  canvasDim: "#eef0f3", // subtle sunken areas
  surface: "#ffffff", // cards, sheets
  surfaceAlt: "#f4f5f7", // inputs, subtle fills
  surfaceSunken: "#eceef2", // pressed / track backgrounds

  /* ── Ink (text) ── */
  ink: "#15171c", // primary text
  inkSoft: "#5a6072", // secondary text
  inkFaint: "#9a9fad", // tertiary / placeholder
  inkOnBrand: "#ffffff", // text on brand fill

  /* ── Brand (fixed accent) ── */
  brand: "#4f46e5", // indigo — primary actions
  brandHover: "#4338ca",
  brandSoft: "#ecebfb", // tinted background
  brandSofter: "#f5f4fe",

  /* ── Semantic ── */
  success: "#12a150",
  successSoft: "#e6f6ec",
  danger: "#e5484d",
  dangerSoft: "#fdecec",
  warn: "#c2710c",
  warnSoft: "#fbf0df",

  /* ── Lines / borders (opacity-based) ── */
  line: "rgba(21, 23, 28, 0.08)",
  lineStrong: "rgba(21, 23, 28, 0.14)",
  lineHeavy: "rgba(21, 23, 28, 0.24)",

  /* ── Shadows (soft, minimal) ── */
  shadowXs: "0 1px 2px rgba(16, 24, 40, 0.06)",
  shadowSm: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)",
  shadowMd:
    "0 4px 8px -2px rgba(16, 24, 40, 0.10), 0 2px 4px -2px rgba(16, 24, 40, 0.06)",
  shadowLg:
    "0 12px 24px -6px rgba(16, 24, 40, 0.12), 0 4px 8px -4px rgba(16, 24, 40, 0.08)",
  shadowSheet: "0 -12px 48px rgba(16, 24, 40, 0.18)",

  /* ── Radii ── */
  rSm: 10,
  rMd: 14,
  rLg: 18,
  rXl: 24,
  rPill: 999,

  /* ── Typography ── */
  fontDisplay:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, 'SF Mono', monospace",

  /* ── Spacing (4px scale, raw px) ── */
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
} as const;

/* Convenience: shorthand for the accent-tint helper most components need. */
export const tint = alpha;
