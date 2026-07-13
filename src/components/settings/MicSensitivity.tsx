import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../../hooks/useSettings";
import { dialTick, popS } from "@/lib/uiSounds";

// Emoji del encabezado (constante TS para no disparar i18next/no-literal-string).
const DIAL_EMOJI = "🎚";

/**
 * Card "Sensibilidad del micrófono" con el dial radial de la maqueta:
 * anillo conic-gradient arrastrable con el % centrado. Cada ~4% de arrastre
 * suena un tick cuyo tono SUBE con la sensibilidad (240 + v*7 Hz); al soltar
 * se persiste vía change_vad_sensitivity_setting (patrón useSettings).
 */
export const MicSensitivity: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();
  const dialRef = useRef<HTMLDivElement>(null);
  // null = mostrar el valor guardado; número = arrastre en curso.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const lastStep = useRef(-1);

  const saved = getSetting("vad_sensitivity") ?? 70;
  const value = dragValue ?? saved;

  const valueFromPointer = (clientX: number, clientY: number): number => {
    const dial = dialRef.current;
    if (!dial) return value;
    const r = dial.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const angle = Math.atan2(clientX - cx, -(clientY - cy));
    const v = Math.round((((angle * 180) / Math.PI + 360) % 360) / 3.6);
    return Math.min(100, Math.max(0, v));
  };

  const applyDrag = (clientX: number, clientY: number) => {
    const v = valueFromPointer(clientX, clientY);
    setDragValue(v);
    const step = Math.round(v / 4);
    if (step !== lastStep.current) {
      lastStep.current = step;
      dialTick(v);
    }
  };

  const commit = (v: number) => {
    setDragValue(null);
    lastStep.current = -1;
    popS();
    if (v !== saved) {
      void updateSetting("vad_sensitivity", v);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    applyDrag(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue !== null) applyDrag(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragValue === null) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    commit(valueFromPointer(e.clientX, e.clientY));
  };

  // Accesible también por teclado: flechas ±5.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      next = Math.min(100, saved + 5);
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      next = Math.max(0, saved - 5);
    }
    if (next !== null && next !== saved) {
      e.preventDefault();
      dialTick(next);
      void updateSetting("vad_sensitivity", next);
    }
  };

  return (
    <div className="glass-card glass-hover rounded-3xl px-5 py-4">
      <h3 className="font-display font-semibold text-base flex items-center gap-2.5 relative z-[1]">
        <span className="fuwa-card-ic" aria-hidden="true">
          {DIAL_EMOJI}
        </span>
        {t("settings.micSensitivity.title")}
      </h3>
      <div className="flex items-center gap-4.5 mt-3 relative z-[1]">
        <div
          ref={dialRef}
          className="fuwa-dial"
          style={{ "--v": value } as React.CSSProperties}
          role="slider"
          aria-label={t("settings.micSensitivity.title")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          <b>{t("settings.micSensitivity.value", { value })}</b>
        </div>
        <p className="text-xs text-mid-gray leading-relaxed flex-1">
          {t("settings.micSensitivity.hint")}
        </p>
      </div>
    </div>
  );
};
