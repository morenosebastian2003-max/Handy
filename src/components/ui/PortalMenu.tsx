import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

interface PortalMenuProps {
  /** The element the menu is positioned under (usually the trigger's wrapper). */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
  /** Classes for the menu surface (background, border, radius, max-height…). */
  className?: string;
}

/**
 * Renders a dropdown menu in a <body>-level portal with fixed positioning.
 *
 * Why: the liquid-glass cards use `backdrop-filter`, which creates a stacking
 * context per card. An inline `absolute` menu (even with a high z-index and an
 * opaque background) gets painted BEHIND the sibling card below it, so it looks
 * transparent / clipped. Portaling to <body> escapes every card's stacking
 * context so the menu always paints on top.
 *
 * Click-outside: consumers listen for `mousedown` on `document`; this menu
 * stops mousedown propagation so a click inside it never reaches that listener
 * (which would close the menu before an option's onClick lands), while a click
 * truly outside still closes it.
 */
export const PortalMenu: React.FC<PortalMenuProps> = ({
  anchorRef,
  open,
  children,
  className = "",
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (anchorRef.current) {
        setRect(anchorRef.current.getBoundingClientRect());
      }
    };
    update();
    // `true` captures scrolls on any ancestor (the settings panel scrolls).
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  if (!open || !rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={className}
      style={{
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
};
