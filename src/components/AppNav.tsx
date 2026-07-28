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

const TABS: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
        <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z" />
        {active ? <path d="M3.5 10.5 12 4l8.5 6.5" fill="currentColor" /> : null}
      </svg>
    ),
  },
  {
    href: "/master",
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
  },
  {
    href: "/history",
    label: "History",
    icon: (active) => (
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden {...strokeProps}>
        <circle cx="12" cy="12" r="8.25" fill={active ? "currentColor" : "none"} />
        <path d="M12 7.5V12l3 2" stroke={active ? "#fff" : "currentColor"} />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/lists") : pathname.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {/* iPad / desktop: persistent sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ios-separator bg-ios-surface px-4 py-8 md:flex">
        <div className="px-3">
          <p className="text-[22px] font-semibold tracking-tight">Grocery</p>
          <p className="text-sm text-ios-label-2">Monthly planner</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {TABS.map((tab) => {
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
          {TABS.map((tab) => {
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
