/*
 * Category icons and colours, keyed by BudgetCategory.iconKey / colorKey.
 * Hand-written inline SVG, matching the rest of the app (no icon library).
 */

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type IconProps = { className?: string };

function Icon({ className = "h-5 w-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...strokeProps}>
      {children}
    </svg>
  );
}

export const CATEGORY_ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  home: (props) => (
    <Icon {...props}>
      <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-3.5v-6h-7v6H5A1.5 1.5 0 0 1 3.5 19z" />
    </Icon>
  ),
  bolt: (props) => (
    <Icon {...props}>
      <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />
    </Icon>
  ),
  shield: (props) => (
    <Icon {...props}>
      <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" />
      <path d="M9.2 12.2 11.3 14.3 15 10.5" />
    </Icon>
  ),
  wifi: (props) => (
    <Icon {...props}>
      <path d="M4 9.5a12 12 0 0 1 16 0M7 13a7.6 7.6 0 0 1 10 0" />
      <circle cx="12" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  ),
  phone: (props) => (
    <Icon {...props}>
      <rect x="7" y="3" width="10" height="18" rx="2.4" />
      <path d="M10.8 18h2.4" />
    </Icon>
  ),
  cart: (props) => (
    <Icon {...props}>
      <path d="M4.5 6h2l1.3 9.6a2 2 0 0 0 2 1.75h6.9a2 2 0 0 0 2-1.65L20 9H6.5" />
      <circle cx="10" cy="19.5" r="1.15" />
      <circle cx="15.8" cy="19.5" r="1.15" />
    </Icon>
  ),
  book: (props) => (
    <Icon {...props}>
      <path d="M5 4.5h6a2.5 2.5 0 0 1 2.5 2.5v12A2 2 0 0 0 11.5 17H5z" />
      <path d="M19 4.5h-6a2.5 2.5 0 0 0-2.5 2.5" />
    </Icon>
  ),
  wrench: (props) => (
    <Icon {...props}>
      <path d="M15.5 3.5a5 5 0 0 0-4.4 7.3L3.8 18.1a1.8 1.8 0 0 0 2.5 2.5l7.3-7.3a5 5 0 0 0 6-6.8l-2.7 2.7-2.6-.7-.7-2.6z" />
    </Icon>
  ),
  other: (props) => (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.8v4.7l3 1.8" />
    </Icon>
  ),
};

export function CategoryIcon({
  iconKey,
  className,
}: {
  iconKey: string;
  className?: string;
}): React.ReactElement {
  const Chosen = CATEGORY_ICONS[iconKey] ?? CATEGORY_ICONS.other;
  return <Chosen className={className} />;
}

/*
 * Complete literal class strings — Tailwind scans source text, so an
 * interpolated `bg-ios-${key}-soft` would simply never be emitted.
 */
export const COLOR_CLASSES: Record<string, string> = {
  blue: "bg-ios-blue-soft text-ios-blue",
  green: "bg-ios-green-soft text-ios-green",
  red: "bg-ios-red-soft text-ios-red",
  orange: "bg-ios-orange/15 text-ios-orange",
  purple: "bg-ios-blue-soft text-ios-blue",
  grey: "bg-ios-surface-2 text-ios-label-2",
};

export function colorClass(colorKey: string): string {
  return COLOR_CLASSES[colorKey] ?? COLOR_CLASSES.blue;
}

export const COLOR_KEYS = ["blue", "green", "orange", "red", "purple", "grey"] as const;
export const ICON_KEYS = Object.keys(CATEGORY_ICONS);
