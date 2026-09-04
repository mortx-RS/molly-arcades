import { useEffect, useState, useCallback } from "react";
import { GAME_CATALOG } from "../../shared/types";
import { useRoom } from "./net/useRoom";
import { loadProfile, saveProfile } from "./net/profile";
import type { Profile } from "./net/profile";
import { HomeScreen } from "./ui/HomeScreen";
import { RoomScreen } from "./ui/RoomScreen";

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
        {api.notice && (
          <div className="banner error notice" role="alert">
            {api.notice}
            <button aria-label="Dismiss" onClick={api.dismissNotice}>
              ×
            </button>
          </div>
        )}
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
      {api.notice && (
        <div className="banner error notice" role="alert">
          {api.notice}
          <button aria-label="Dismiss" onClick={api.dismissNotice}>
            ×
          </button>
        </div>
      )}
    </main>
  );
}
