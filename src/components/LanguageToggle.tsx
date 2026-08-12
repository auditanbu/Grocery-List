"use client";

import { LANGUAGE_CODE, LANGUAGE_NAME, useLanguage } from "@/lib/language";

/**
 * Cycles the app's display preference: Tamil → Tanglish → English. The
 * current language's short code rides next to the icon — with three states
 * an icon alone no longer says which one you're on.
 */
export function LanguageToggle() {
  const { language, nextLanguage, toggleLanguage } = useLanguage();
  const label = `${LANGUAGE_NAME[language]} — switch to ${LANGUAGE_NAME[nextLanguage]}`;

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={label}
      title={label}
      className="flex h-9 flex-none items-center gap-1 rounded-full bg-ios-surface px-2.5 text-ios-blue shadow-ios transition active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 flex-none" aria-hidden>
        <path
          d="M4 6h9M8.5 4v2.5S8 11 4.5 13.5M6.5 10c1 1.5 3 2.8 5.5 3.3M14 20l4-9 4 9M15.3 17h5.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[13px] font-semibold leading-none">{LANGUAGE_CODE[language]}</span>
    </button>
  );
}
