import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AppNav } from "@/components/AppNav";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { AdminProvider } from "@/lib/admin-context";
import { isAdminSession } from "@/lib/admin";
import { LanguageProvider } from "@/lib/language";
import { RateBasisProvider } from "@/lib/rate-basis";
import { ThemeProvider, noFlashThemeScript } from "@/lib/theme";
import "./globals.css";

/**
 * Tamil was never actually shipped: the font stack asked for "Noto Sans Tamil"
 * but nothing loaded it, so every device fell back to whatever Tamil face the
 * OS happened to have — Noto on Android, Tamil Sangam MN on iOS.
 *
 * Loaded from a committed file rather than next/font/google, for two reasons
 * found the hard way:
 *
 *  - `subsets: ["tamil"]` did not restrict anything. next/font emitted all
 *    three of Google's faces — tamil, latin-ext and latin — so Tiro Tamil
 *    served Latin glyphs too. Latin only avoids it because the system fonts
 *    earlier in the stack win; on a device without them the entire UI turns
 *    serif. The explicit unicode-range below makes that impossible rather
 *    than unlikely.
 *  - It removes the build-time download, so the Docker build no longer needs
 *    to reach fonts.gstatic.com.
 *
 * The range is Google's own for its Tamil subset: Tamil block, the two
 * danda marks, the joiners, ₹, and the dotted circle used to show a bare
 * combining mark. `adjustFontFallback` is off because next/font's generated
 * fallback is a metric-matched *system* face — `local(Times New Roman)` for a
 * serif — which would sit inside the variable and reintroduce the same
 * problem from the other direction.
 *
 * Tiro Tamil ships regular only, so the medium/semibold used in rows and
 * headings is synthesised by the browser.
 */
const tamil = localFont({
  src: "./fonts/tiro-tamil-tamil.woff2",
  variable: "--font-tamil",
  display: "swap",
  weight: "400",
  adjustFontFallback: false,
  declarations: [
    { prop: "unicode-range", value: "U+0964-0965, U+0B82-0BFA, U+200C-200D, U+20B9, U+25CC" },
  ],
});

export const metadata: Metadata = {
  title: "Home",
  description: "Grocery lists, petrol spending, and more — all in one household hub.",
  applicationName: "Home",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Home",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#f2f2f7",
  width: "device-width",
  initialScale: 1,
  // Lets the app paint under the notch and home indicator when installed.
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminSession();

  return (
    <html lang="en" className={`h-full antialiased ${tamil.variable}`}>
      <head>
        {/* Applies the stored/system theme before paint — avoids a flash of the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="flex min-h-full flex-col md:flex-row">
        <ThemeProvider>
          <AdminProvider initialIsAdmin={isAdmin}>
            <LanguageProvider>
              <RateBasisProvider>
                <AppNav />
                <div className="flex-1 md:pl-64">
                  {/* Bottom padding clears the tab bar on mobile. */}
                  <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-12 md:pt-8">
                    {children}
                  </main>
                </div>
              </RateBasisProvider>
            </LanguageProvider>
          </AdminProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
