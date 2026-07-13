/**
 * Sonidos de UI del Command Center — port del sistema WebAudio de la maqueta
 * (branding/maqueta-command-center/index.html: tone/popS/tick/chirp). Todo
 * sintetizado, sin archivos de audio. Volúmenes sutiles (gain ≤ .07).
 *
 * La preferencia on/off vive en localStorage (default ON) y la controla el
 * botoncito de sonido del Sidebar. Ventana principal solamente — los pitidos
 * de grabación de la burbuja son otro sistema (audio_feedback en Rust).
 */

const STORAGE_KEY = "fuwa.uiSounds";

let audioContext: AudioContext | null = null;

const getContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
};

export const isUiSoundEnabled = (): boolean =>
  localStorage.getItem(STORAGE_KEY) !== "off";

export const setUiSoundEnabled = (enabled: boolean): void => {
  localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
};

function tone(
  f0: number,
  f1: number,
  duration: number,
  type: OscillatorType = "sine",
  gain = 0.07,
): void {
  if (!isUiSoundEnabled()) return;
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + duration);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  } catch {
    // WebAudio no disponible (o contexto suspendido): silencio, sin romper UI.
  }
}

/** Pop suave — toggles y confirmaciones. */
export const popS = (): void => tone(420, 660, 0.09);

/** Tick seco — navegación y chips segmentados. */
export const tick = (): void => tone(880, 760, 0.05, "triangle", 0.045);

/** Chirp — cambios de estado de la mascota (frecuencia por estado). */
export const chirp = (f: number): void => tone(f, f * 1.5, 0.12);

/** Tick con pitch progresivo — el tono SUBE con la sensibilidad (0-100). */
export const dialTick = (value: number): void =>
  tone(240 + value * 7, 240 + value * 7, 0.06, "triangle", 0.05);

/** Alterna la preferencia y devuelve el nuevo estado (con pop al encender). */
export const toggleUiSound = (): boolean => {
  const next = !isUiSoundEnabled();
  setUiSoundEnabled(next);
  if (next) popS();
  return next;
};
