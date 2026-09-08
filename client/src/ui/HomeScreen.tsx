import { useState } from "react";
import type { Profile, Gender } from "../net/profile";
import { getAvatarForGender, getAvatarsForGender, getAllColors } from "../net/profile";
import { D, alpha } from "./design";
import {
  Screen,
  Button,
  TextField,
  Sheet,
  Avatar,
  Icon,
  FieldLabel,
  Divider,
  haptic,
} from "./components";

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: "male", label: "Male", icon: "\uD83D\uDC66" },
  { value: "female", label: "Female", icon: "\uD83D\uDC67" },
  { value: "other", label: "Other", icon: "\uD83E\uDDD1" },
  { value: "prefer-not", label: "Rather not say", icon: "\uD83E\uDDCD" },
];

interface Props {
  initialCode: string;
  busy: boolean;
  profile: Profile;
  onCreate(name: string): void;
  onJoin(code: string, name: string): void;
  onProfileChange(profile: Profile): void;
}

export function HomeScreen({
  initialCode,
  busy,
  profile,
  onCreate,
  onJoin,
  onProfileChange,
}: Props) {
  const [code, setCode] = useState(initialCode);
  const [editingProfile, setEditingProfile] = useState(false);
  const [tempProfile, setTempProfile] = useState<Profile>(profile);
  const [avatarIdx, setAvatarIdx] = useState(0);

  const accent = profile.color;
  const canCreate = !busy && profile.name.trim().length > 0;
  const canJoin = !busy && code.trim().length >= 4 && profile.name.trim().length > 0;

  const openProfile = () => {
    setTempProfile(profile);
    setAvatarIdx(0);
    setEditingProfile(true);
    haptic(8);
  };

  const saveProfile = () => {
    const name = tempProfile.name.trim();
    if (name.length === 0) return;
    onProfileChange({ ...tempProfile, name });
    setEditingProfile(false);
    haptic(12);
  };

  const updateGender = (gender: Gender) => {
    setAvatarIdx(0);
    setTempProfile({ ...tempProfile, gender, avatar: getAvatarForGender(gender) });
  };

  const cycleAvatar = () => {
    const avatars = getAvatarsForGender(tempProfile.gender);
    if (avatars.length <= 1) return;
    const next = (avatarIdx + 1) % avatars.length;
    setAvatarIdx(next);
    setTempProfile({ ...tempProfile, avatar: avatars[next]! });
    haptic(6);
  };

  return (
    <Screen>
      {/* Soft ambient wash */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(120% 60% at 50% -10%, ${alpha(accent, 0.12)} 0%, transparent 60%)`,
        }}
      />

      {/* Header */}
      <header
        className="ma2-in"
        style={{
          flexShrink: 0,
          padding: "20px 20px 0",
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: D.fontDisplay,
              fontSize: 23,
              fontWeight: 800,
              margin: 0,
              letterSpacing: "-0.03em",
              color: D.ink,
              lineHeight: 1.1,
            }}
          >
            Molly<span style={{ color: accent }}>Arcade</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6 }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: D.success,
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: D.inkSoft }}>
              {profile.name || "Guest"} · Online
            </span>
          </div>
        </div>

        <button
          onClick={openProfile}
          className="ma2-press"
          aria-label={`Edit profile (${profile.name})`}
          style={{
            position: "relative",
            width: 48,
            height: 48,
            borderRadius: D.rMd,
            background: alpha(accent, 0.12),
            border: `1.5px solid ${alpha(accent, 0.3)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {profile.avatar}
          <span
            style={{
              position: "absolute",
              bottom: -3,
              right: -3,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: accent,
              border: `2px solid ${D.canvas}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
            }}
          >
            <Icon name="edit" size={9} strokeWidth={3} />
          </span>
        </button>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "24px 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Hero */}
        <div className="ma2-in ma2-d1" style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: D.fontMono,
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: D.inkFaint,
              marginBottom: 10,
            }}
          >
            Multiplayer · Play together
          </div>
          <h2
            style={{
              fontFamily: D.fontDisplay,
              fontSize: 34,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              margin: 0,
              color: D.ink,
            }}
          >
            Game night,
            <br />
            anywhere.
          </h2>
          <p style={{ margin: "12px 0 0", fontSize: 14.5, color: D.inkSoft, lineHeight: 1.5 }}>
            Spin up a room, share the code, and play in seconds.
          </p>
        </div>

        {/* Create */}
        <div className="ma2-in ma2-d2">
          <Button
            size="lg"
            disabled={!canCreate}
            loading={busy}
            leftIcon={<Icon name="plus" size={19} strokeWidth={2.5} />}
            onClick={() => {
              haptic(12);
              onCreate(profile.name);
            }}
          >
            {busy ? "Creating room…" : "Create a room"}
          </Button>
        </div>

        {/* Divider */}
        <div className="ma2-in ma2-d3" style={{ margin: "22px 0" }}>
          <Divider label="or join" />
        </div>

        {/* Join */}
        <div className="ma2-in ma2-d4" style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TextField
              value={code}
              onChange={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              placeholder="ROOM CODE"
              mono
              maxLength={8}
              leadingIcon={<Icon name="lock" size={15} strokeWidth={2} />}
              onClear={() => {
                setCode("");
                haptic(6);
              }}
              onEnter={() => canJoin && onJoin(code.trim(), profile.name)}
              autoCapitalize="characters"
              spellCheck={false}
              active={code.trim().length >= 4}
              ariaLabel="Room code"
            />
          </div>
          <Button
            block={false}
            disabled={!canJoin}
            onClick={() => {
              haptic(10);
              onJoin(code.trim(), profile.name);
            }}
            style={{ minWidth: 88 }}
          >
            Join
          </Button>
        </div>
      </main>

      {/* Footer hint */}
      <footer
        className="ma2-in ma2-d5"
        style={{
          flexShrink: 0,
          textAlign: "center",
          padding: "0 20px calc(18px + env(safe-area-inset-bottom, 0px))",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: 12, color: D.inkFaint }}>
          Tap your avatar to set a name & color
        </span>
      </footer>

      {/* Profile editor */}
      <Sheet open={editingProfile} onClose={() => setEditingProfile(false)} title="Your profile">
        {/* Avatar preview */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginBottom: 26,
          }}
        >
          <button
            onClick={cycleAvatar}
            className="ma2-press"
            aria-label="Change avatar"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <Avatar
              content={tempProfile.avatar}
              size={84}
              float
              bg={alpha(tempProfile.color, 0.12)}
              ring={alpha(tempProfile.color, 0.35)}
              style={{ boxShadow: `0 10px 30px ${alpha(tempProfile.color, 0.2)}` }}
            />
          </button>
          <span
            style={{
              fontFamily: D.fontMono,
              fontSize: 10,
              color: D.inkFaint,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {getAvatarsForGender(tempProfile.gender).length > 1 ? "Tap to change" : "Your avatar"}
          </span>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Name</FieldLabel>
          <TextField
            value={tempProfile.name}
            onChange={(v) => setTempProfile({ ...tempProfile, name: v })}
            placeholder="Your name"
            maxLength={16}
            showCount
            focusColor={tempProfile.color}
            onEnter={saveProfile}
            autoFocus
            ariaLabel="Your name"
          />
        </div>

        {/* Gender */}
        <div style={{ marginBottom: 20 }}>
          <FieldLabel>Avatar style</FieldLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {GENDER_OPTIONS.map((opt) => {
              const active = tempProfile.gender === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => updateGender(opt.value)}
                  className="ma2-press"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 8px",
                    borderRadius: D.rMd,
                    border: `1.5px solid ${active ? tempProfile.color : D.line}`,
                    background: active ? alpha(tempProfile.color, 0.1) : D.surfaceAlt,
                    color: active ? tempProfile.color : D.inkSoft,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Accent */}
        <div style={{ marginBottom: 26 }}>
          <FieldLabel>Accent color</FieldLabel>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {getAllColors().map((c) => {
              const active = tempProfile.color === c;
              return (
                <button
                  key={c}
                  onClick={() => {
                    setTempProfile({ ...tempProfile, color: c });
                    haptic(6);
                  }}
                  className="ma2-press"
                  aria-label={`Color ${c}`}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: D.rMd,
                    background: c,
                    border: `2px solid ${active ? D.ink : "transparent"}`,
                    cursor: "pointer",
                    transform: active ? "scale(1.08)" : "scale(1)",
                    boxShadow: active ? `0 6px 16px ${alpha(c, 0.45)}` : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform .2s ease, box-shadow .2s ease",
                  }}
                >
                  {active && <Icon name="check" size={13} color="#fff" strokeWidth={3.5} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" onClick={() => setEditingProfile(false)}>
            Cancel
          </Button>
          <Button
            accent={tempProfile.color}
            disabled={!tempProfile.name.trim()}
            onClick={saveProfile}
          >
            Save
          </Button>
        </div>
      </Sheet>
    </Screen>
  );
}
