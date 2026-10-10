import { useId, useState } from "react";

import { applyThemePreference, readThemePreference, type ThemePreference } from "../lib/theme";

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);
  const id = useId();
  return (
    <span className="theme-toggle">
      <label htmlFor={id} className="visually-hidden">
        Color theme
      </label>
      <select
        id={id}
        value={preference}
        onChange={(event) => {
          const next = event.target.value as ThemePreference;
          applyThemePreference(next);
          setPreference(next);
        }}
      >
        <option value="system">Auto theme</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </span>
  );
}
