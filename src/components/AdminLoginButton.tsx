"use client";

import { useState, useTransition } from "react";

import { Sheet } from "@/components/Sheet";
import { useAdmin } from "@/lib/admin-context";

/**
 * Icon that unlocks admin actions with a PIN. Family/public members never
 * need to touch this — everything they can already do stays available.
 */
export function AdminLoginButton() {
  const { isAdmin, login, logout } = useAdmin();
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await login(pin);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPin("");
      setOpen(false);
    });
  };

  if (isAdmin) {
    return (
      <button
        type="button"
        onClick={logout}
        aria-label="Log out of admin"
        title="Log out of admin"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-blue text-white shadow-ios transition active:scale-95"
      >
        <LockIcon locked={false} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Admin login"
        title="Admin login"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios transition active:scale-95"
      >
        <LockIcon locked={true} />
      </button>

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false);
          setPin("");
          setError(null);
        }}
        title="Admin login"
        subtitle="Enter the PIN to unlock admin actions on this device."
        footer={
          <button
            type="button"
            onClick={submit}
            disabled={pending || pin.length === 0}
            className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {pending ? "Checking…" : "Unlock"}
          </button>
        }
      >
        <div className="space-y-3 pb-2">
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="PIN"
            className="h-14 w-full rounded-ios bg-ios-surface-2 px-4 text-center text-[24px] tracking-[0.5em] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
          />
          {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
      <rect
        x="5"
        y="11"
        width="14"
        height="9"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      {locked ? (
        <path
          d="M8 11V8a4 4 0 0 1 8 0v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M8 11V8a4 4 0 0 1 7.5-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
