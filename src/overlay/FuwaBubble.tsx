import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import fuwaBody from "@/assets/fuwa-body.png";
import "./FuwaBubble.css";

export type BubbleState = "idle" | "recording" | "transcribing" | "processing";

// Movement (px) past which a press becomes a window drag instead of a click.
const DRAG_THRESHOLD = 5;

// Screen geometry calibrated over the v2 body render (blank powered-off
// screen, 560×808 asset — see branding/mascota-estados/fuwa-body-v2.png).
// Measured programmatically from the dark-glass pixel region.
const BODY_W = 560;
const BODY_H = 808;
const SCREEN = { x: 216, y: 326, w: 179, h: 93, r: 28 };

// Mascot display width at scale 1. The Rust side sizes the window from the
// same base (overlay.rs BUBBLE_* constants) — keep them in sync.
const BASE_MASCOT_W = 100;

const SCALES: { label: string; value: number }[] = [
  { label: "S", value: 0.6 },
  { label: "M", value: 1 },
  { label: "L", value: 1.35 },
  { label: "XL", value: 1.7 },
];

const STORAGE_KEY = "fuwa.bubbleScale";

/**
 * Burbuja Fuwa — the persistent mascot. The 3D body render never changes;
 * the face is software: an SVG drawn over the screen area that swaps with the
 * engine state. Click toggles recording, hold-and-move drags the bubble,
 * right-click opens the size picker.
 */
