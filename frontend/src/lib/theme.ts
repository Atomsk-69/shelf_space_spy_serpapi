export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "theme-preference";

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can be blocked; fall back to following the OS.
  }
  return "system";
}

/** Pins <html data-theme> for light/dark; "system" removes it so the OS preference applies. */
export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preference);
  try {
    if (preference === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Ignore storage failures; the choice still applies for this page view.
  }
}
