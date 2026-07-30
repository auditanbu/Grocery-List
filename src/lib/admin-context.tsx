"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { adminLogin, adminLogout } from "./admin-actions";

type AdminContextValue = {
  isAdmin: boolean;
  login: (pin: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

/**
 * Seeded from the httpOnly admin cookie, read server-side in the root
 * layout — the cookie itself never reaches client JS, so `isAdmin` here is
 * a display hint only. Every admin-only action re-checks the cookie
 * server-side regardless of what this context says.
 */
export function AdminProvider({
  initialIsAdmin,
  children,
}: {
  initialIsAdmin: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(initialIsAdmin);

  const login = async (pin: string) => {
    const result = await adminLogin(pin);
    if (result.ok) {
      setIsAdmin(true);
      router.refresh();
      return { ok: true as const };
    }
    return { ok: false as const, error: result.error };
  };

  const logout = () => {
    setIsAdmin(false);
    adminLogout().then(() => router.refresh());
  };

  return <AdminContext.Provider value={{ isAdmin, login, logout }}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}
