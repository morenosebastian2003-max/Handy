import React from "react";
import fuwaBody from "@/assets/fuwa-body.png";

/**
 * Fuwa — the mascot: the 3D retro-microphone render with its crown
 * (branding/mascota-estados). Used as logo/icon across the app; the animated,
 * stateful version lives in the bubble (src/overlay/FuwaBubble.tsx).
 */
const FuwaMascot = ({
  width = 32,
  height,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) => {
  return (
    <img
      src={fuwaBody}
      alt=""
      draggable={false}
      width={width}
      height={height}
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
};

export default FuwaMascot;
