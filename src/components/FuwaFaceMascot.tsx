import React from "react";
import fuwaBody from "@/assets/fuwa-body.png";
import {
  BODY_H,
  BODY_W,
  FUWA_FACES,
  SCREEN,
  type FuwaFaceState,
} from "@/lib/fuwaFaces";

/**
 * Fuwa con cara dinámica: el render 3D + la pantalla encendida mostrando la
 * cara del estado pedido (lib/fuwaFaces.ts). Reusa el CSS .fuwa-mascot de
 * FuwaMascot.tsx (que queda como versión estática pequeña para íconos).
 */
const FuwaFaceMascot: React.FC<{
  face: FuwaFaceState;
  width?: number;
  className?: string;
}> = ({ face, width = 180, className }) => {
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
        // Caras estáticas de confianza (lib/fuwaFaces.ts), nunca datos de usuario.
        dangerouslySetInnerHTML={{ __html: FUWA_FACES[face] }}
      />
    </div>
  );
};

export default FuwaFaceMascot;
