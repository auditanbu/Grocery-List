"use client";

import { useLanguage } from "@/lib/language";

/** Icon-only button that flips the app's Tamil/English display preference. */
export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={`Switch to ${language === "ta" ? "English" : "Tamil"}`}
      title={`Switch to ${language === "ta" ? "English" : "Tamil"}`}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
        <path
          d="M4 6h9M8.5 4v2.5S8 11 4.5 13.5M6.5 10c1 1.5 3 2.8 5.5 3.3M14 20l4-9 4 9M15.3 17h5.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
