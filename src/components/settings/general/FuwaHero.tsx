import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import FuwaFaceMascot from "../../FuwaFaceMascot";
import type { FuwaFaceState } from "@/lib/fuwaFaces";
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

/**
 * Hero del Command Center: Fuwa en grande con su pantalla de estado EN VIVO.
 * Mismo patrón que la burbuja (FuwaBubble): al pasar de "pensando" a idle
 * muestra el check ✓ durante ~900ms antes de volver a reposo.
 */
export const FuwaHero: React.FC = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<HeroState>("idle");
  const stateRef = useRef<HeroState>("idle");
  const doneTimer = useRef<number | undefined>(undefined);

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

  return (
    <div className="glass-card rounded-[28px] relative flex flex-col items-center justify-center overflow-hidden px-6 pt-10 pb-8">
      <span className="absolute top-4 start-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--mint-ink)]">
        {t("fuwaHero.kicker")}
      </span>
      <div className="fuwa-halo" />
      <FuwaFaceMascot
        face={FACE_FOR[state]}
        width={180}
        className="fuwa-bob relative"
      />
      <h2 className="font-display font-semibold text-3xl mt-4 tracking-tight relative">
        {t(KEYS[state].title)}
      </h2>
      <p className="text-sm text-mid-gray mt-1 max-w-md text-center relative">
        {t(KEYS[state].subtitle)}
      </p>
    </div>
  );
};
