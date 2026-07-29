"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type DisplayLanguage = "ta" | "en";

const STORAGE_KEY = "grocery.language";

type LanguageContextValue = {
  language: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * A persisted, app-wide Tamil/English display preference. Starts as "ta" on
 * both server and first client render (so hydration matches), then picks up
 * any stored choice right after mount.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<DisplayLanguage>("ta");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "ta" || stored === "en") setLanguageState(stored);
  }, []);

  const setLanguage = (next: DisplayLanguage) => {
    setLanguageState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleLanguage = () => setLanguage(language === "ta" ? "en" : "ta");

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

/** Picks which of a Tamil/English name pair leads, and which trails as the caption. */
export function bilingualName(
  nameTa: string,
  nameEn: string,
  language: DisplayLanguage,
): { primary: string; secondary: string } {
  return language === "ta" ? { primary: nameTa, secondary: nameEn } : { primary: nameEn, secondary: nameTa };
}
