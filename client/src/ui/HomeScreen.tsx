import { useState, useCallback, useRef, useMemo } from "react";
import type { GameCatalogEntry } from "../../../shared/types";
import type { Profile, Gender } from "../net/profile";
import { getAvatarForGender, getAvatarsForGender, getAllColors } from "../net/profile";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

const GAME_ICONS: Record<string, string> = {
  chess: "\u265F\uFE0F",
  crazy8: "\uD83C\uDCCF",
  quiz: "\uD83D\uDC95",
  crossword: "\uD83E\uDDE9",
};
const FALLBACK_ICON = "\uD83C\uDFAE";

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "\uD83D\uDC66" },
  { value: "female", label: "Female", icon: "\uD83D\uDC67" },
  { value: "other", label: "Other", icon: "\uD83E\uDDD1" },
  { value: "prefer-not", label: "Rather not say", icon: "\uD83E\uDDCD" },
];

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
}

interface Props {
  games: GameCatalogEntry[];
  initialCode: string;
  busy: boolean;
  profile: Profile;
  onCreate(gameType: string, name: string): void;
  onJoin(code: string, name: string): void;
  onProfileChange(profile: Profile): void;
}

/* ---------- Ambient animated backdrop ---------- */

function Ambient({ accent }: { accent: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          width: "120%",
          height: "120%",
          top: "-30%",
          left: "-10%",
          background: `radial-gradient(ellipse 50% 40% at 50% 0%, ${accent}08 0%, transparent 100%)`,
          animation: "ma-drift-a 20s ease-in-out infinite alternate",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          bottom: 0,
          background:
            "radial-gradient(ellipse 80% 50% at 50% 100%, rgba(139,92,246,0.04) 0%, transparent 100%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage:
            "radial-gradient(ellipse 100% 80% at 50% 0%, black 0%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 100% 80% at 50% 0%, black 0%, transparent 70%)",
        }}
      />
    </div>
  );
}

/* ---------- Small parts ---------- */

