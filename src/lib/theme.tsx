"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "grocery.theme";
const LIGHT_CHROME_COLOR = "#f2f2f7";
const DARK_CHROME_COLOR = "#000000";

/**
 * Sets data-theme before paint so there's no flash of the wrong theme.
 * Runs as an inline script in the document head — see RootLayout.
 */
export const noFlashThemeScript = `(function () {
  try {
    var stored = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();`;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * A persisted, app-wide light/dark preference. Starts as "light" on both
 * server and first client render (matching the inline script's fallback
 * isn't guaranteed, so this just needs to not fight it before the effect
 * below reconciles from the real, already-applied data-theme attribute).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // The inline head script already set the real attribute before paint;
    // read it back so state — and the browser-chrome color — match what's
    // already on screen.
    const applied = document.documentElement.getAttribute("data-theme");
    if (applied === "light" || applied === "dark") {
      setThemeState(applied);
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", applied === "dark" ? DARK_CHROME_COLOR : LIGHT_CHROME_COLOR);
    }
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", next === "dark" ? DARK_CHROME_COLOR : LIGHT_CHROME_COLOR);
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
