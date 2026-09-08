import { useEffect, useState, useCallback } from "react";
import { GAME_CATALOG } from "../../shared/types";
import { useRoom } from "./net/useRoom";
import { loadProfile, saveProfile } from "./net/profile";
import type { Profile } from "./net/profile";
import { HomeScreen } from "./ui/HomeScreen";
import { RoomScreen } from "./ui/RoomScreen";
import { D, alpha } from "./ui/design";
import { Icon } from "./ui/components";

function Notice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        zIndex: 300,
        width: "calc(100% - 32px)",
        maxWidth: 420,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        background: D.surface,
        border: `1px solid ${alpha(D.danger, 0.3)}`,
        borderRadius: D.rMd,
        boxShadow: D.shadowLg,
        color: D.ink,
        fontSize: 13.5,
        fontFamily: D.fontBody,
      }}
    >
      <span style={{ color: D.danger, display: "flex", flexShrink: 0 }}>
        <Icon name="alert" size={18} />
      </span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        aria-label="Dismiss"
        onClick={onDismiss}
        style={{ background: "none", border: "none", color: D.inkFaint, cursor: "pointer", display: "flex", flexShrink: 0, padding: 2 }}
      >
        <Icon name="close" size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function App() {
  const api = useRoom();
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [initialCode] = useState(() => {
    const code = (new URLSearchParams(location.search).get("room") ?? "").toUpperCase();
    if (code) history.replaceState(null, "", location.pathname);
    return code;
  });

  useEffect(() => {
    if (!api.notice) return;
    const t = setTimeout(api.dismissNotice, 6000);
    return () => clearTimeout(t);
  }, [api.notice, api.dismissNotice]);

  const handleProfileChange = useCallback((p: Profile) => {
    setProfile(p);
    saveProfile(p);
  }, []);

  async function handleCreate(name: string) {
    setBusy(true);
    await api.createRoom(name || profile.name);
    setBusy(false);
  }

  async function handleJoin(code: string, name: string) {
    setBusy(true);
    await api.joinRoom(code, name || profile.name);
    setBusy(false);
  }

  if (api.session) {
    return (
      <main className="app">
        <RoomScreen
          room={api.room}
          youId={api.you}
          gameState={api.gameState}
          gameOver={api.gameOver}
          roundComplete={api.roundComplete}
          sessionOver={api.sessionOver}
          status={api.status}
          games={GAME_CATALOG}
          profile={profile}
          onLeave={api.leaveRoom}
          onSelectGame={api.selectGame}
          onStartGame={api.startGame}
          onSubmitAction={api.submitAction}
          onSubmitInput={api.submitInput}
          onFinishRound={api.finishRound}
          onRematch={api.rematch}
          onNewGame={api.newGame}
          onClearRoundComplete={api.clearRoundComplete}
          onClearSessionOver={api.clearSessionOver}
        />
        {api.notice && <Notice message={api.notice} onDismiss={api.dismissNotice} />}
      </main>
    );
  }

  return (
    <main className="app">
      <HomeScreen
        initialCode={initialCode}
        busy={busy}
        profile={profile}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onProfileChange={handleProfileChange}
      />
      {api.notice && <Notice message={api.notice} onDismiss={api.dismissNotice} />}
    </main>
  );
}
