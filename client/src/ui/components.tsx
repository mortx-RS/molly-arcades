/* ═══════════════════════════════════════════════════════════
   MOLLY ARCADE — Shared UI Primitives (v2 · Clean Minimal)
   Buttons, inputs, cards, avatars, pills, bottom sheet, icons.
   Built on the light design tokens in ./design.ts.
   ═══════════════════════════════════════════════════════════ */
import React, { useEffect, useRef } from "react";
import { D, alpha } from "./design";

/* ─────────────────────────  Global styles  ───────────────────────── */

const SHELL_CSS = `
@keyframes ma2-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes ma2-pop { 0% { opacity: 0; transform: scale(0.8) } 100% { opacity: 1; transform: scale(1) } }
@keyframes ma2-spin { to { transform: rotate(360deg) } }
@keyframes ma2-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
@keyframes ma2-sheet-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
@keyframes ma2-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes ma2-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.55 } }

.ma2-press { transition: transform .16s ease, background .16s ease, border-color .16s ease, box-shadow .16s ease, color .16s ease, opacity .16s ease; }
.ma2-press:active:not(:disabled) { transform: scale(0.97); }
.ma2-in { animation: ma2-in .45s cubic-bezier(.22,1,.36,1) both; }
.ma2-pop { animation: ma2-pop .3s cubic-bezier(.34,1.56,.64,1) both; }
.ma2-float { animation: ma2-float 3.4s ease-in-out infinite; }
.ma2-spin { animation: ma2-spin .7s linear infinite; }
.ma2-pulse { animation: ma2-pulse 1.6s ease-in-out infinite; }
.ma2-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.ma2-scroll::-webkit-scrollbar { display: none; }
.ma2-d1 { animation-delay: .05s } .ma2-d2 { animation-delay: .1s } .ma2-d3 { animation-delay: .16s } .ma2-d4 { animation-delay: .22s } .ma2-d5 { animation-delay: .28s }

@media (prefers-reduced-motion: reduce) {
  .ma2-in, .ma2-pop, .ma2-float, .ma2-spin, .ma2-pulse { animation: none !important; }
  .ma2-press:active:not(:disabled) { transform: none; }
}
`;

/** Inject the shell keyframes/classes once. Render near the root of a screen. */
export function ShellStyles() {
  return <style>{SHELL_CSS}</style>;
}

/* ─────────────────────────  Haptics  ───────────────────────── */

export function haptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
}

/* ─────────────────────────  Icons  ───────────────────────── */

