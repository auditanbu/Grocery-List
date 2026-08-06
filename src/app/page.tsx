import Link from "next/link";

import { AdminLoginButton } from "@/components/AdminLoginButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

const MODULES = [
  {
    href: "/grocery",
    name: "Grocery",
    description: "Plan monthly lists, shop with price history, export a print sheet.",
    accent: "bg-ios-blue-soft text-ios-blue",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path
          d="M4 5h2l1.2 10.2a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.7L20 8H6.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="10" cy="20" r="1.4" fill="currentColor" />
        <circle cx="16.5" cy="20" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/petrol",
    name: "Petrol Card",
    description: "Log refuels by vehicle, track spend against a monthly budget.",
    accent: "bg-ios-orange/15 text-ios-orange",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <path
          d="M6 20V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14M6 20h9M6 11h9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 9.5h1.6L19 12v5.2a1.3 1.3 0 0 1-2.6 0V15a1 1 0 0 0-1-1H15"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/budget",
    name: "Family Budget",
    description: "Track recurring bills on a calendar, mark them paid, get reminders.",
    accent: "bg-ios-green-soft text-ios-green",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
        <rect
          x="3.5"
          y="5"
          width="17"
          height="15"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M3.5 9.5h17M8 3.5v3M16 3.5v3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="8.5" cy="13" r="1.1" fill="currentColor" />
        <circle cx="12" cy="13" r="1.1" fill="currentColor" />
        <circle cx="8.5" cy="16.5" r="1.1" fill="currentColor" />
      </svg>
    ),
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3 pt-2">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-wide text-ios-label-2">
            Household
          </p>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight">Home</h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <AdminLoginButton />
          <ThemeToggle />
        </div>
      </header>

      <section className="space-y-3">
        {MODULES.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="ios-card flex items-center gap-4 p-5 active:opacity-70"
          >
            <span className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl ${module.accent}`}>
              {module.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[19px] font-semibold tracking-tight">{module.name}</span>
              <span className="block text-[14px] text-ios-label-2">{module.description}</span>
            </span>
            <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none text-ios-label-3" aria-hidden>
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        ))}
      </section>
    </div>
  );
}
