import React from "react";

/**
 * Fondo líquido del Command Center: blobs menta/aqua/dorado/violeta con
 * blur(80px) que derivan lentamente + un patrón de ondas casi imperceptible.
 * Se monta UNA vez en App.tsx, fijo detrás de todo (z-0, sin eventos).
 * En dark mode los blobs bajan de opacidad vía --blob-fade (theme.css).
 */
const LiquidBackground: React.FC = () => (
  <div className="liquid-bg" aria-hidden="true">
    <div className="blob lb1" />
    <div className="blob lb2" />
    <div className="blob lb3" />
    <div className="blob lb4" />
    <div className="waves" />
  </div>
);

export default LiquidBackground;
