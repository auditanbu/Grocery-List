"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { Sheet } from "@/components/Sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAdmin } from "@/lib/admin-context";
import { formatDate, monthKeyToLabel, shiftMonthKey } from "@/lib/dates";
import { formatPrice } from "@/lib/units";
import { createFuelEntry, deleteFuelEntry, setFuelBudget } from "@/lib/petrol/actions";
import type { FuelEntryDTO, FuelSummaryDTO, VehicleType } from "@/lib/petrol/types";

type PetrolViewProps = {
  summary: FuelSummaryDTO;
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  TWO_WHEELER: "Two Wheeler",
  CAR: "Car",
};

function VehicleIcon({ vehicle, className }: { vehicle: VehicleType; className?: string }) {
  if (vehicle === "CAR") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          d="M4 16.5v-3.2a1.5 1.5 0 0 1 .3-.9l2-2.7a2 2 0 0 1 1.6-.8h8.2a2 2 0 0 1 1.6.8l2 2.7a1.5 1.5 0 0 1 .3.9v3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="2.5"
          y="14.5"
          width="19"
          height="4.5"
          rx="1.3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <circle cx="7" cy="19" r="1.4" fill="currentColor" />
        <circle cx="17" cy="19" r="1.4" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="5.5" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18.5" cy="17" r="3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 17 9 10h5l3.5 4M9 10 7.5 7h-2M13 10l1.5 3.5h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PetrolView({ summary }: PetrolViewProps) {
  const router = useRouter();
  const { isAdmin } = useAdmin();
  const [addOpen, setAddOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCurrentMonth = summary.monthKey === monthKeyOfNow();
  const percent =
    summary.budget && summary.budget > 0 ? Math.min(100, Math.round((summary.spent / summary.budget) * 100)) : 0;
  const overBudget = summary.remaining !== null && summary.remaining < 0;
  const barColor = overBudget ? "bg-ios-red" : percent >= 85 ? "bg-ios-orange" : "bg-ios-blue";

  const remove = (entry: FuelEntryDTO) => {
    if (!window.confirm(`Delete this ${formatPrice(entry.amount)} refuel entry?`)) return;
    startTransition(async () => {
      const result = await deleteFuelEntry(entry.id);
      if (!result.ok) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            {monthKeyToLabel(summary.monthKey)}
          </p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Petrol Card</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      <div className="flex items-center justify-between px-1">
        <Link
          href={`/petrol?month=${shiftMonthKey(summary.monthKey, -1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Previous month"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <p className="text-[15px] font-medium text-ios-label-2">{monthKeyToLabel(summary.monthKey)}</p>
        <Link
          href={`/petrol?month=${shiftMonthKey(summary.monthKey, 1)}`}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ios-surface text-ios-blue shadow-ios active:scale-95"
          aria-label="Next month"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <section className="ios-card p-5">
        {summary.budget === null ? (
          <>
            <p className="text-[13px] text-ios-label-2">Spent this month</p>
            <p className="text-[28px] font-bold tabular-nums tracking-tight">{formatPrice(summary.spent)}</p>
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setBudgetOpen(true)}
                className="mt-3 h-10 rounded-full bg-ios-surface-2 px-4 text-[14px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
              >
                Set a monthly limit
              </button>
            ) : (
              <p className="mt-1 text-[13px] text-ios-label-3">No monthly limit set yet.</p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-ios-label-2">Spent of {formatPrice(summary.budget)}</p>
                <p className="text-[28px] font-bold tabular-nums tracking-tight">{formatPrice(summary.spent)}</p>
              </div>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setBudgetOpen(true)}
                  className="h-9 flex-none rounded-full bg-ios-surface-2 px-3 text-[13px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
                >
                  Edit limit
                </button>
              ) : null}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ios-surface-2">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${barColor}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className={`mt-2 text-[14px] font-medium ${overBudget ? "text-ios-red" : "text-ios-label-2"}`}>
              {overBudget
                ? `Over budget by ${formatPrice(Math.abs(summary.remaining as number))}`
                : `${formatPrice(summary.remaining as number)} remaining`}
            </p>
          </>
        )}
      </section>

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
        Add refuel
      </button>

      {error ? (
        <p className="rounded-ios bg-ios-red-soft px-4 py-3 text-[14px] text-ios-red">{error}</p>
      ) : null}

      <section>
        <h2 className="px-1 pb-2 text-[20px] font-semibold tracking-tight">
          {isCurrentMonth ? "This month" : "Entries"}
        </h2>
        {summary.entries.length === 0 ? (
          <p className="ios-card p-6 text-center text-[15px] text-ios-label-2">
            No refuels logged for {monthKeyToLabel(summary.monthKey)}.
          </p>
        ) : (
          <ul className="ios-card divide-y divide-ios-separator overflow-hidden">
            {summary.entries.map((entry) => {
              const date = new Date(entry.refueledAt);
              return (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ios-blue-soft text-ios-blue">
                    <VehicleIcon vehicle={entry.vehicleType} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold tabular-nums">
                      {formatPrice(entry.amount)}
                      <span className="ml-1.5 text-[13px] font-normal text-ios-label-2">
                        {VEHICLE_LABEL[entry.vehicleType]}
                      </span>
                    </span>
                    <span className="block truncate text-[13px] text-ios-label-2">
                      {formatDate(date)} ·{" "}
                      {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      {entry.latitude !== null && entry.longitude !== null ? (
                        <>
                          {" · "}
                          <a
                            href={`https://maps.google.com/?q=${entry.latitude},${entry.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-ios-blue active:opacity-60"
                          >
                            Location
                          </a>
                        </>
                      ) : null}
                    </span>
                  </span>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => remove(entry)}
                      disabled={pending}
                      aria-label="Delete entry"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ios-red transition active:bg-ios-red-soft disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden>
                        <path
                          d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddEntrySheet open={addOpen} onClose={() => setAddOpen(false)} />
      <BudgetSheet open={budgetOpen} onClose={() => setBudgetOpen(false)} current={summary.budget} />
    </div>
  );
}

function monthKeyOfNow(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

type LocationStatus = "idle" | "loading" | "done" | "denied" | "unsupported";

function AddEntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [vehicleType, setVehicleType] = useState<VehicleType>("TWO_WHEELER");
  const [amount, setAmount] = useState("");
  const [refueledAt, setRefueledAt] = useState(() => toLocalDateTimeInputValue(new Date()));
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const captureLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationStatus("done");
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Reset the form and kick off geolocation capture each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setVehicleType("TWO_WHEELER");
    setAmount("");
    setRefueledAt(toLocalDateTimeInputValue(new Date()));
    setError(null);
    setCoords(null);
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsed = Number.parseFloat(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed > 0;

  const save = () => {
    if (!valid) {
      setError("Enter how much you refueled for.");
      return;
    }
    startTransition(async () => {
      const result = await createFuelEntry({
        vehicleType,
        amount: parsed,
        // `refueledAt` is a naive datetime-local string with no timezone; resolve it
        // against the browser's local timezone here, since the server's timezone
        // (UTC on Railway) would otherwise misinterpret the same string.
        refueledAt: new Date(refueledAt).toISOString(),
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add refuel"
      subtitle="Location is captured automatically if your browser allows it."
      footer={
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save refuel"}
        </button>
      }
    >
      <div className="space-y-4 pb-3">
      <div>
        <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">Vehicle</p>
        <div className="flex gap-2">
          {(["TWO_WHEELER", "CAR"] as VehicleType[]).map((vehicle) => (
            <button
              key={vehicle}
              type="button"
              onClick={() => setVehicleType(vehicle)}
              className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-ios text-[15px] font-medium transition active:scale-[0.98] ${
                vehicleType === vehicle
                  ? "bg-ios-blue text-white"
                  : "bg-ios-surface-2 text-ios-label-2 ring-1 ring-inset ring-ios-separator"
              }`}
            >
              <VehicleIcon vehicle={vehicle} className="h-5 w-5" />
              {VEHICLE_LABEL[vehicle]}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-[13px] font-medium text-ios-label-2">Amount</span>
        <div className="mt-1.5 flex items-center rounded-ios bg-ios-surface-2 px-4 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
          <span className="text-[22px] font-semibold text-ios-label-2">₹</span>
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="h-14 w-full bg-transparent px-2 text-[22px] font-semibold tabular-nums outline-none"
          />
        </div>
      </label>

      <label className="block">
        <span className="text-[13px] font-medium text-ios-label-2">Date &amp; time</span>
        <input
          type="datetime-local"
          value={refueledAt}
          onChange={(event) => setRefueledAt(event.target.value)}
          className="mt-1.5 h-12 w-full rounded-ios bg-ios-surface-2 px-4 text-[16px] outline-none ring-1 ring-inset ring-ios-separator focus:ring-2 focus:ring-ios-blue"
        />
      </label>

      <div>
        <p className="pb-1.5 text-[13px] font-medium text-ios-label-2">Location</p>
        <div className="flex items-center gap-2 rounded-ios bg-ios-surface-2 px-4 py-3 ring-1 ring-inset ring-ios-separator">
          {locationStatus === "loading" ? (
            <span className="text-[14px] text-ios-label-2">Getting your location…</span>
          ) : locationStatus === "done" && coords ? (
            <span className="text-[14px] text-ios-label-2">
              📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </span>
          ) : locationStatus === "denied" ? (
            <span className="text-[14px] text-ios-label-2">Location unavailable — that&apos;s fine, skipping it.</span>
          ) : locationStatus === "unsupported" ? (
            <span className="text-[14px] text-ios-label-2">Location isn&apos;t supported on this device.</span>
          ) : (
            <span className="text-[14px] text-ios-label-2">Not captured yet.</span>
          )}
          <button
            type="button"
            onClick={captureLocation}
            className="ml-auto h-8 flex-none rounded-full bg-ios-surface px-3 text-[13px] font-medium text-ios-blue ring-1 ring-inset ring-ios-separator active:scale-95"
          >
            Retry
          </button>
        </div>
      </div>

      {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}

function BudgetSheet({
  open,
  onClose,
  current,
}: {
  open: boolean;
  onClose: () => void;
  current: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(current !== null ? String(current) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = Number.parseFloat(amount.replace(",", "."));
  const valid = Number.isFinite(parsed) && parsed >= 0;

  const save = () => {
    if (!valid) {
      setError("Enter a valid amount.");
      return;
    }
    startTransition(async () => {
      const result = await setFuelBudget(parsed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
      router.refresh();
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Monthly limit"
      subtitle="Applies to every month going forward."
      footer={
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex h-12 w-full items-center justify-center rounded-ios bg-ios-blue text-[17px] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save limit"}
        </button>
      }
    >
      <div className="space-y-3 pb-2">
        <label className="block">
          <span className="text-[13px] font-medium text-ios-label-2">Amount</span>
          <div className="mt-1.5 flex items-center rounded-ios bg-ios-surface-2 px-4 ring-1 ring-inset ring-ios-separator focus-within:ring-2 focus-within:ring-ios-blue">
            <span className="text-[22px] font-semibold text-ios-label-2">₹</span>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") save();
              }}
              placeholder="0.00"
              className="h-14 w-full bg-transparent px-2 text-[22px] font-semibold tabular-nums outline-none"
            />
          </div>
        </label>
        {error ? <p className="text-[14px] text-ios-red">{error}</p> : null}
      </div>
    </Sheet>
  );
}
