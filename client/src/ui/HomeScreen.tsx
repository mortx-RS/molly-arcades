import { useState, useCallback } from "react";
import type { GameCatalogEntry } from "../../../shared/types";
import type { Profile, Gender } from "../net/profile";
import { getAvatarForGender, getAllColors } from "../net/profile";
import { T } from "./theme";
import { BottomDrawer } from "./BottomDrawer";

const GAME_ICONS: Record<string, string> = {
  chess: "♟️",
  crazy8: "🃏",
  quiz: "💕",
  crossword: "🧩"
};

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "👦" },
  { value: "female", label: "Female", icon: "👧" },
  { value: "other", label: "Other", icon: "🧑" },
  { value: "prefer-not", label: "Prefer not to say", icon: "🧍" }
];

interface Props {
  games: GameCatalogEntry[];
  initialCode: string;
  busy: boolean;
  profile: Profile;
  onCreate(gameType: string, name: string): void;
  onJoin(code: string, name: string): void;
  onProfileChange(profile: Profile): void;
}

export function HomeScreen({ games, initialCode, busy, profile, onCreate, onJoin, onProfileChange }: Props) {
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [code, setCode] = useState(initialCode);
  const [editingProfile, setEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState<Profile>(profile);

  const canCreate = !busy && gameId !== "" && profile.name.trim().length > 0;
  const canJoin = !busy && code.trim().length >= 4 && profile.name.trim().length > 0;

  const handleTilt = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-2px)`;
  }, []);

  const resetTilt = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "";
  }, []);

  const saveProfile = () => {
    const name = tempProfile.name.trim();
    if (name.length === 0) return;
    onProfileChange({ ...tempProfile, name });
    setEditingProfile(false);
  };

  const updateGender = (gender: Gender) => {
    setTempProfile({ ...tempProfile, gender, avatar: getAvatarForGender(gender) });
  };

  const selectedGame = games.find((g) => g.id === gameId);

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", fontFamily: T.fontBody, color: T.chalk, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ flexShrink: 0, padding: "24px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontFamily: T.fontDisplay, fontSize: 26, fontWeight: 800, margin: 0, color: T.chalk }}>
              Molly<span style={{ color: profile.color }}>Arcade</span>
            </h1>
            <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.chalkMuted, margin: "4px 0 0" }}>
              Play with friends
            </p>
          </div>
          <button
            onClick={() => { setTempProfile(profile); setEditingProfile(true); }}
            style={{ width: 44, height: 44, borderRadius: 14, background: `${profile.color}15`, border: `1.5px solid ${profile.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, cursor: "pointer" }}
            aria-label="Edit profile"
          >
            {profile.avatar}
          </button>
        </div>
      </div>

      {/* Main scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 16px" }}>


        {/* Games section */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 600, color: T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 14px" }}>
            Choose a game
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {games.map((g, idx) => {
              const selected = g.id === gameId;
              const icon = GAME_ICONS[g.id] ?? "🎮";
              return (
                <button
                  key={g.id}
                  onClick={() => setGameId(g.id)}
                  onPointerMove={!selected ? handleTilt : undefined}
                  onPointerLeave={!selected ? resetTilt : undefined}
                  style={{
                    width: "100%",
                    padding: 0,
                    borderRadius: 18,
                    border: `1px solid ${selected ? profile.color : T.lineStrong}`,
                    background: selected ? `linear-gradient(145deg, ${profile.color}12 0%, ${T.charcoal} 100%)` : T.charcoal,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.25s ease",
                    animation: "fadeSlideUp 0.4s ease both",
                    animationDelay: `${0.05 * idx}s`,
                    overflow: "hidden",
                    boxShadow: selected ? `0 4px 20px ${profile.color}30, 0 2px 8px rgba(0,0,0,0.3)` : "0 2px 8px rgba(0,0,0,0.2)"
                  }}
                >
                  {/* Collapsed */}
                  {!selected && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px" }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
                        {icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 700, color: T.chalk }}>{g.name}</span>
                        <p style={{ fontFamily: T.fontBody, fontSize: 13, color: T.chalkDim, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {g.tagline}
                        </p>
                      </div>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: T.chalkMuted, flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  )}

                  {/* Expanded */}
                  {selected && (
                    <div style={{ padding: "20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 16, background: `${profile.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0, border: `1px solid ${profile.color}25` }}>
                          {icon}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 700, color: profile.color }}>{g.name}</span>
                          </div>
                          <p style={{ fontFamily: T.fontBody, fontSize: 14, color: T.chalkDim, margin: "4px 0 0" }}>
                            {g.tagline}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ padding: "8px 12px", background: T.surface, borderRadius: 10, border: `1px solid ${T.line}` }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.chalkDim }}>{g.minPlayers}–{g.maxPlayers} players</span>
                        </span>
                        <span style={{ padding: "8px 12px", background: T.surface, borderRadius: 10, border: `1px solid ${T.line}` }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.chalkDim }}>~{g.estimatedMinutes} min</span>
                        </span>
                        <span style={{ padding: "8px 12px", background: T.surface, borderRadius: 10, border: `1px solid ${T.line}` }}>
                          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.chalkDim }}>{g.mode === "realtime" ? "Realtime" : "Turn-based"}</span>
                        </span>
                      </div>

                      <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", background: `${profile.color}10`, borderRadius: 12, border: `1px solid ${profile.color}20` }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: profile.color }}>
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span style={{ fontFamily: T.fontDisplay, fontSize: 13, fontWeight: 600, color: profile.color }}>Selected</span>
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div style={{ flexShrink: 0, padding: "20px 16px", paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))", borderTop: `1px solid ${T.lineStrong}`, background: `linear-gradient(to top, ${T.bg} 60%, transparent)` }}>
        {/* Join */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <input
            type="text"
            value={code}
            maxLength={8}
            placeholder="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ flex: 1, padding: "16px", background: T.charcoal, border: `1px solid ${T.lineStrong}`, borderRadius: 14, color: T.chalk, fontSize: 16, outline: "none", fontFamily: T.fontMono, letterSpacing: "0.15em", fontWeight: 600, boxSizing: "border-box" }}
            aria-label="Room code"
          />
          <button
            disabled={!canJoin}
            onClick={() => onJoin(code.trim(), profile.name)}
            style={{
              padding: "12px 24px",
              ...T.btn,
              ...T.btnPrimary(profile.color),
              cursor: canJoin ? "pointer" : "default",
              fontSize: 15,
              fontWeight: 700,
              opacity: canJoin ? 1 : 0.4,
              whiteSpace: "nowrap"
            }}
          >
            Join
          </button>
        </div>

        {/* Create */}
        <button
          disabled={!canCreate}
          onClick={() => onCreate(gameId, profile.name)}
          style={{
            width: "100%",
            padding: "16px",
            ...T.btn,
            ...(canCreate ? { background: T.surface, color: T.chalk, border: `1px solid ${T.lineStrong}` } : { background: T.surface, color: T.chalkMuted, border: `1px solid ${T.line}` }),
            cursor: canCreate ? "pointer" : "default",
            fontSize: 15,
            fontWeight: 600
          }}
        >
          {busy ? "Creating…" : `Create ${selectedGame?.name ?? ""} Room`}
        </button>
      </div>

      {/* Profile editor bottom drawer */}
      <BottomDrawer open={editingProfile} onClose={() => setEditingProfile(false)} title="Edit Profile">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: 20, background: `${tempProfile.color}10`, border: `1.5px solid ${tempProfile.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, boxShadow: `0 0 24px ${tempProfile.color}40` }}>
            {tempProfile.avatar}
          </div>
        </div>

        <label style={{ display: "block", fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600, color: T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Name</label>
        <input
          type="text"
          value={tempProfile.name}
          onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })}
          placeholder="Your name"
          maxLength={16}
          style={{ width: "100%", padding: "14px 16px", background: T.charcoal, border: `1px solid ${T.lineStrong}`, borderRadius: T.btn.borderRadius, color: T.chalk, fontSize: 16, outline: "none", boxSizing: "border-box", fontFamily: T.fontBody, marginBottom: 24 }}
          autoFocus
        />

        <label style={{ display: "block", fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600, color: T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Gender</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
          {GENDER_OPTIONS.map((opt) => {
            const active = tempProfile.gender === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => updateGender(opt.value)}
                style={{
                  padding: "12px 8px",
                  borderRadius: T.btn.borderRadius,
                  border: `1px solid ${active ? tempProfile.color : T.lineStrong}`,
                  background: active ? `${tempProfile.color}15` : T.charcoal,
                  color: active ? tempProfile.color : T.chalkDim,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  transition: "all 0.15s ease"
                }}
              >
                <span style={{ fontSize: 22 }}>{opt.icon}</span>
                <span style={{ fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600 }}>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <label style={{ display: "block", fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 600, color: T.chalkMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Accent color</label>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 28 }}>
          {getAllColors().map((c) => (
            <button
              key={c}
              onClick={() => setTempProfile({ ...tempProfile, color: c })}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: c,
                border: `2px solid ${tempProfile.color === c ? T.chalk : "transparent"}`,
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                transform: tempProfile.color === c ? "scale(1.2)" : "scale(1)",
                boxShadow: tempProfile.color === c ? `0 0 16px ${c}80` : "none"
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setEditingProfile(false)} style={{ flex: 1, padding: "14px", ...T.btn, ...T.btnSecondary }}>Cancel</button>
          <button
            onClick={saveProfile}
            disabled={!tempProfile.name.trim()}
            style={{
              flex: 1,
              padding: "14px",
              ...T.btn,
              ...(tempProfile.name.trim() ? T.btnPrimary : { background: T.surface, color: T.chalkMuted }),
              cursor: tempProfile.name.trim() ? "pointer" : "default"
            }}
          >
            Save
          </button>
        </div>
      </BottomDrawer>
    </div>
  );
}
