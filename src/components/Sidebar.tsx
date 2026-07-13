import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Cog,
  FlaskConical,
  History,
  Info,
  Sparkles,
  Cpu,
  Volume2,
  VolumeX,
} from "lucide-react";
import FuwaTextLogo from "./icons/FuwaTextLogo";
import FuwaMascot from "./icons/FuwaMascot";
import { useSettings } from "../hooks/useSettings";
import { isUiSoundEnabled, tick, toggleUiSound } from "../lib/uiSounds";
import {
  GeneralSettings,
  AdvancedSettings,
  HistorySettings,
  DebugSettings,
  AboutSettings,
  PostProcessingSettings,
  ModelsSettings,
} from "./settings";

export type SidebarSection = keyof typeof SECTIONS_CONFIG;

interface IconProps {
  width?: number | string;
  height?: number | string;
  size?: number | string;
  className?: string;
  [key: string]: any;
}

interface SectionConfig {
  labelKey: string;
  icon: React.ComponentType<IconProps>;
  component: React.ComponentType;
  enabled: (settings: any) => boolean;
}

export const SECTIONS_CONFIG = {
  general: {
    labelKey: "sidebar.general",
    icon: FuwaMascot,
    component: GeneralSettings,
    enabled: () => true,
  },
  models: {
    labelKey: "sidebar.models",
    icon: Cpu,
    component: ModelsSettings,
    enabled: () => true,
  },
  advanced: {
    labelKey: "sidebar.advanced",
    icon: Cog,
    component: AdvancedSettings,
    enabled: () => true,
  },
  history: {
    labelKey: "sidebar.history",
    icon: History,
    component: HistorySettings,
    enabled: () => true,
  },
  postprocessing: {
    labelKey: "sidebar.postProcessing",
    icon: Sparkles,
    component: PostProcessingSettings,
    enabled: (settings) => settings?.post_process_enabled ?? false,
  },
  debug: {
    labelKey: "sidebar.debug",
    icon: FlaskConical,
    component: DebugSettings,
    enabled: (settings) => settings?.debug_mode ?? false,
  },
  about: {
    labelKey: "sidebar.about",
    icon: Info,
    component: AboutSettings,
    enabled: () => true,
  },
} as const satisfies Record<string, SectionConfig>;

interface SidebarProps {
  activeSection: SidebarSection;
  onSectionChange: (section: SidebarSection) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onSectionChange,
}) => {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [soundOn, setSoundOn] = useState(isUiSoundEnabled);

  const availableSections = Object.entries(SECTIONS_CONFIG)
    .filter(([_, config]) => config.enabled(settings))
    .map(([id, config]) => ({ id: id as SidebarSection, ...config }));

  return (
    <div className="glass-card rounded-[28px] flex flex-col w-44 shrink-0 my-3 ms-3 items-center px-2.5 py-3 overflow-y-auto overflow-x-hidden">
      <FuwaTextLogo width={110} className="m-3 relative z-[1]" />
      <div className="flex flex-col w-full items-center gap-1.5 pt-2 relative z-[1]">
        {availableSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;

          return (
            <div
              key={section.id}
              className={`fuwa-nav nav-item ${isActive ? "on" : ""}`}
              onClick={() => {
                if (!isActive) tick();
                onSectionChange(section.id);
              }}
            >
              <span className="fuwa-nav-chip">
                <Icon width={17} height={17} className="shrink-0" />
              </span>
              <p
                className="text-sm font-bold truncate"
                title={t(section.labelKey)}
              >
                {t(section.labelKey)}
              </p>
            </div>
          );
        })}
      </div>
      {/* Botoncito discreto de sonidos de UI (preferencia en localStorage) */}
      <div className="mt-auto w-full flex justify-center pt-3 relative z-[1]">
        <button
          type="button"
          className={`fuwa-sndbtn ${soundOn ? "" : "off"}`}
          title={soundOn ? t("sidebar.uiSoundsOn") : t("sidebar.uiSoundsOff")}
          aria-label={
            soundOn ? t("sidebar.uiSoundsOn") : t("sidebar.uiSoundsOff")
          }
          onClick={() => setSoundOn(toggleUiSound())}
        >
          {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
      </div>
    </div>
  );
};
