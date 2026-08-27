const WORDS = [
  "FOX", "OWL", "ELK", "RAM", "HAWK", "LYNX", "WOLF", "BEAR",
  "DEER", "MINK", "GOOSE", "CRAB", "TOAD", "NEWT", "SEAL", "CROW"
];

export function generateRoomCode(taken: Set<string>): string {
  for (let i = 0; i < 10_000; i++) {
    const word = WORDS[Math.floor(Math.random() * WORDS.length)] ?? "FOX";
    const num = 100 + Math.floor(Math.random() * 900);
    const code = `${word}-${num}`;
    if (!taken.has(code)) return code;
  }
  return `RM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

export function normalizeRoomCode(raw: string): string {
  const up = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const m = /^([A-Z]+)(\d{3})$/.exec(up);
  return m ? `${m[1]}-${m[2]}` : up;
}
