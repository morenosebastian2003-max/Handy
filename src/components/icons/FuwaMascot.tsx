import React from "react";
import fuwaBody from "@/assets/fuwa-body.png";

// Screen geometry calibrated over the 560×808 body render — same numbers as
// the bubble (src/overlay/FuwaBubble.tsx). The render ships with a blank,
// powered-off screen; the face is always drawn by software.
const BODY_W = 560;
const BODY_H = 808;
const SCREEN = { x: 216, y: 326, w: 179, h: 93, r: 28 };

/**
 * Fuwa — the mascot: the 3D retro-microphone render with its crown, wearing
 * its idle face (^‿^ with a blink) drawn over the screen. The animated,
 * stateful version lives in the bubble (src/overlay/FuwaBubble.tsx).
 */
const FuwaMascot = ({
  width = 32,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  const k = width / BODY_W;
  return (
    <div
      className={`fuwa-mascot ${className ?? ""}`}
      style={{ width, height: Math.round(BODY_H * k) }}
    >
      <img src={fuwaBody} alt="" draggable={false} width={width} />
      <div
        className="fuwa-mascot-screen"
        style={{
          left: SCREEN.x * k,
          top: SCREEN.y * k,
          width: SCREEN.w * k,
          height: SCREEN.h * k,
          borderRadius: SCREEN.r * k,
        }}
      >
        <svg viewBox="0 0 88 58">
          <g className="fuwa-mascot-eyes">
            <path
              className="fuwa-mascot-glow"
              strokeWidth="4"
              d="M22 26 q6 -8 12 0"
            />
            <path
              className="fuwa-mascot-glow"
              strokeWidth="4"
              d="M54 26 q6 -8 12 0"
            />
          </g>
          <path
            className="fuwa-mascot-glow"
            strokeWidth="4"
            d="M32 36 q12 10 24 0"
          />
        </svg>
      </div>
    </div>
  );
};

export default FuwaMascot;
