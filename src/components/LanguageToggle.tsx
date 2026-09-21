"use client";

import { LANGUAGE_CODE, LANGUAGE_NAME, useLanguage } from "@/lib/language";

/**
 * Cycles the app's display preference: Tamil → Tanglish → English.
 *
 * Sized to match the other header icons, and shows only the current
 * language's short code — with the code right there a globe glyph adds
 * nothing, and dropping it is what lets the control be a circle rather than
 * a wider pill. The full names live in the title/aria-label.
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
      className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
    >
      {/* The Tamil code is one glyph and reads small beside "EN"/"Tg". */}
      <span
        className={`font-bold leading-none ${language === "ta" ? "text-[16px]" : "text-[13px]"}`}
      >
        {LANGUAGE_CODE[language]}
      </span>
    </button>
  );
}
