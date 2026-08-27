export const T = {
  bg: "#08080f",
  bgDeep: "#04040a",
  charcoal: "#0e0e18",
  concrete: "#141420",
  surface: "#1a1a2a",

  chalk: "#eeeef4",
  chalkDim: "#8888a0",
  chalkMuted: "#505068",

  neon: "#00d4ff",
  neonDim: "rgba(0, 212, 255, 0.08)",
  neonGlow: "rgba(0, 212, 255, 0.30)",
  neonStrong: "rgba(0, 212, 255, 0.50)",

  green: "#00e87b",
  greenDim: "rgba(0, 232, 123, 0.08)",
  greenGlow: "rgba(0, 232, 123, 0.30)",

  pink: "#e8005c",
  pinkDim: "rgba(232, 0, 92, 0.08)",
  pinkGlow: "rgba(232, 0, 92, 0.30)",

  violet: "#8855ee",
  violetDim: "rgba(136, 85, 238, 0.10)",
  violetGlow: "rgba(136, 85, 238, 0.30)",

  orange: "#ee6600",
  orangeDim: "rgba(238, 102, 0, 0.10)",

  yellow: "#ddc830",
  yellowDim: "rgba(221, 200, 48, 0.08)",

  red: "#ee3355",
  redDim: "rgba(238, 51, 85, 0.08)",

  line: "rgba(136, 136, 160, 0.08)",
  lineStrong: "rgba(136, 136, 160, 0.14)",
  lineAccent: "rgba(0, 212, 255, 0.20)",

  fontDisplay: "'Outfit', 'Inter', -apple-system, sans-serif",
  fontBody: "'Inter', 'Space Grotesk', -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', monospace",

  radius: 12,
  radiusLg: 16,
  radiusXl: 20,

  glass: (bg = "rgba(8, 8, 15, 0.80)") => ({
    background: bg,
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    border: "1px solid rgba(136, 136, 160, 0.10)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.2), 0 4px 16px rgba(0,0,0,0.15)"
  }),

  glassHover: (bg = "rgba(8, 8, 15, 0.90)") => ({
    background: bg,
    backdropFilter: "blur(32px)",
    WebkitBackdropFilter: "blur(32px)",
    border: "1px solid rgba(136, 136, 160, 0.16)",
    boxShadow: "0 2px 4px rgba(0,0,0,0.25), 0 8px 32px rgba(0,0,0,0.2)"
  }),

  overlayBg: "rgba(4, 4, 10, 0.88)",

  btn: {
    borderRadius: 10,
    fontFamily: "'Inter', 'Space Grotesk', -apple-system, sans-serif",
    fontSize: 13,
    fontWeight: 600 as const,
    letterSpacing: "0.01em",
    textTransform: "none" as const,
    border: "none",
    cursor: "pointer" as const,
    transition: "all 0.15s ease"
  },

  btnPrimary: (accent?: string) => ({
    background: accent || "#00d4ff",
    color: "#04040a",
    boxShadow: `0 1px 2px rgba(0,0,0,0.3), 0 0 20px ${accent || "#00d4ff"}25`
  }),

  btnSecondary: {
    background: "rgba(136, 136, 160, 0.08)",
    color: "#eeeef4",
    border: "1px solid rgba(136, 136, 160, 0.12)"
  },

  btnDanger: {
    background: "#e8005c",
    color: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.3)"
  },

  btnSuccess: {
    background: "#00e87b",
    color: "#04040a"
  }
} as const;
