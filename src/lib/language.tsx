"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * "tl" is Tanglish — the Tamil name written in Latin script
 * ("Kadalai Paruppu"), for anyone in the family who speaks Tamil but
 * reads the script slowly.
 */
export type DisplayLanguage = "ta" | "tl" | "en";

const STORAGE_KEY = "grocery.language";

/** Order the toggle cycles through: Tamil → Tanglish → English → Tamil. */
export const LANGUAGE_ORDER: DisplayLanguage[] = ["ta", "tl", "en"];

/** Short code shown on the toggle button. */
export const LANGUAGE_CODE: Record<DisplayLanguage, string> = {
  ta: "த",
  tl: "Tg",
  en: "EN",
};

export const LANGUAGE_NAME: Record<DisplayLanguage, string> = {
  ta: "Tamil",
  tl: "Tanglish",
  en: "English",
};

function isDisplayLanguage(value: string | null): value is DisplayLanguage {
  return value === "ta" || value === "tl" || value === "en";
}

type LanguageContextValue = {
  language: DisplayLanguage;
  /** The one the toggle would move to next — used for its label. */
  nextLanguage: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * A persisted, app-wide display preference. Starts as "ta" on both server
 * and first client render (so hydration matches), then picks up any stored
 * choice right after mount.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DisplayLanguage>("ta");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isDisplayLanguage(stored)) setLanguageState(stored);
  }, []);

  const setLanguage = (next: DisplayLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const nextLanguage =
    LANGUAGE_ORDER[(LANGUAGE_ORDER.indexOf(language) + 1) % LANGUAGE_ORDER.length];

  const toggleLanguage = () => setLanguage(nextLanguage);

  return (
    <LanguageContext.Provider value={{ language, nextLanguage, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** The three names an item can be shown under. */
export type NamedItem = {
  nameTa: string;
  nameEn: string;
  nameTl?: string | null;
};

/**
 * Picks which name leads and which trails as the caption. Tanglish falls
 * back to the Tamil name when none has been entered yet, so a half-filled
 * catalogue still reads sensibly rather than showing blanks.
 */
export function displayName(
  item: NamedItem,
  language: DisplayLanguage,
): { primary: string; secondary: string } {
  const nameTl = item.nameTl?.trim();
  switch (language) {
    case "en":
      return { primary: item.nameEn, secondary: item.nameTa };
    case "tl":
      return { primary: nameTl || item.nameTa, secondary: item.nameEn };
    default:
      return { primary: item.nameTa, secondary: item.nameEn };
  }
}

/** Single line, "primary · secondary" — for sheet subtitles and aria labels. */
export function displayNameLine(item: NamedItem, language: DisplayLanguage): string {
  const name = displayName(item, language);
  return name.primary === name.secondary ? name.primary : `${name.primary} · ${name.secondary}`;
}
