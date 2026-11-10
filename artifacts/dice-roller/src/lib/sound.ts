// Optional sound cues, built with the Web Audio API (no audio files).
// Off by default; the app only calls these after the player turns sound on.

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(
  audio: AudioContext,
  type: OscillatorType,
  from: number,
  to: number,
  start: number,
  duration: number,
  peakGain: number,
) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const end = start + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, end);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peakGain, start + duration * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}

/** Rising hum while the numbers are being generated. */
export function playCharge() {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, "triangle", 110, 340, now, 0.3, 0.05);
  tone(audio, "sine", 220, 680, now, 0.3, 0.025);
}

/** Clean chime when the result locks in; a brighter one for special results. */
export function playLockIn(special: boolean) {
  const audio = getContext();
  if (!audio) return;
  const now = audio.currentTime;
  tone(audio, "sine", 880, 880, now, 0.5, 0.07);
  tone(audio, "sine", 1320, 1320, now + 0.04, 0.45, 0.04);
  if (special) tone(audio, "sine", 1760, 1760, now + 0.1, 0.6, 0.04);
}