const FuwaBubble: React.FC<{ state: BubbleState; levels: number[] }> = ({
  state,
  levels,
}) => {
  const { t } = useTranslation();
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const prevStateRef = useRef<BubbleState>(state);
  const [justDone, setJustDone] = useState(false);
  const [menu, setMenu] = useState(false);
  const [scale, setScale] = useState<number>(() => {
    const stored = parseFloat(localStorage.getItem(STORAGE_KEY) ?? "1");
    return Number.isFinite(stored) && stored > 0 ? stored : 1;
  });

  // Restore the persisted size on mount — the backend owns the window size.
  // Runs once; `scale` is the initial localStorage value at mount time.
  useEffect(() => {
    invoke("set_bubble_scale", { scale }).catch(() => {});
  }, []);

  // ✅ Listo: when work finishes (working → idle) the check pops for ~900ms,
  // then Fuwa goes back to breathing.
  useEffect(() => {
    const prev = prevStateRef.current;
    prevStateRef.current = state;
    if (
      (prev === "transcribing" || prev === "processing") &&
      state === "idle"
    ) {
      setJustDone(true);
      const t = setTimeout(() => setJustDone(false), 950);
      return () => clearTimeout(t);
    }
    if (state !== "idle") setJustDone(false);
  }, [state]);

  const closeMenu = () => {
    setMenu(false);
    invoke("set_bubble_menu_open", { open: false }).catch(() => {});
  };

  const applyScale = (value: number) => {
    setScale(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    // set_bubble_scale resizes the window to the plain bubble size, which
    // also undoes the temporary menu enlargement.
    invoke("set_bubble_scale", { scale: value }).catch(() => {});
    setMenu(false);
  };

  const openApp = () => {
    invoke("show_main_window_command").catch(() => {});
    closeMenu();
  };

  // Take the bubble off the desktop for now. This only HIDES the overlay
  // window (keeps the bubble style), so pressing the record shortcut brings the
  // mascot right back — the user wanted "hide while idle", not "switch away
  // from the mascot".
  const hideBubble = () => {
    invoke("hide_bubble").catch(() => {});
    closeMenu();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    pressRef.current = { x: e.screenX, y: e.screenY };
    draggedRef.current = false;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const press = pressRef.current;
    if (!press || draggedRef.current || e.buttons !== 1) return;
    if (Math.hypot(e.screenX - press.x, e.screenY - press.y) > DRAG_THRESHOLD) {
      draggedRef.current = true;
      // Hand off to the OS window drag; mouseup won't reach us afterwards.
      getCurrentWindow().startDragging();
    }
  };

  const onMouseUp = () => {
    const wasPress = pressRef.current !== null && !draggedRef.current;
    pressRef.current = null;
    if (!wasPress) return;
    if (menu) {
      closeMenu();
      return;
    }
    invoke("toggle_transcription").catch(() => {});
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (menu) {
      closeMenu();
    } else {
      setMenu(true);
      // Grow the window so the menu fits even at the smallest bubble size.
      invoke("set_bubble_menu_open", { open: true }).catch(() => {});
    }
  };

  // ---- face for the current state (viewBox matches the calibrated screen) --
  const face = (() => {
    if (state === "recording") {
      return (
        <svg viewBox="0 0 88 58">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const level = levels[i] ?? 0;
            const h = Math.max(8, Math.min(46, 8 + Math.pow(level, 0.7) * 38));
            return (
              <rect
                key={i}
                className="fbm-glow-fill"
                x={18 + i * 8}
                y={29 - h / 2}
                width="4"
                height={h}
                rx="2"
              />
            );
          })}
          <circle className="fbm-recdot" cx="76" cy="10" r="3.4" />
        </svg>
      );
    }
    if (state === "transcribing" || state === "processing") {
      return (
        <svg viewBox="0 0 88 58">
          <g className="fbm-dots">
            <circle className="fbm-glow-fill" cx="30" cy="29" r="4.5" />
            <circle
              className="fbm-glow-fill"
              cx="44"
              cy="29"
              r="4.5"
              style={{ animationDelay: ".18s" }}
            />
            <circle
              className="fbm-glow-fill"
              cx="58"
              cy="29"
              r="4.5"
              style={{ animationDelay: ".36s" }}
            />
          </g>
        </svg>
      );
    }
    if (justDone) {
      return (
        <svg viewBox="0 0 88 58">
          <path
            className="fbm-glow fbm-check"
            strokeWidth="6"
            d="M28 30 l10 10 l22 -22"
          />
        </svg>
      );
    }
    // idle: ^_^ eyes that blink every ~4s + a soft smile
    return (
      <svg viewBox="0 0 88 58">
        <g className="fbm-eyes">
          <path className="fbm-glow" strokeWidth="4" d="M22 26 q6 -8 12 0" />
          <path className="fbm-glow" strokeWidth="4" d="M54 26 q6 -8 12 0" />
        </g>
        <path className="fbm-glow" strokeWidth="4" d="M32 36 q12 10 24 0" />
      </svg>
    );
  })();

  const mascotW = BASE_MASCOT_W * scale;
  const k = mascotW / BODY_W; // display px per render px

  return (
    <div
      className={`fbm-stage fbm-${state}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onContextMenu={onContextMenu}
    >
      <div
        className="fbm-mascot"
        style={{ width: mascotW, height: BODY_H * k }}
      >
        <img src={fuwaBody} alt="" draggable={false} width={mascotW} />
        <div
          className="fbm-screen"
          style={{
            left: SCREEN.x * k,
            top: SCREEN.y * k,
            width: SCREEN.w * k,
            height: SCREEN.h * k,
            borderRadius: SCREEN.r * k,
          }}
        >
          {face}
        </div>
      </div>
      {menu && (
        <div className="fbm-menu" onMouseDown={(e) => e.stopPropagation()}>
          <div className="fbm-menu-label">{t("overlay.bubble.size")}</div>
          <div className="fbm-picker">
            {SCALES.map((s) => (
              <button
                key={s.label}
                className={scale === s.value ? "on" : ""}
                onClick={() => applyScale(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="fbm-menu-sep" />
          <button className="fbm-menu-item" onClick={openApp}>
            {t("overlay.bubble.openApp")}
          </button>
          <button className="fbm-menu-item" onClick={hideBubble}>
            {t("overlay.bubble.hide")}
          </button>
        </div>
      )}
    </div>
  );
};

export default FuwaBubble;
