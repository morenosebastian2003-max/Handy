/**
 * Caras de Fuwa por estado — copiadas de la maqueta command-center. Son SVG
 * estáticos (strings de confianza, sin datos de usuario) que se pintan sobre
 * la pantalla apagada del render 3D con dangerouslySetInnerHTML. Las clases
 * ff-* viven en App.css (ventana principal). La burbuja flotante
 * (src/overlay/FuwaBubble.tsx) tiene su propia copia con niveles de audio
 * reales — esta versión es para el hero y el onboarding.
 */

// Geometría calibrada sobre el render 560×808 (misma que FuwaMascot/burbuja).
export const BODY_W = 560;
export const BODY_H = 808;
export const SCREEN = { x: 216, y: 326, w: 179, h: 93, r: 28 } as const;

export type FuwaFaceState =
  | "idle"
  | "listen"
  | "think"
  | "done"
  | "happy"
  | "sleep"
  | "muted";

// Barras de la cara "listen" (sin niveles reales: animación CSS pura).
const LISTEN_BARS = [14, 26, 38, 46, 38, 26, 14]
  .map((h, i) => {
    return `<rect class="ff-glow-f" x="${18 + i * 8}" y="${29 - h / 2}" width="4" height="${h}" rx="2" style="animation-delay:${(i * 0.09).toFixed(2)}s"/>`;
  })
  .join("");

export const FUWA_FACES: Record<FuwaFaceState, string> = {
  sleep:
    '<svg viewBox="0 0 88 58"><g class="ff-glow" stroke-width="4"><path d="M22 28 h12M54 28 h12"/></g><text x="62" y="16" fill="#35F0CE" font-size="11" font-weight="700" style="filter:drop-shadow(0 0 3px #35F0CE)">z</text><text x="71" y="10" fill="#35F0CE" font-size="8">z</text></svg>',
  idle: '<svg viewBox="0 0 88 58"><g class="ff-eyes"><path class="ff-glow" stroke-width="4" d="M22 26 q6 -8 12 0"/><path class="ff-glow" stroke-width="4" d="M54 26 q6 -8 12 0"/></g><path class="ff-glow" stroke-width="4" d="M32 36 q12 10 24 0"/></svg>',
  happy:
    '<svg viewBox="0 0 88 58"><g><path class="ff-glow" stroke-width="4" d="M20 24 q7 -10 14 0"/><path class="ff-glow" stroke-width="4" d="M52 24 q7 -10 14 0"/></g><path class="ff-glow" stroke-width="5" d="M30 34 q14 14 28 0"/></svg>',
  listen: `<svg viewBox="0 0 88 58"><g class="ff-bars">${LISTEN_BARS}</g><circle class="ff-rec" cx="76" cy="10" r="3.4" fill="#FF5A5A" style="filter:drop-shadow(0 0 4px #FF5A5A)"/></svg>`,
  think:
    '<svg viewBox="0 0 88 58"><g class="ff-dots"><circle class="ff-glow-f" cx="30" cy="29" r="4.5"/><circle class="ff-glow-f" cx="44" cy="29" r="4.5" style="animation-delay:.18s"/><circle class="ff-glow-f" cx="58" cy="29" r="4.5" style="animation-delay:.36s"/></g></svg>',
  done: '<svg viewBox="0 0 88 58"><path class="ff-check ff-glow" stroke-width="6" d="M28 30 l10 10 l22 -22"/></svg>',
  muted:
    '<svg viewBox="0 0 88 58"><g class="ff-glow" stroke-width="3.4"><rect x="38" y="14" width="12" height="20" rx="6"/><path d="M31 28a13 13 0 0 0 26 0M44 41v6"/><path d="M24 10 64 48" stroke="#FF5A5A" style="filter:drop-shadow(0 0 4px #FF5A5A)"/></g></svg>',
};
