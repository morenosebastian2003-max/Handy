import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import type { ModelInfo } from "@/bindings";
import type { ModelCardStatus } from "./ModelCard";
import ModelCard, { isLegacySource } from "./ModelCard";
import FuwaFaceMascot from "../FuwaFaceMascot";
import type { FuwaFaceState } from "@/lib/fuwaFaces";
import { useModelStore } from "../../stores/modelStore";

interface OnboardingProps {
  onModelSelected: () => void;
}

// Narrativa "configura a tu compañero": intro (Fuwa dormida) → cerebro
// (selección/descarga de modelo, la lógica original intacta) → lista
// (celebración con confeti antes de entrar a la app).
type OnboardingPhase = "intro" | "model" | "ready";

const PHASE_INDEX: Record<OnboardingPhase, number> = {
  intro: 0,
  model: 1,
  ready: 2,
};

// Cuánto dura la celebración antes de entrar a la app.
const CELEBRATION_MS = 2400;
// Cara feliz al despertar antes de pasar al paso de modelos.
const WAKE_MS = 600;

const CONF_COLORS = ["#0FE7C0", "#35F0CE", "#D4AF5F", "#9B6BFF", "#FFFFFF"];

const Confetti: React.FC = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        color: CONF_COLORS[i % CONF_COLORS.length],
        delay: Math.random() * 0.7,
        duration: 1.2 + Math.random() * 1.2,
      })),
    [],
  );
  return (
    <>
      {pieces.map((p, i) => (
        <span
          key={i}
          className="fuwa-conf"
          style={{
            left: `${p.left}vw`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </>
  );
};

const Onboarding: React.FC<OnboardingProps> = ({ onModelSelected }) => {
  const { t } = useTranslation();
  const {
    models,
    downloadModel,
    selectModel,
    downloadingModels,
    verifyingModels,
    extractingModels,
    downloadProgress,
    downloadStats,
    cancelDownload,
  } = useModelStore();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>("intro");
  const [introFace, setIntroFace] = useState<FuwaFaceState>("sleep");
  const hasStartedSelection = useRef(false);
  const isWaking = useRef(false);

  const isBusy = selectedModelId !== null;

  // Curate the download list: legacy (.bin/ONNX) downloads are deprecated and
  // never shown here (they still appear in the compatible section if already on
  // disk). The catalog arrives rank-sorted, so the first two recommended models
  // are the featured picks — currently Parakeet Unified (English) and Nemotron
  // Streaming (multilingual). Everything else hides behind "Show all".
  const { downloadable, topPicks, otherRecommended, rest } = useMemo(() => {
    const downloadable = models.filter(
      (m: ModelInfo) => !m.is_downloaded && !isLegacySource(m),
    );
    const recommended = downloadable.filter((m: ModelInfo) => m.is_recommended);
    // `models` arrives in editorial rank order (the backend sorts by rank_of,
    // then accuracy), so keep that order here: ranked-but-not-recommended models
    // surface first, then the unranked tail by accuracy.
    const rest = downloadable.filter((m: ModelInfo) => !m.is_recommended);
    return {
      downloadable,
      topPicks: recommended.slice(0, 2),
      otherRecommended: recommended.slice(2),
      rest,
    };
  }, [models]);

  const hasRecommended = topPicks.length > 0 || otherRecommended.length > 0;
  // When nothing recommended remains to download (e.g. all already on disk),
  // there is no curated subset to collapse, so just show the full list.
  const showRest = showAll || !hasRecommended;

  // Shhh… está dormida → cara feliz un instante → paso de modelos.
  const wakeUp = () => {
    if (isWaking.current) return;
    isWaking.current = true;
    setIntroFace("happy");
    window.setTimeout(() => setPhase("model"), WAKE_MS);
  };

  // Watch for the selected model to finish downloading + verifying + extracting
  useEffect(() => {
    if (!selectedModelId) {
      hasStartedSelection.current = false;
      return;
    }

    const model = models.find((m) => m.id === selectedModelId);
    const stillDownloading = selectedModelId in downloadingModels;
    const stillVerifying = selectedModelId in verifyingModels;
    const stillExtracting = selectedModelId in extractingModels;

    if (
      model?.is_downloaded &&
      !stillDownloading &&
      !stillVerifying &&
      !stillExtracting &&
      !hasStartedSelection.current
    ) {
      hasStartedSelection.current = true;

      // Model is ready — select it, celebrate, then transition
      selectModel(selectedModelId).then((success) => {
        if (success) {
          setPhase("ready");
          window.setTimeout(() => onModelSelected(), CELEBRATION_MS);
        } else {
          toast.error(t("onboarding.errors.selectModel"));
          hasStartedSelection.current = false;
          setSelectedModelId(null);
        }
      });
    }
  }, [
    selectedModelId,
    models,
    downloadingModels,
    verifyingModels,
    extractingModels,
    selectModel,
    onModelSelected,
    t,
  ]);

  const handleDownloadModel = async (modelId: string) => {
    setSelectedModelId(modelId);

    // Error toast is handled centrally by the model-download-failed event listener
    // in modelStore — no toast here to avoid duplicates.
    const success = await downloadModel(modelId);
    if (!success) {
      setSelectedModelId(null);
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    const success = await cancelDownload(modelId);
    if (success) {
      setSelectedModelId(null);
    }
  };

  const handleSelectExistingModel = (modelId: string) => {
    setSelectedModelId(modelId);
  };

  const getModelStatus = (modelId: string): ModelCardStatus => {
    if (modelId in extractingModels) return "extracting";
    if (modelId in verifyingModels) return "verifying";
    if (modelId in downloadingModels) return "downloading";
    return "downloadable";
  };

  const getExistingModelStatus = (modelId: string): ModelCardStatus => {
    if (selectedModelId === modelId) return "switching";
    return "available";
  };

  const getModelDownloadProgress = (modelId: string): number | undefined => {
    return downloadProgress[modelId]?.percentage;
  };

  const getModelDownloadSpeed = (modelId: string): number | undefined => {
    return downloadStats[modelId]?.speed;
  };

  const dots = (
    <div className="onb-dots mt-7 shrink-0">
      {([0, 1, 2] as const).map((i) => (
        <i key={i} className={i <= PHASE_INDEX[phase] ? "on" : ""} />
      ))}
    </div>
  );

  return (
    <div className="relative h-screen w-screen flex items-center justify-center p-6 overflow-hidden">
      {phase === "ready" && <Confetti />}

      {phase === "intro" && (
        <div className="glass-t1 onb-in rounded-[32px] relative flex flex-col items-center text-center w-full max-w-xl px-10 py-11">
          <span className="onb-kicker">{t("onboarding.intro.kicker")}</span>
          <div onClick={wakeUp} className="cursor-pointer">
            <FuwaFaceMascot face={introFace} width={200} />
          </div>
          <h1 className="font-display font-bold text-3xl tracking-tight mt-4">
            {t("onboarding.intro.title")}
          </h1>
          <p className="text-[15px] text-text/70 mt-2 max-w-md leading-relaxed">
            {t("onboarding.intro.subtitle")}
          </p>
          <button className="fuwa-cta mt-7" onClick={wakeUp}>
            {t("onboarding.intro.cta")}
          </button>
          {dots}
        </div>
      )}

      {phase === "model" && (
        <div className="glass-t1 onb-in rounded-[32px] relative flex flex-col items-center text-center w-full max-w-2xl max-h-full px-8 py-8 min-h-0">
          <span className="onb-kicker shrink-0">
            {t("onboarding.brain.kicker")}
          </span>
          <FuwaFaceMascot face="think" width={120} className="shrink-0" />
          <h1 className="font-display font-bold text-3xl tracking-tight mt-3 shrink-0">
            {t("onboarding.brain.title")}
          </h1>
          <p className="text-[15px] text-text/70 mt-1 shrink-0">
            {t("onboarding.brain.subtitle")}
          </p>

          <div className="w-full flex-1 min-h-0 overflow-y-auto text-left mt-5 pe-1 space-y-6 relative z-[1]">
            {models.some((m: ModelInfo) => m.is_downloaded) && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-text/60">
                  {t("onboarding.existingModelsTitle")}
                </h2>
                {models
                  .filter((m: ModelInfo) => m.is_downloaded)
                  .map((model: ModelInfo) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      status={getExistingModelStatus(model.id)}
                      disabled={isBusy}
                      onSelect={handleSelectExistingModel}
                      showRecommended={false}
                    />
                  ))}
              </div>
            )}

            {downloadable.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-text/60">
                  {t("onboarding.downloadModelsTitle")}
                </h2>

                {topPicks.map((model: ModelInfo) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    variant="featured"
                    status={getModelStatus(model.id)}
                    disabled={isBusy}
                    onSelect={handleDownloadModel}
                    onDownload={handleDownloadModel}
                    onCancel={handleCancelDownload}
                    downloadProgress={getModelDownloadProgress(model.id)}
                    downloadSpeed={getModelDownloadSpeed(model.id)}
                    showRecommended={true}
                  />
                ))}

                {otherRecommended.map((model: ModelInfo) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    status={getModelStatus(model.id)}
                    disabled={isBusy}
                    onSelect={handleDownloadModel}
                    onDownload={handleDownloadModel}
                    onCancel={handleCancelDownload}
                    downloadProgress={getModelDownloadProgress(model.id)}
                    downloadSpeed={getModelDownloadSpeed(model.id)}
                    showRecommended={false}
                  />
                ))}

                {hasRecommended && rest.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="flex items-center justify-center gap-1.5 mx-auto py-1 text-sm font-medium text-text/60 hover:text-text transition-colors"
                  >
                    {showAll
                      ? t("onboarding.showFewerModels")
                      : t("onboarding.showAllModels", {
                          total: downloadable.length,
                        })}
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-200 ${
                        showAll ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}

                {showRest &&
                  rest.map((model: ModelInfo) => (
                    <ModelCard
                      key={model.id}
                      model={model}
                      status={getModelStatus(model.id)}
                      disabled={isBusy}
                      onSelect={handleDownloadModel}
                      onDownload={handleDownloadModel}
                      onCancel={handleCancelDownload}
                      downloadProgress={getModelDownloadProgress(model.id)}
                      downloadSpeed={getModelDownloadSpeed(model.id)}
                      showRecommended={false}
                    />
                  ))}
              </div>
            )}
          </div>
          {dots}
        </div>
      )}

      {phase === "ready" && (
        <div className="glass-t1 onb-in rounded-[32px] relative flex flex-col items-center text-center w-full max-w-xl px-10 py-11">
          <span className="onb-kicker">{t("onboarding.ready.kicker")}</span>
          <FuwaFaceMascot face="happy" width={200} className="fuwa-bob" />
          <h1 className="font-display font-bold text-3xl tracking-tight mt-4">
            {t("onboarding.ready.title")}
          </h1>
          <p className="text-[15px] text-text/70 mt-2 max-w-md leading-relaxed">
            {t("onboarding.ready.subtitle")}
          </p>
          {dots}
        </div>
      )}
    </div>
  );
};

export default Onboarding;
