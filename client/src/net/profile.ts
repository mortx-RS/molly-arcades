export type Gender = "male" | "female" | "other" | "prefer-not";

export interface Profile {
  name: string;
  gender: Gender;
  avatar: string;
  color: string;
  soundEnabled: boolean;
}

const KEY = "molly.profile.v1";

const AVATARS: Record<Gender, string> = {
  male: "\uD83D\uDC66",
  female: "\uD83D\uDC67",
  other: "\uD83E\uDDD1",
  "prefer-not": "\uD83E\uDDCD"
};

const COLORS = [
  "#4ade80",
  "#a78bfa",
  "#ff5a1f",
  "#f4d93e",
  "#f87171",
  "#60a5fa",
  "#2dd4bf",
  "#fb923c"
];

export function getDefaultProfile(): Profile {
  return {
    name: "",
    gender: "prefer-not",
    avatar: AVATARS["prefer-not"],
    color: COLORS[0]!,
    soundEnabled: true
  };
}

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return getDefaultProfile();
    const p = JSON.parse(raw) as Partial<Profile>;
    return {
      name: typeof p.name === "string" ? p.name : "",
      gender: isValidGender(p.gender) ? p.gender! : "prefer-not",
      avatar: typeof p.avatar === "string" ? p.avatar : AVATARS[p.gender as Gender] ?? AVATARS["prefer-not"],
      color: typeof p.color === "string" ? p.color : COLORS[0]!,
      soundEnabled: typeof p.soundEnabled === "boolean" ? p.soundEnabled : true
    };
  } catch {
    return getDefaultProfile();
  }
}

export function saveProfile(p: Profile): void {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function getAvatarForGender(gender: Gender): string {
  return AVATARS[gender];
}

export function getAllColors(): readonly string[] {
  return COLORS;
}

function isValidGender(v: unknown): v is Gender {
  return v === "male" || v === "female" || v === "other" || v === "prefer-not";
}
