import { commands, type Theme } from "@/bindings";

/**
 * Appearance theme handling.
 *
 * Handy already ships a full light palette and a full dark palette (see
 * `App.css`). This module lets the user pick which one is used instead of
 * always following the OS:
 *  - `system` removes the override so the `prefers-color-scheme` media query
 *    governs (the historical behaviour).
 *  - `light` / `dark` set `data-theme` on the document root, whose
 *    higher-specificity CSS selectors win over the media query.
 *
 * The choice is persisted in `AppSettings` (source of truth) and mirrored to
 * localStorage so it can be applied synchronously on boot, before React mounts,
 * avoiding a flash of the wrong palette.
 */

export const THEME_STORAGE_KEY = "handy.theme";

// Ambient (default) leads the list; System stays available for power users.
export const THEME_OPTIONS: Theme[] = ["ambient", "light", "dark", "system"];

const isTheme = (value: unknown): value is Theme =>
  value === "ambient" ||
  value === "system" ||
  value === "light" ||
  value === "dark";

// Ambient theme: dark from 19:00 to 07:00 local time, light otherwise. Kept in
// sync with `ambient_is_dark` in src-tauri/src/shortcut/mod.rs.
const AMBIENT_DARK_START = 19;
const AMBIENT_DARK_END = 7;
const ambientIsDark = (now: Date = new Date()): boolean => {
  const hour = now.getHours();
  return hour >= AMBIENT_DARK_START || hour < AMBIENT_DARK_END;
};

// While `ambient` is active we re-check the time so the palette flips at the
// day/night boundary without needing a restart. Cleared whenever the theme
// changes to anything else.
let ambientTimer: ReturnType<typeof setInterval> | undefined;
const AMBIENT_TICK_MS = 5 * 60 * 1000;

const stopAmbientTimer = (): void => {
  if (ambientTimer !== undefined) {
    clearInterval(ambientTimer);
    ambientTimer = undefined;
  }
};

/** Apply a theme to the document root and remember it for the next launch. */
export const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  stopAmbientTimer();

  if (theme === "system") {
    delete root.dataset.theme;
  } else if (theme === "ambient") {
    const resolve = () => {
      root.dataset.theme = ambientIsDark() ? "dark" : "light";
    };
    resolve();
    ambientTimer = setInterval(resolve, AMBIENT_TICK_MS);
  } else {
    root.dataset.theme = theme;
  }

  try {
    // Persist the *preference* (e.g. "ambient"), not the resolved value, so the
    // boot-time application re-resolves against the current time.
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable (e.g. private mode); the setting still
    // persists in AppSettings, so this only costs a one-frame flash on boot.
  }
};

/** Read the last-applied theme for synchronous boot-time application. */
export const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // ignore
  }
  return "ambient";
};

/** Apply the persisted theme from AppSettings (the source of truth). */
export const syncThemeFromSettings = async (): Promise<void> => {
  try {
    const result = await commands.getAppSettings();
    if (result.status === "ok") {
      applyTheme(result.data.theme ?? "ambient");
    }
  } catch (e) {
    console.warn("Failed to sync theme from settings:", e);
  }
};
