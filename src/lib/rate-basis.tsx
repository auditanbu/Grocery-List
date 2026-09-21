"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { DEFAULT_RATE_BASIS, RATE_BASIS_ORDER, type RateBasis } from "@/lib/units";

const STORAGE_KEY = "grocery.rateBasis";

function isRateBasis(value: number): value is RateBasis {
  return (RATE_BASIS_ORDER as readonly number[]).includes(value);
}

function parseStored(raw: string | null): RateBasis | null {
  if (raw === null) return null;
  const value = Number.parseInt(raw, 10);
  return isRateBasis(value) ? value : null;
}

type RateBasisContextValue = {
  basis: RateBasis;
  /** The one a tap would move to — used for the button's label. */
  nextBasis: RateBasis;
  setBasis: (basis: RateBasis) => void;
  cycleBasis: () => void;
};

const RateBasisContext = createContext<RateBasisContextValue | null>(null);

/**
 * Which pack size rates are quoted against — per kg, or per 500/250/100 g.
 * A persisted, app-wide preference: the size you think in at the shop
 * doesn't change item by item.
 *
 * Starts at per kg on both server and first client render (so hydration
 * matches), then picks up any stored choice right after mount — the same
 * shape as the language and theme preferences.
 */
export function RateBasisProvider({ children }: { children: ReactNode }) {
  const [basis, setBasisState] = useState<RateBasis>(DEFAULT_RATE_BASIS);

  useEffect(() => {
    const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
    if (stored !== null) setBasisState(stored);
  }, []);

  const setBasis = (next: RateBasis) => {
    setBasisState(next);
    window.localStorage.setItem(STORAGE_KEY, String(next));
  };

  const nextBasis =
    RATE_BASIS_ORDER[(RATE_BASIS_ORDER.indexOf(basis) + 1) % RATE_BASIS_ORDER.length];

  const cycleBasis = () => setBasis(nextBasis);

  return (
    <RateBasisContext.Provider value={{ basis, nextBasis, setBasis, cycleBasis }}>
      {children}
    </RateBasisContext.Provider>
  );
}

export function useRateBasis(): RateBasisContextValue {
  const ctx = useContext(RateBasisContext);
  if (!ctx) throw new Error("useRateBasis must be used within a RateBasisProvider");
  return ctx;
}
