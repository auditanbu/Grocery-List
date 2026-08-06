"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HOME_TAB: Tab = {
  href: "/",
  label: "Home",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z" />
      {active ? <path d="M3.5 10.5 12 4l8.5 6.5" fill="currentColor" /> : null}
    </svg>
  ),
};

const GROCERY_TAB: Tab = {
  href: "/grocery",
  label: "Grocery",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <path d="M4.5 6h2l1.3 9.6a2 2 0 0 0 2 1.75h6.9a2 2 0 0 0 2-1.65L20 9H6.5" />
      <circle cx="10" cy="19.5" r="1.15" fill={active ? "currentColor" : "none"} />
      <circle cx="15.8" cy="19.5" r="1.15" fill={active ? "currentColor" : "none"} />
    </svg>
  ),
};

const PETROL_TAB: Tab = {
  href: "/petrol",
  label: "Petrol",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <path d="M5.5 20V6a1.5 1.5 0 0 1 1.5-1.5h4.5A1.5 1.5 0 0 1 13 6v14M5.5 20h7.5M5.5 11.5h7.5" />
      <path d="M13 8.5h1.3L16.5 11v5.1a1.15 1.15 0 0 0 2.3 0V13a1 1 0 0 0-1-1H17.5" />
      {active ? <circle cx="9.25" cy="16" r="2.4" fill="currentColor" /> : null}
    </svg>
  ),
};

const MASTER_TAB: Tab = {
  href: "/grocery/master",
  label: "Master List",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" fill={active ? "currentColor" : "none"} />
      <path
        d="M8 9h8M8 12.5h8M8 16h4.5"
        stroke={active ? "#fff" : "currentColor"}
      />
    </svg>
  ),
};

const FAMILY_TAB: Tab = {
  href: "/family",
  label: "Family",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <circle cx="8.5" cy="7" r="2.75" fill={active ? "currentColor" : "none"} />
      <circle cx="16" cy="9.5" r="2.25" fill={active ? "currentColor" : "none"} />
      <path d="M3.5 19v-1.5a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4V19" />
      <path d="M14 19v-1a3.4 3.4 0 0 1 3.2-3.4h.3a3.2 3.2 0 0 1 3 3.2V19" />
    </svg>
  ),
};

const HISTORY_TAB: Tab = {
  href: "/grocery/history",
  label: "History",
  icon: (active) => (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
      <circle cx="12" cy="12" r="8.25" fill={active ? "currentColor" : "none"} />
      <path d="M12 7.5V12l3 2" stroke={active ? "#fff" : "currentColor"} />
    </svg>
  ),
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/grocery") {
    return pathname === "/grocery" || pathname.startsWith("/grocery/lists") || pathname.startsWith("/grocery/items");
  }
  return pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname() ?? "/";
  const inGrocery = pathname.startsWith("/grocery");
  const tabs: Tab[] = inGrocery
    ? [HOME_TAB, GROCERY_TAB, MASTER_TAB, HISTORY_TAB, PETROL_TAB, FAMILY_TAB]
    : [HOME_TAB, GROCERY_TAB, PETROL_TAB, FAMILY_TAB];

  return (
    <>
      {/* iPad / desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ios-separator bg-ios-surface px-4 py-8 md:flex">
        <div className="px-3">
          <p className="text-[22px] font-semibold tracking-tight">Home</p>
          <p className="text-sm text-ios-label-2">Household hub</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-3 rounded-ios px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  active
                    ? "bg-ios-blue-soft text-ios-blue"
                    : "text-ios-label-2 hover:bg-ios-surface-2"
                }`}
              >
                {tab.icon(false)}
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* iPhone: bottom tab bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ios-separator bg-ios-surface/85 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex max-w-lg">
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-[3.75rem] flex-col items-center justify-center gap-0.5 transition-colors active:opacity-60 ${
                    active ? "text-ios-blue" : "text-ios-label-3"
                  }`}
                >
                  {tab.icon(active)}
                  <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
