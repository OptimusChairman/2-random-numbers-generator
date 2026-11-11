import { THEME_LABELS, type Settings } from "../../lib/settings";

type Props = {
  settings: Settings;
  canVibrate: boolean;
  canMotion: boolean;
  canInstall: boolean;
  status: string;
  onToggle: (key: "sound" | "haptics" | "motion") => void;
  onCycleTheme: () => void;
  onInstall: () => void;
  onTestHaptics: () => void;
};

/** Compact row of toggles. Chips only appear when the device can actually do the thing. */
export function SettingsRow({ settings, canVibrate, canMotion, canInstall, status, onToggle, onCycleTheme, onInstall, onTestHaptics }: Props) {
  return (
    <div className="settings-row" role="group" aria-label="Settings">
      <button type="button" className={`chip ${settings.sound ? "is-on" : ""}`} aria-pressed={settings.sound} onClick={() => onToggle("sound")} data-testid="button-sound">
        <span className="sound-bars" aria-hidden="true"><i /><i /><i /></span>
        Sound
      </button>
      {canVibrate && (
        <button type="button" className={`chip ${settings.haptics ? "is-on" : ""}`} aria-pressed={settings.haptics} onClick={() => onToggle("haptics")} data-testid="button-haptics">
          <span className="chip-dot" aria-hidden="true" />
          Haptics
        </button>
      )}
      {canVibrate && settings.haptics && (
        <button type="button" className="chip" onClick={onTestHaptics} data-testid="button-test-haptics">
          Test buzz
        </button>
      )}
      {canMotion && (
        <button type="button" className={`chip ${settings.motion ? "is-on" : ""}`} aria-pressed={settings.motion} onClick={() => onToggle("motion")} aria-label="Motion: shake to generate and tilt the stars" data-testid="button-motion">
          <span className="chip-dot" aria-hidden="true" />
          Shake
        </button>
      )}
      <button type="button" className="chip chip-theme" onClick={onCycleTheme} aria-label={`Color theme: ${THEME_LABELS[settings.theme]}. Tap to change.`} data-testid="button-theme">
        <span className={`theme-swatch theme-swatch-${settings.theme}`} aria-hidden="true" />
        {THEME_LABELS[settings.theme]}
      </button>
      {canInstall && (
        <button type="button" className="chip" onClick={onInstall} data-testid="button-install">
          Install app
        </button>
      )}
      <p className="settings-status" role="status" aria-live="polite">{status}</p>
    </div>
  );
}
