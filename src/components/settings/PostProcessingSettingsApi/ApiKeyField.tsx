import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApiKeyStorageStatus } from "@/bindings";
import { Alert } from "../../ui/Alert";
import { Button } from "../../ui/Button";
import { Input } from "../../ui/Input";

interface ApiKeyFieldProps {
  providerId: string;
  status: ApiKeyStorageStatus;
  onSave: (value: string) => Promise<void>;
  onDelete: () => Promise<void>;
  disabled: boolean;
  placeholder?: string;
  className?: string;
}

type Feedback = "idle" | "saved" | "deleted" | "error";

export const ApiKeyField: React.FC<ApiKeyFieldProps> = React.memo(
  ({
    providerId,
    status,
    onSave,
    onDelete,
    disabled,
    placeholder,
    className = "",
  }) => {
    const { t } = useTranslation();
    const [localValue, setLocalValue] = useState("");
    const [feedback, setFeedback] = useState<Feedback>("idle");

    useEffect(() => {
      setLocalValue("");
      setFeedback("idle");
    }, [providerId]);

    const handleSave = async () => {
      const value = localValue.trim();
      if (!value || disabled) return;

      setFeedback("idle");
      try {
        await onSave(value);
        setLocalValue("");
        setFeedback("saved");
      } catch (error) {
        console.error("Failed to save post-process API key:", error);
        setFeedback("error");
      }
    };

    const handleDelete = async () => {
      if (disabled) return;

      setFeedback("idle");
      try {
        await onDelete();
        setLocalValue("");
        setFeedback("deleted");
      } catch (error) {
        console.error("Failed to delete post-process API key:", error);
        setFeedback("error");
      }
    };

    const hasStoredKey = status !== "missing";

    return (
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="password"
            value={localValue}
            onChange={(event) => {
              setLocalValue(event.target.value);
              setFeedback("idle");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSave();
              }
            }}
            placeholder={
              hasStoredKey
                ? t("settings.postProcessing.api.apiKey.configuredPlaceholder")
                : placeholder
            }
            aria-label={t("settings.postProcessing.api.apiKey.title")}
            autoComplete="off"
            spellCheck={false}
            variant="compact"
            disabled={disabled}
            className={`flex-1 min-w-[260px] ${className}`}
          />
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={disabled || !localValue.trim()}
            variant="primary"
            size="md"
          >
            {disabled
              ? t("settings.postProcessing.api.apiKey.saving")
              : t("settings.postProcessing.api.apiKey.save")}
          </Button>
          {hasStoredKey && (
            <Button
              type="button"
              onClick={() => void handleDelete()}
              disabled={disabled}
              variant="danger-ghost"
              size="md"
            >
              {t("settings.postProcessing.api.apiKey.delete")}
            </Button>
          )}
        </div>

        {feedback === "error" && (
          <Alert variant="error" className="py-2">
            {t("settings.postProcessing.api.apiKey.error")}
          </Alert>
        )}
        {feedback === "deleted" && status === "missing" && (
          <Alert variant="info" className="py-2">
            {t("settings.postProcessing.api.apiKey.deleted")}
          </Alert>
        )}
        {status === "secure" && (
          <Alert variant="success" className="py-2">
            {t("settings.postProcessing.api.apiKey.secure")}
          </Alert>
        )}
        {status === "local_plaintext" && (
          <Alert variant="warning" className="py-2">
            {t("settings.postProcessing.api.apiKey.localPlaintext")}
          </Alert>
        )}
      </div>
    );
  },
);

ApiKeyField.displayName = "ApiKeyField";
