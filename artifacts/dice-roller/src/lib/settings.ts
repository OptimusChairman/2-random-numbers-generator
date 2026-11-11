// Player settings: sound, haptics, motion (shake + tilt), artwork, and color theme.
// Stored in one localStorage entry; every read is validated.

export const THEMES = ["silver", "ember", "emerald"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  silver: "Silver",
  ember: "Ember",
  emerald: "Emerald",
};

export type Settings = {
  sound: boolean;
  haptics: boolean;
  /** Shake the phone to generate, and tilt it to shift the starfield. */
  motion: boolean;
  /** Show the character artwork behind the app. Off saves data and keeps the page plain. */
  artwork: boolean;
  theme: Theme;
};

export const SETTINGS_KEY = "two-number-generator-settings";
/** Sound used to live in its own key before the settings row existed. */
export const LEGACY_SOUND_KEY = "two-number-generator-sound";

export const DEFAULT_SETTINGS: Settings = {
  sound: false,
  haptics: true,
  motion: false,
  artwork: true,
  theme: "silver",
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

export function loadSettings(storage: StorageLike | null = defaultStorage()): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  if (!storage) return settings;

  try {
    const raw = storage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
      if (typeof parsed.sound === "boolean") settings.sound = parsed.sound;
      if (typeof parsed.haptics === "boolean") settings.haptics = parsed.haptics;
      if (typeof parsed.motion === "boolean") settings.motion = parsed.motion;
      if (typeof parsed.artwork === "boolean") settings.artwork = parsed.artwork;
      if (isTheme(parsed.theme)) settings.theme = parsed.theme;
      return settings;
    }
    // First run on this version: carry over the old sound preference.
    if (storage.getItem(LEGACY_SOUND_KEY) === "on") settings.sound = true;
  } catch {
    // Corrupt or blocked storage: fall back to defaults.
  }
  return settings;
}

export function saveSettings(settings: Settings, storage: StorageLike | null = defaultStorage()) {
  try {
    storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Settings simply will not persist.
  }
}
