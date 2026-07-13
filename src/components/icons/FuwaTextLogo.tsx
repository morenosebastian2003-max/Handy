/* eslint-disable i18next/no-literal-string -- "Fuwa" is the brand wordmark, never translated */
import React from "react";
import FuwaMascot from "./FuwaMascot";

/**
 * Fuwa wordmark: mascot + "Fuwa" in Fredoka (the brand display face).
 * Rendered as HTML (not SVG text) so the bundled font always applies.
 */
const FuwaTextLogo = ({
  width = 120,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  const mascotSize = Math.round(width * 0.3);
  const fontSize = Math.round(width * 0.34);
  return (
    <div
      className={`flex items-center justify-center gap-2 select-none ${className ?? ""}`}
      style={{ width }}
    >
      <FuwaMascot width={mascotSize} />
      <span
        className="font-display fuwa-wordmark"
        style={{ fontSize, lineHeight: 1 }}
      >
        Fuwa
      </span>
    </div>
  );
};

export default FuwaTextLogo;
