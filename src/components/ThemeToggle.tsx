"use client";

import { useTheme } from "@/lib/theme";

/** Icon-only button that flips the app's light/dark appearance. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
          <path
            d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
          <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.5 1.5M17.9 17.9l1.5 1.5M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.5-1.5M17.9 6.1l1.5-1.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
