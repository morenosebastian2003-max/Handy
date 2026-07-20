import React from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "../../../hooks/useSettings";
import { tick } from "@/lib/uiSounds";

// Emojis como constantes TS para no disparar i18next/no-literal-string.
const CARD_EMOJI = "🦎";

// Cada chip apunta a un prompt de post-proceso que ya existe en
// default_post_process_prompts (src-tauri/src/settings.rs). Seleccionarlo
// reusa el mismo camino que PostProcessingSettingsPrompts:
// updateSetting("post_process_selected_prompt_id") → set_post_process_selected_prompt.
const MODES = [
  { id: "fuwa_camuflaje_auto", emoji: "🎯", labelKey: "auto" },
  { id: "fuwa_camuflaje_email", emoji: "✉️", labelKey: "email" },
  { id: "fuwa_camuflaje_codigo", emoji: "💻", labelKey: "code" },
  { id: "fuwa_camuflaje_notas", emoji: "📝", labelKey: "notes" },
  { id: "fuwa_camuflaje_slack", emoji: "💬", labelKey: "slack" },
  { id: "fuwa_camuflaje_prompt", emoji: "🤖", labelKey: "prompt" },
  { id: "default_improve_transcriptions", emoji: "✨", labelKey: "polish" },
] as const;

/**
 * Modo Camuflaje rápido: chips segmentados (maqueta) que cambian el prompt de
 * post-proceso seleccionado sin pasar por la sección de Post Proceso.
 */
export const CamouflageCard: React.FC = () => {
  const { t } = useTranslation();
  const { getSetting, updateSetting } = useSettings();

  const selectedId = getSetting("post_process_selected_prompt_id");
  const postProcessEnabled = getSetting("post_process_enabled") ?? false;

  const selectMode = (id: string) => {
    if (id === selectedId) return;
    tick();
    void updateSetting("post_process_selected_prompt_id", id);
  };

  return (
    <div className="glass-card glass-hover rounded-3xl px-5 py-4">
      <h3 className="font-display font-semibold text-base flex items-center gap-2.5 relative z-[1]">
        <span className="fuwa-card-ic" aria-hidden="true">
          {CARD_EMOJI}
        </span>
        {t("settings.camouflage.title")}
      </h3>
      <p className="text-xs text-mid-gray mt-1.5 leading-relaxed relative z-[1]">
        {t("settings.camouflage.description")}
      </p>
      <div className="flex flex-wrap gap-2 mt-3 relative z-[1]">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={`fuwa-seg ${selectedId === mode.id ? "on" : ""}`}
            aria-pressed={selectedId === mode.id}
            onClick={() => selectMode(mode.id)}
          >
            <span aria-hidden="true">{mode.emoji}</span>{" "}
            {t(`settings.camouflage.modes.${mode.labelKey}`)}
          </button>
        ))}
      </div>
      {!postProcessEnabled && (
        <p className="text-xs text-[var(--mint-ink)] font-semibold mt-3 relative z-[1]">
          {t("settings.camouflage.enableHint")}
        </p>
      )}
    </div>
  );
};
