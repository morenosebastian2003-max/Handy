/**
 * Respuesta táctil tipo iPhone (maqueta command-center): un único listener
 * global de mousedown que dibuja un ripple menta sobre cualquier elemento
 * interactivo. Solo se instala en la ventana principal (App.tsx) — la
 * burbuja flotante tiene su propia interacción y no lo usa.
 */

const RIPPLE_SELECTOR = 'button, [role="button"], .nav-item';

export function installRipple(): () => void {
  const onMouseDown = (e: MouseEvent) => {
    const target = e.target as Element | null;
    const el = target?.closest?.(RIPPLE_SELECTOR) as HTMLElement | null;
    if (!el || (el as HTMLButtonElement).disabled) return;

    const r = el.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    const s = document.createElement("span");
    s.className = "ripple";
    s.style.width = s.style.height = `${d}px`;
    s.style.left = `${e.clientX - r.left - d / 2}px`;
    s.style.top = `${e.clientY - r.top - d / 2}px`;

    const style = getComputedStyle(el);
    if (style.position === "static") el.style.position = "relative";
    if (style.overflow !== "hidden") el.style.overflow = "hidden";

    el.appendChild(s);
    window.setTimeout(() => s.remove(), 520);
  };

  document.addEventListener("mousedown", onMouseDown);
  return () => document.removeEventListener("mousedown", onMouseDown);
}