const ICON_PATHS: Record<string, React.ReactNode> = {
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  back: <polyline points="15 18 9 12 15 6" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  loader: (
    <>
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </>
  ),
  edit: (
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  ),
  crown: (
    <path d="M2 7l5 5 5-8 5 8 5-5-2 13H4L2 7z" />
  ),
  gamepad: (
    <>
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      <rect x="2" y="6" width="20" height="12" rx="6" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 2,
  fill = "none",
  className,
  style,
}: {
  name: keyof typeof ICON_PATHS | string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

/* ─────────────────────────  Spinner  ───────────────────────── */

export function Spinner({
  size = 16,
  color = D.brand,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      className="ma2-spin"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${alpha(color, 0.22)}`,
        borderTopColor: color,
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

/* ─────────────────────────  Screen  ───────────────────────── */

export function Screen({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: D.canvas,
        color: D.ink,
        fontFamily: D.fontBody,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      <ShellStyles />
      {children}
    </div>
  );
}

/* ─────────────────────────  Button  ───────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md" | "lg";

const BTN_SIZE: Record<ButtonSize, React.CSSProperties> = {
  sm: { minHeight: 38, padding: "0 14px", fontSize: 13, borderRadius: D.rSm },
  md: { minHeight: 46, padding: "0 18px", fontSize: 14.5, borderRadius: D.rMd },
  lg: { minHeight: 54, padding: "0 22px", fontSize: 16, borderRadius: D.rMd },
};

function variantStyle(v: ButtonVariant): React.CSSProperties {
  switch (v) {
    case "primary":
      return { background: D.brand, color: D.inkOnBrand, boxShadow: D.shadowSm };
    case "secondary":
      return {
        background: D.surface,
        color: D.ink,
        border: `1px solid ${D.lineStrong}`,
        boxShadow: D.shadowXs,
      };
    case "ghost":
      return { background: "transparent", color: D.inkSoft };
    case "danger":
      return { background: D.danger, color: "#fff", boxShadow: D.shadowSm };
    case "success":
      return { background: D.success, color: "#fff", boxShadow: D.shadowSm };
  }
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  block = true,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  accent,
  onClick,
  type = "button",
  style,
  ariaLabel,
}: {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Override the fill colour (used for accent-personalised primary actions). */
  accent?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const base = variantStyle(variant);
  const isDisabled = disabled || loading;
  const accented =
    accent && variant === "primary"
      ? { background: accent, boxShadow: `0 6px 20px ${alpha(accent, 0.28)}` }
      : {};
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      className="ma2-press"
      style={{
        width: block ? "100%" : "auto",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        fontFamily: D.fontBody,
        fontWeight: 650,
        letterSpacing: "0.01em",
        cursor: isDisabled ? "default" : "pointer",
        border: "none",
        opacity: isDisabled ? 0.45 : 1,
        whiteSpace: "nowrap",
        ...BTN_SIZE[size],
        ...base,
        ...accented,
        ...style,
      }}
    >
      {loading ? (
        <Spinner
          size={size === "lg" ? 18 : 15}
          color={variant === "secondary" || variant === "ghost" ? D.brand : "#fff"}
        />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

/* ─────────────────────────  IconButton  ───────────────────────── */

export function IconButton({
  children,
  onClick,
  ariaLabel,
  size = 44,
  variant = "secondary",
  color,
  style,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
  size?: number;
  variant?: "secondary" | "ghost" | "soft";
  color?: string;
  style?: React.CSSProperties;
}) {
  const variants: Record<string, React.CSSProperties> = {
    secondary: {
      background: D.surface,
      border: `1px solid ${D.lineStrong}`,
      color: color ?? D.ink,
      boxShadow: D.shadowXs,
    },
    ghost: { background: "transparent", color: color ?? D.inkSoft },
    soft: {
      background: color ? alpha(color, 0.1) : D.brandSoft,
      border: `1px solid ${color ? alpha(color, 0.22) : D.line}`,
      color: color ?? D.brand,
    },
  };
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="ma2-press"
      style={{
        width: size,
        height: size,
        borderRadius: D.rMd,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────  Card  ───────────────────────── */

export function Card({
  children,
  style,
  className,
  padding = D.s5,
  onClick,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  padding?: number | string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: D.surface,
        border: `1px solid ${D.line}`,
        borderRadius: D.rLg,
        boxShadow: D.shadowSm,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────  Label  ───────────────────────── */

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: D.inkFaint,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────  TextField  ───────────────────────── */

export function TextField({
  value,
  onChange,
  placeholder,
  leadingIcon,
  mono = false,
  maxLength,
  showCount = false,
  onClear,
  onEnter,
  autoFocus = false,
  ariaLabel,
  focusColor = D.brand,
  active,
  autoCapitalize,
  spellCheck,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  leadingIcon?: React.ReactNode;
  mono?: boolean;
  maxLength?: number;
  showCount?: boolean;
  onClear?: () => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  ariaLabel?: string;
  focusColor?: string;
  /** Force the "active" (focused-looking) border, e.g. when value is valid. */
  active?: boolean;
  autoCapitalize?: string;
  spellCheck?: boolean;
}) {
  const isActive = active ?? value.trim().length > 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        background: D.surfaceAlt,
        border: `1.5px solid ${isActive ? alpha(focusColor, 0.5) : D.line}`,
        borderRadius: D.rMd,
        transition: "border-color .2s ease",
      }}
    >
      {leadingIcon && (
        <span style={{ flexShrink: 0, color: D.inkFaint, display: "flex" }}>
          {leadingIcon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize={autoCapitalize}
        spellCheck={spellCheck}
        aria-label={ariaLabel}
        style={{
          flex: 1,
          minWidth: 0,
          padding: "14px 0",
          background: "transparent",
          border: "none",
          outline: "none",
          color: D.ink,
          fontSize: 15,
          fontFamily: mono ? D.fontMono : D.fontBody,
          fontWeight: mono ? 600 : 500,
          letterSpacing: mono ? "0.14em" : "normal",
        }}
      />
      {showCount && maxLength ? (
        <span
          style={{
            fontFamily: D.fontMono,
            fontSize: 10,
            color: value.length >= maxLength ? D.warn : D.inkFaint,
            flexShrink: 0,
          }}
        >
          {value.length}/{maxLength}
        </span>
      ) : null}
      {onClear && value.length > 0 ? (
        <button
          onClick={onClear}
          aria-label="Clear"
          className="ma2-press"
          style={{
            background: "none",
            border: "none",
            color: D.inkFaint,
            cursor: "pointer",
            display: "flex",
            padding: 2,
            flexShrink: 0,
          }}
        >
          <Icon name="close" size={13} strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}

/* ─────────────────────────  Avatar  ───────────────────────── */

export function Avatar({
  content,
  size = 44,
  bg,
  ring,
  color,
  dim = false,
  badge,
  float = false,
  className,
  style,
}: {
  content: React.ReactNode;
  size?: number;
  bg?: string;
  ring?: string;
  color?: string;
  dim?: boolean;
  badge?: React.ReactNode;
  float?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={[float ? "ma2-float" : "", className ?? ""].join(" ").trim()}
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: size >= 60 ? D.rXl : D.rMd,
        background: bg ?? D.surfaceAlt,
        border: ring ? `2px solid ${ring}` : `1px solid ${D.line}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.44,
        fontWeight: 700,
        fontFamily: D.fontDisplay,
        color: color ?? D.ink,
        flexShrink: 0,
        opacity: dim ? 0.55 : 1,
        ...style,
      }}
    >
      {content}
      {badge}
    </div>
  );
}

