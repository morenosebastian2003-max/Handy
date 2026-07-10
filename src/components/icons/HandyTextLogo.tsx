import React from "react";

// Wordmark de Fuwa. Se conserva el nombre del componente (HandyTextLogo) para
// no tocar los imports existentes; el contenido es el logotipo "fuwa" en un
// estilo redondeado acorde a la marca. Usa currentColor para adaptarse al tema.
const HandyTextLogo = ({
  width,
  height,
  className,
}: {
  width?: number;
  height?: number;
  className?: string;
}) => {
  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox="0 0 300 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Fuwa"
    >
      <text
        x="0"
        y="82"
        fill="currentColor"
        style={{
          fontFamily:
            "'Fredoka', 'Baloo 2', 'Nunito', ui-rounded, 'Segoe UI Rounded', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: "96px",
          letterSpacing: "-2px",
        }}
      >
        fuwa
      </text>
    </svg>
  );
};

export default HandyTextLogo;
