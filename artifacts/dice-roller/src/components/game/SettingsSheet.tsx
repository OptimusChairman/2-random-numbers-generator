import { useRef } from "react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { THEME_LABELS, type Settings } from "../../lib/settings";

type Props = {
  settings: Settings;
  canVibrate: boolean;
  canMotion: boolean;
  canInstall: boolean;
  status: string;
  onToggle: (key: "sound" | "haptics" | "motion" | "artwork") => void;
  onCycleTheme: () => void;
  onInstall: () => void;
  onTestHaptics: () => void;
  onClose: () => void;
};

function Row({
  id,
  label,
  hint,
  on,
  onClick,
  testId,
  extra,
}: {
  id: string;
  label: string;
  hint: string;
  on: boolean;
  onClick: () => void;
  testId: string;
  extra?: React.ReactNode;
}) {
  return (
    <li className="sheet-row">
      <div className="sheet-copy">
        <span id={`${id}-label`}>{label}</span>
        <small>{hint}</small>
        {extra}
      </div>
      <button
        type="button"
        className={`switch ${on ? "is-on" : ""}`}
        aria-pressed={on}
        aria-labelledby={`${id}-label`}
        onClick={onClick}
        data-testid={testId}
      >
        <span className="switch-thumb" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Preferences in a sheet: slides up from the bottom on phones, sits in the middle on larger
 * screens. Rows only appear when the device can actually do the thing.
 */
export function SettingsSheet({
  settings,
  canVibrate,
  canMotion,
  canInstall,
  status,
  onToggle,
  onCycleTheme,
  onInstall,
  onTestHaptics,
  onClose,
}: Props) {
  const sheetRef = useRef<HTMLElement>(null);
  useDialogFocus(sheetRef, true);

  return (
    <div
      className="modal-backdrop sheet-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="settings-sheet"
        id="settings-sheet"
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-heading">
          <h2 id="settings-title">Settings</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close settings" data-testid="button-close-settings">
            <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
              <path d="M2 2l10 10M12 2 2 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <ul className="sheet-list">
          <li className="sheet-row">
            <div className="sheet-copy">
              <span id="theme-label">Colour</span>
              <small>Changes the whole look</small>
            </div>
            <button
              type="button"
              className="theme-button"
              onClick={onCycleTheme}
              aria-label={`Color theme: ${THEME_LABELS[settings.theme]}. Tap to change.`}
              data-testid="button-theme"
            >
              <span className={`theme-swatch theme-swatch-${settings.theme}`} aria-hidden="true" />
              {THEME_LABELS[settings.theme]}
            </button>
          </li>
          <Row
            id="artwork"
            label="Artwork"
            hint="Character picture behind the page"
            on={settings.artwork}
            onClick={() => onToggle("artwork")}
            testId="button-artwork"
          />
          <Row
            id="sound"
            label="Sound"
            hint="A soft tone when a result lands"
            on={settings.sound}
            onClick={() => onToggle("sound")}
            testId="button-sound"
          />
          {canVibrate && (
            <Row
              id="haptics"
              label="Haptics"
              hint="A short buzz when a result lands"
              on={settings.haptics}
              onClick={() => onToggle("haptics")}
              testId="button-haptics"
              extra={
                settings.haptics ? (
                  <button type="button" className="text-link" onClick={onTestHaptics} data-testid="button-test-haptics">
                    Test buzz
                  </button>
                ) : undefined
              }
            />
          )}
          {canMotion && (
            <Row
              id="shake"
              label="Shake to generate"
              hint="Shake your phone instead of tapping"
              on={settings.motion}
              onClick={() => onToggle("motion")}
              testId="button-motion"
            />
          )}
          {canInstall && (
            <li className="sheet-row">
              <div className="sheet-copy">
                <span>Install app</span>
                <small>Add it to your home screen</small>
              </div>
              <button type="button" className="theme-button" onClick={onInstall} data-testid="button-install">
                Install
              </button>
            </li>
          )}
        </ul>

        <p className="settings-status" role="status" aria-live="polite">
          {status}
        </p>
      </section>
    </div>
  );
}