function Spinner({
  size = 16,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}25`,
        borderTopColor: color,
        display: "inline-block",
        animation: "ma-spin 0.6s linear infinite",
      }}
    />
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: "6px 10px",
        background: `${T.chalk}06`,
        borderRadius: 8,
        border: `1px solid ${T.line}`,
        fontFamily: T.fontMono,
        fontSize: 11,
        color: T.chalkMuted,
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        letterSpacing: "0.02em",
      }}
    >
      {children}
    </span>
  );
}

/* ---------- Main component ---------- */

export function HomeScreen({
  games,
  initialCode,
  busy,
  profile,
  onCreate,
  onJoin,
  onProfileChange,
}: Props) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [code, setCode] = useState(initialCode);
  const [editingProfile, setEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState<Profile>(profile);
  const [avatarIdx, setAvatarIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const prefersReduced = useMemo(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    [],
  );

  const canCreate = !busy && gameId !== "" && profile.name.trim().length > 0;
  const canJoin =
    !busy && code.trim().length >= 4 && profile.name.trim().length > 0;
  const selectedGame = games.find((g) => g.id === gameId);

  const selectGame = (id: string) => {
    if (id === gameId) return;
    setGameId(id);
    vibrate(8);
    if (!prefersReduced) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cardRefs.current
            .get(id)
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
    }
  };

  const handleTilt = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (prefersReduced) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(800px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
    },
    [prefersReduced],
  );

  const resetTilt = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "";
  }, []);

  const openProfile = () => {
    setTempProfile(profile);
    setAvatarIdx(0);
    setEditingProfile(true);
    vibrate(8);
  };

  const saveProfile = () => {
    const name = tempProfile.name.trim();
    if (name.length === 0) return;
    onProfileChange({ ...tempProfile, name });
    setEditingProfile(false);
    vibrate(12);
  };

  const updateGender = (gender: Gender) => {
    setAvatarIdx(0);
    setTempProfile({
      ...tempProfile,
      gender,
      avatar: getAvatarForGender(gender),
    });
  };

  const cycleAvatar = () => {
    const avatars = getAvatarsForGender(tempProfile.gender);
    if (avatars.length <= 1) return;
    const next = (avatarIdx + 1) % avatars.length;
    setAvatarIdx(next);
    setTempProfile({ ...tempProfile, avatar: avatars[next]! });
    vibrate(6);
  };

  const handleCodeKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canJoin) onJoin(code.trim(), profile.name);
  };

  const css = `
@keyframes ma-drift-a { from { transform: translate(0, 0) } to { transform: translate(40px, 20px) } }
@keyframes ma-spin { to { transform: rotate(360deg) } }
@keyframes ma-in { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
@keyframes ma-expand { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
@keyframes ma-pop { 0% { transform: scale(0); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes ma-pulse { 0%, 100% { box-shadow: 0 0 0 0 ${profile.color}00 } 50% { box-shadow: 0 0 0 8px ${profile.color}10 } }
@keyframes ma-float { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
.ma-press { transition: transform 0.15s ease, filter 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease; }
.ma-press:active { transform: scale(0.96) !important; filter: brightness(1.1); }
.ma-in { animation: ma-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both; }
.ma-expand { animation: ma-expand 0.25s ease-out both; }
.ma-pop { animation: ma-pop 0.3s cubic-bezier(0.34, 1.5, 0.64, 1) both; }
.ma-float { animation: ma-float 3s ease-in-out infinite; }
.ma-avatar-btn { animation: ma-pulse 3s ease-in-out infinite; }
.ma-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.ma-scroll::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .ma-in, .ma-expand, .ma-pop, .ma-float, .ma-avatar-btn, .ma-press { animation: none !important; }
  [style*="ma-drift"] { animation: none !important; }
}
`;

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
        color: T.chalk,
        overflow: "hidden",
        background: T.bg,
        position: "relative",
      }}
    >
      <style>{css}</style>
      <Ambient accent={profile.color} />

      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "20px 20px 0",
          position: "relative",
          zIndex: 1,
        }}
        className="ma-in"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 24,
                fontWeight: 800,
                margin: 0,
                color: T.chalk,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Molly<span style={{ color: profile.color }}>Arcade</span>
            </h1>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4ade80",
                  boxShadow: "0 0 8px #4ade8080",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: T.chalkMuted,
                  fontFamily: T.fontBody,
                }}
              >
                {profile.name} • Online
              </span>
            </div>
          </div>
          <button
            onClick={openProfile}
            className="ma-press ma-avatar-btn"
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              background: `${profile.color}12`,
              border: `1.5px solid ${profile.color}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              cursor: "pointer",
              position: "relative",
              flexShrink: 0,
            }}
            aria-label={`Edit profile (${profile.name})`}
          >
            {profile.avatar}
            <span
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: profile.color,
                border: `2px solid ${T.bg}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.bg}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* Main scrollable content */}
      <div
        ref={scrollRef}
        className="ma-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "24px 20px 16px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Games section */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: T.fontDisplay,
                fontSize: 11,
                fontWeight: 700,
                color: T.chalkMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              Games
            </h2>
            <div style={{ flex: 1, height: 1, background: T.line }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {games.map((g, idx) => {
              const selected = g.id === gameId;
              const icon = GAME_ICONS[g.id] ?? FALLBACK_ICON;
              return (
                <button
                  key={g.id}
                  ref={(el) => {
                    if (el) cardRefs.current.set(g.id, el);
                    else cardRefs.current.delete(g.id);
                  }}
                  onClick={() => selectGame(g.id)}
                  onPointerMove={!selected ? handleTilt : undefined}
                  onPointerLeave={!selected ? resetTilt : undefined}
                  className="ma-press ma-in"
                  style={{
                    width: "100%",
                    padding: 0,
                    borderRadius: 16,
                    border: `1.5px solid ${selected ? profile.color : T.line}`,
                    background: selected
                      ? `linear-gradient(135deg, ${profile.color}10 0%, ${T.charcoal} 100%)`
                      : T.charcoal,
                    cursor: "pointer",
                    textAlign: "left",
                    animationDelay: `${0.05 * idx}s`,
                    overflow: "hidden",
                    boxShadow: selected
                      ? `0 8px 32px ${profile.color}20, 0 2px 8px rgba(0,0,0,0.2)`
                      : "0 2px 8px rgba(0,0,0,0.15)",
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: selected ? "16px 18px 12px" : "16px 18px",
                      transition: "padding 0.2s ease",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: selected
                          ? `${profile.color}15`
                          : `${T.chalk}06`,
                        border: selected
                          ? `1px solid ${profile.color}20`
                          : `1px solid ${T.line}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 28,
                        flexShrink: 0,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: T.fontDisplay,
                          fontSize: selected ? 18 : 16,
                          fontWeight: 700,
                          color: selected ? profile.color : T.chalk,
                          transition: "color 0.2s ease",
                          marginBottom: 2,
                        }}
                      >
                        {g.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: T.chalkMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.3,
                        }}
                      >
                        {g.tagline}
                      </div>
                    </div>
                    {selected ? (
                      <span
                        className="ma-pop"
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: profile.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check color={T.bg} />
                      </span>
                    ) : (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.chalkMuted}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ flexShrink: 0, opacity: 0.4 }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateRows: selected ? "1fr" : "0fr",
                      transition:
                        "grid-template-rows 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <div
                        className="ma-expand"
                        style={{ padding: "0 18px 16px" }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                            marginBottom: 12,
                          }}
                        >
                          <MetaChip>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            {g.minPlayers}-{g.maxPlayers}
                          </MetaChip>
                          <MetaChip>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            {g.estimatedMinutes}m
                          </MetaChip>
                          <MetaChip>
                            {g.mode === "realtime"
                              ? "⚡ Realtime"
                              : "⏱ Turn-based"}
                          </MetaChip>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "10px 12px",
                            background: `${profile.color}08`,
                            borderRadius: 10,
                            border: `1px solid ${profile.color}15`,
                          }}
                        >
                          <Check color={profile.color} />
                          <span
                            style={{
                              fontFamily: T.fontDisplay,
                              fontSize: 12,
                              fontWeight: 600,
                              color: profile.color,
                              letterSpacing: "0.02em",
                            }}
                          >
                            Selected — tap Create
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "16px 20px",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
          background: `linear-gradient(to top, ${T.bg} 60%, transparent)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            background: T.charcoal,
            borderRadius: 20,
            border: `1.5px solid ${T.line}`,
            padding: 16,
            boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
          }}
        >
          {/* Join row */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                background: T.bg,
                border: `1.5px solid ${code.trim().length >= 4 ? `${profile.color}40` : T.line}`,
                borderRadius: 12,
                transition: "border-color 0.2s ease",
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.chalkMuted}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, opacity: 0.5 }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="text"
                value={code}
                maxLength={8}
                placeholder="ROOM CODE"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""),
                  )
                }
                onKeyDown={handleCodeKey}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "13px 0",
                  background: "transparent",
                  border: "none",
                  color: T.chalk,
                  fontSize: 15,
                  outline: "none",
                  fontFamily: T.fontMono,
                  letterSpacing: "0.15em",
                  fontWeight: 600,
                }}
                aria-label="Room code"
              />
              {code.length > 0 && (
                <button
                  onClick={() => {
                    setCode("");
                    vibrate(6);
                  }}
                  className="ma-press"
                  style={{
                    background: "none",
                    border: "none",
                    color: T.chalkMuted,
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 4,
                    display: "flex",
                    opacity: 0.6,
                    flexShrink: 0,
                  }}
                  aria-label="Clear code"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
            <button
              disabled={!canJoin}
              onClick={() => {
                vibrate(10);
                onJoin(code.trim(), profile.name);
              }}
              className="ma-press"
              style={{
                flexShrink: 0,
                minWidth: 80,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "0 20px",
                background: canJoin ? profile.color : T.chalkMuted,
                color: canJoin ? T.bg : T.charcoal,
                border: "none",
                borderRadius: 12,
                cursor: canJoin ? "pointer" : "default",
                fontSize: 14,
                fontWeight: 700,
                opacity: canJoin ? 1 : 0.35,
                whiteSpace: "nowrap",
                transition: "opacity 0.2s ease, background 0.2s ease",
              }}
            >
              {busy ? <Spinner size={14} color={T.bg} /> : null}
              Join
            </button>
          </div>

          {/* Create */}
          <button
            disabled={!canCreate}
            onClick={() => {
              vibrate(12);
              onCreate(gameId, profile.name);
            }}
            className="ma-press"
            style={{
              width: "100%",
              padding: "14px",
              ...T.btn,
              ...(canCreate
                ? {
                    background: `${profile.color}12`,
                    color: profile.color,
                    border: `1.5px solid ${profile.color}30`,
                  }
                : {
                    background: T.bg,
                    color: T.chalkMuted,
                    border: `1.5px solid ${T.line}`,
                  }),
              cursor: canCreate ? "pointer" : "default",
              fontSize: 14,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              letterSpacing: "0.01em",
            }}
          >
            {busy ? (
              <Spinner size={14} color={profile.color} />
            ) : (
              <span style={{ fontSize: 16, lineHeight: 1 }}>
                {GAME_ICONS[gameId] ?? FALLBACK_ICON}
              </span>
            )}
            {busy ? "Creating..." : `Create ${selectedGame?.name ?? ""} Room`}
          </button>
        </div>
      </div>

      {/* Profile editor drawer */}
      <BottomDrawer
        open={editingProfile}
        onClose={() => setEditingProfile(false)}
        title="Edit Profile"
      >
        <div style={{ padding: "0 4px" }}>
          {/* Avatar preview */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 28,
              gap: 10,
            }}
          >
            <button
              onClick={cycleAvatar}
              className="ma-press ma-float"
              style={{
                width: 80,
                height: 80,
                borderRadius: 24,
                background: `${tempProfile.color}08`,
                border: `2px solid ${tempProfile.color}25`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                cursor: "pointer",
                boxShadow: `0 0 40px ${tempProfile.color}15`,
              }}
              aria-label="Change avatar"
            >
              {tempProfile.avatar}
            </button>
            <span
              style={{
                fontFamily: T.fontMono,
                fontSize: 10,
                color: T.chalkMuted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Tap to change
            </span>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontFamily: T.fontDisplay,
                fontSize: 10,
                fontWeight: 700,
                color: T.chalkMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Name
            </label>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 14px",
                background: T.bg,
                border: `1.5px solid ${tempProfile.name.trim() ? `${tempProfile.color}35` : T.line}`,
                borderRadius: 12,
                transition: "border-color 0.2s ease",
              }}
            >
              <input
                type="text"
                value={tempProfile.name}
                onChange={(e) =>
                  setTempProfile({ ...tempProfile, name: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tempProfile.name.trim())
                    saveProfile();
                }}
                placeholder="Your name"
                maxLength={16}
                style={{
                  flex: 1,
                  padding: "13px 0",
                  background: "transparent",
                  border: "none",
                  color: T.chalk,
                  fontSize: 15,
                  outline: "none",
                  fontFamily: T.fontBody,
                }}
                autoFocus
              />
              <span
                style={{
                  fontFamily: T.fontMono,
                  fontSize: 10,
                  color:
                    tempProfile.name.length >= 16 ? T.yellow : T.chalkMuted,
                  flexShrink: 0,
                  opacity: 0.6,
                }}
              >
                {tempProfile.name.length}/16
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "block",
                fontFamily: T.fontDisplay,
                fontSize: 10,
                fontWeight: 700,
                color: T.chalkMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Gender
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {GENDER_OPTIONS.map((opt) => {
                const active = tempProfile.gender === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => updateGender(opt.value)}
                    className="ma-press"
                    style={{
                      padding: "12px 8px",
                      borderRadius: 12,
                      border: `1.5px solid ${active ? tempProfile.color : T.line}`,
                      background: active ? `${tempProfile.color}10` : T.bg,
                      color: active ? tempProfile.color : T.chalkDim,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{opt.icon}</span>
                    <span
                      style={{
                        fontFamily: T.fontDisplay,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 28 }}>
            <label
              style={{
                display: "block",
                fontFamily: T.fontDisplay,
                fontSize: 10,
                fontWeight: 700,
                color: T.chalkMuted,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              Accent Color
            </label>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              {getAllColors().map((c) => {
                const active = tempProfile.color === c;
                return (
                  <button
                    key={c}
                    onClick={() => {
                      setTempProfile({ ...tempProfile, color: c });
                      vibrate(6);
                    }}
                    className="ma-press"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: c,
                      border: `2px solid ${active ? T.chalk : "transparent"}`,
                      cursor: "pointer",
                      transform: active ? "scale(1.1)" : "scale(1)",
                      boxShadow: active ? `0 0 20px ${c}60` : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                    }}
                    aria-label={`Color ${c}`}
                  >
                    {active && (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.chalk}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setEditingProfile(false)}
              className="ma-press"
              style={{
                flex: 1,
                padding: "13px",
                ...T.btn,
                ...T.btnSecondary,
              }}
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={!tempProfile.name.trim()}
              className="ma-press"
              style={{
                flex: 1,
                padding: "13px",
                ...T.btn,
                ...(tempProfile.name.trim()
                  ? T.btnPrimary(tempProfile.color)
                  : {
                      background: T.bg,
                      color: T.chalkMuted,
                      border: `1.5px solid ${T.line}`,
                    }),
                cursor: tempProfile.name.trim() ? "pointer" : "default",
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomDrawer>
    </div>
  );
}
