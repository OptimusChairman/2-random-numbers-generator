import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  LEGACY_SOUND_KEY,
  SETTINGS_KEY,
  THEMES,
  loadSettings,
  nextTheme,
  saveSettings,
} from "./settings";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe("loadSettings", () => {
  it("returns defaults when nothing is saved", () => {
    expect(loadSettings(fakeStorage())).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when storage is unavailable", () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips saved settings", () => {
    const storage = fakeStorage();
    const settings = { sound: true, haptics: false, motion: true, artwork: false, theme: "ember" as const };
    saveSettings(settings, storage);
    expect(loadSettings(storage)).toEqual(settings);
  });

  it("ignores invalid fields but keeps valid ones", () => {
    const storage = fakeStorage({
      [SETTINGS_KEY]: JSON.stringify({ sound: "yes", haptics: false, motion: 1, theme: "neon" }),
    });
    expect(loadSettings(storage)).toEqual({ ...DEFAULT_SETTINGS, haptics: false });
  });

  it("keeps artwork on unless it was switched off", () => {
    expect(loadSettings(fakeStorage()).artwork).toBe(true);
    expect(loadSettings(fakeStorage({ [SETTINGS_KEY]: JSON.stringify({ artwork: false }) })).artwork).toBe(false);
    expect(loadSettings(fakeStorage({ [SETTINGS_KEY]: JSON.stringify({ artwork: "no" }) })).artwork).toBe(true);
  });

  it("survives corrupted JSON", () => {
    expect(loadSettings(fakeStorage({ [SETTINGS_KEY]: "{nope" }))).toEqual(DEFAULT_SETTINGS);
  });

  it("carries over the old sound preference on first run", () => {
    expect(loadSettings(fakeStorage({ [LEGACY_SOUND_KEY]: "on" })).sound).toBe(true);
    expect(loadSettings(fakeStorage({ [LEGACY_SOUND_KEY]: "off" })).sound).toBe(false);
  });

  it("prefers the new settings over the old sound key", () => {
    const storage = fakeStorage({
      [LEGACY_SOUND_KEY]: "on",
      [SETTINGS_KEY]: JSON.stringify({ sound: false }),
    });
    expect(loadSettings(storage).sound).toBe(false);
  });
});

describe("nextTheme", () => {
  it("cycles through every theme and wraps around", () => {
    let theme = THEMES[0];
    const seen: string[] = [theme];
    for (let i = 0; i < THEMES.length; i += 1) {
      theme = nextTheme(theme);
      seen.push(theme);
    }
    expect(new Set(seen).size).toBe(THEMES.length);
    expect(seen[seen.length - 1]).toBe(THEMES[0]);
  });
});
