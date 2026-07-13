import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import FuwaFaceMascot from "./FuwaFaceMascot";
import type { FuwaFaceState } from "@/lib/fuwaFaces";
import type { SidebarSection } from "./Sidebar";
import { chirp } from "@/lib/uiSounds";

type HeroState = "idle" | "listen" | "think" | "done";

// En Tauri 2 los emit del backend se broadcastean a todas las webviews, así
// que el hero escucha los mismos eventos que la burbuja flotante:
// "show-overlay" con payload "recording" | "transcribing" | "processing" |
// "idle", y "hide-overlay" (→ idle).
const payloadToState = (payload: string): "idle" | "listen" | "think" => {
  if (payload === "recording") return "listen";
  if (payload === "transcribing" || payload === "processing") return "think";
  return "idle";
};

const FACE_FOR: Record<HeroState, FuwaFaceState> = {
  idle: "idle",
  listen: "listen",
  think: "think",
  done: "done",
};

// Frecuencias del chirp por estado — mismas que la statebar de la maqueta.
const CHIRP_FOR: Record<HeroState, number> = {
  idle: 520,
  listen: 660,
  think: 440,
  done: 740,
};

// Reacción de Fuwa al cambiar de módulo (~700ms y vuelve al estado vivo).
// Los estados reales del motor SIEMPRE tienen prioridad sobre la reacción.
const SECTION_FACE: Record<SidebarSection, FuwaFaceState> = {
  general: "happy",
  models: "think",
  advanced: "idle",
  history: "idle",
  postprocessing: "think",
  debug: "idle",
  about: "happy",
};

const REACTION_CHIRP: Record<string, number> = {
  happy: 520,
  think: 440,
  idle: 380,
};

const REACTION_MS = 700;

const KEYS: Record<HeroState, { title: string; subtitle: string }> = {
  idle: {
    title: "fuwaHero.idle.title",
    subtitle: "fuwaHero.idle.subtitle",
  },
  listen: {
    title: "fuwaHero.listen.title",
    subtitle: "fuwaHero.listen.subtitle",
  },
  think: {
    title: "fuwaHero.think.title",
    subtitle: "fuwaHero.think.subtitle",
  },
  done: {
    title: "fuwaHero.done.title",
    subtitle: "fuwaHero.done.subtitle",
  },
};

// Colapso a 2 columnas: mismo umbral que .fuwa-main en App.css (lg de Tailwind).
const WIDE_QUERY = "(min-width: 1024px)";

interface FuwaHeroProps {
  activeSection: SidebarSection;
}

/**
 * Hero del Command Center: Fuwa en grande con su pantalla de estado EN VIVO,
 * ahora columna central persistente del layout (App.tsx). Mismo patrón que la
 * burbuja (FuwaBubble): al pasar de "pensando" a idle muestra el check ✓
 * durante ~900ms antes de volver a reposo. Bajo el umbral de 2 columnas se
 * vuelve una fila compacta (mascota ~120px junto al título) sobre el panel.
 */
export const FuwaHero: React.FC<FuwaHeroProps> = ({ activeSection }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<HeroState>("idle");
  const [reaction, setReaction] = useState<FuwaFaceState | null>(null);
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  const stateRef = useRef<HeroState>("idle");
  const doneTimer = useRef<number | undefined>(undefined);
  const firstSection = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    // Fija el estado y chirpea cuando de verdad cambia (silent para las
    // vueltas automáticas a reposo, que ya vienen precedidas de su chirp).
    const commit = (next: HeroState, silent = false) => {
      if (stateRef.current !== next && !silent) chirp(CHIRP_FOR[next]);
      stateRef.current = next;
      setState(next);
    };

    const apply = (next: "idle" | "listen" | "think") => {
      window.clearTimeout(doneTimer.current);
      const prev = stateRef.current;
      if ((prev === "think" || prev === "done") && next === "idle") {
        commit("done");
        doneTimer.current = window.setTimeout(() => commit("idle", true), 900);
        return;
      }
      commit(next);
    };

    const unShow = listen<string>("show-overlay", (event) => {
      apply(payloadToState(event.payload));
    });
    const unHide = listen("hide-overlay", () => {
      apply("idle");
    });

    return () => {
      unShow.then((fn) => fn());
      unHide.then((fn) => fn());
      window.clearTimeout(doneTimer.current);
    };
  }, []);

  // Reacción sutil al cambiar de módulo (no en el montaje inicial).
  useEffect(() => {
    if (firstSection.current) {
      firstSection.current = false;
      return;
    }
    const sectionFace = SECTION_FACE[activeSection] ?? "idle";
    chirp(REACTION_CHIRP[sectionFace] ?? 380);
    setReaction(sectionFace);
    const timer = window.setTimeout(() => setReaction(null), REACTION_MS);
    return () => window.clearTimeout(timer);
  }, [activeSection]);

  // El motor manda: cualquier estado vivo distinto de reposo tapa la reacción.
  const face: FuwaFaceState =
    state !== "idle" ? FACE_FOR[state] : (reaction ?? "idle");

  if (!wide) {
    // Hero compacto de 2 columnas: fila con la mascota junto al título,
    // arriba del panel de cards (ver .fuwa-main en App.css).
    return (
      <div className="glass-card rounded-[28px] relative flex items-center gap-4 px-5 py-2.5 overflow-hidden shrink-0">
        <FuwaFaceMascot face={face} width={120} className="relative shrink-0" />
        <div className="min-w-0 relative">
          <h2 className="font-display font-semibold text-xl tracking-tight">
            {t(KEYS[state].title)}
          </h2>
          <p className="text-xs text-mid-gray mt-0.5">
            {t(KEYS[state].subtitle)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-[28px] relative flex flex-col items-center justify-center overflow-hidden px-6 pt-10 pb-8 h-full">
      <span className="absolute top-4 start-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mint-ink)]">
        {t("fuwaHero.kicker")}
      </span>
      <div className="fuwa-halo" />
      <FuwaFaceMascot face={face} width={180} className="fuwa-bob relative" />
      <h2 className="font-display font-semibold text-3xl mt-4 tracking-tight relative text-center">
        {t(KEYS[state].title)}
      </h2>
      <p className="text-sm text-mid-gray mt-1 max-w-md text-center relative">
        {t(KEYS[state].subtitle)}
      </p>
    </div>
  );
};