/* ─────────────────────────  Pill / Badge  ───────────────────────── */

type PillTone = "neutral" | "brand" | "success" | "warn" | "danger" | "accent";

export function Pill({
  children,
  tone = "neutral",
  accent,
  mono = false,
  style,
}: {
  children: React.ReactNode;
  tone?: PillTone;
  accent?: string;
  mono?: boolean;
  style?: React.CSSProperties;
}) {
  const tones: Record<PillTone, React.CSSProperties> = {
    neutral: { background: D.surfaceAlt, color: D.inkSoft, border: `1px solid ${D.line}` },
    brand: { background: D.brandSoft, color: D.brand, border: `1px solid ${alpha(D.brand, 0.2)}` },
    success: { background: D.successSoft, color: D.success, border: `1px solid ${alpha(D.success, 0.22)}` },
    warn: { background: D.warnSoft, color: D.warn, border: `1px solid ${alpha(D.warn, 0.22)}` },
    danger: { background: D.dangerSoft, color: D.danger, border: `1px solid ${alpha(D.danger, 0.22)}` },
    accent: accent
      ? { background: alpha(accent, 0.12), color: accent, border: `1px solid ${alpha(accent, 0.28)}` }
      : { background: D.brandSoft, color: D.brand, border: `1px solid ${alpha(D.brand, 0.2)}` },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: D.rPill,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: mono ? "0.04em" : "0.01em",
        fontFamily: mono ? D.fontMono : D.fontBody,
        whiteSpace: "nowrap",
        ...tones[tone],
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────  Divider  ───────────────────────── */

export function Divider({ label }: { label?: string }) {
  if (!label) return <div style={{ height: 1, background: D.line, width: "100%" }} />;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, height: 1, background: D.line }} />
      <span
        style={{
          fontSize: 11,
          color: D.inkFaint,
          fontFamily: D.fontMono,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: D.line }} />
    </div>
  );
}

/* ─────────────────────────  Bottom Sheet  ───────────────────────── */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(21, 23, 28, 0.32)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 200,
        animation: "ma2-fade .2s ease",
      }}
    >
      <ShellStyles />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          maxHeight: "88dvh",
          background: D.surface,
          borderTopLeftRadius: D.rXl,
          borderTopRightRadius: D.rXl,
          boxShadow: D.shadowSheet,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "ma2-sheet-up .34s cubic-bezier(.16,1,.3,1)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0", flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: D.lineStrong }} />
        </div>
        {title && (
          <div style={{ padding: "14px 24px 4px", flexShrink: 0 }}>
            <h2
              style={{
                fontFamily: D.fontDisplay,
                fontSize: 18,
                fontWeight: 750,
                margin: 0,
                textAlign: "center",
                letterSpacing: "-0.01em",
                color: D.ink,
              }}
            >
              {title}
            </h2>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px 24px" }} className="ma2-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
