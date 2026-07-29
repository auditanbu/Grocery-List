import type { Metadata, Viewport } from "next";

import { AppNav } from "@/components/AppNav";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { LanguageProvider } from "@/lib/language";
import { ThemeProvider, noFlashThemeScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grocery Planner",
  description: "Plan, print and shop your monthly grocery list.",
  applicationName: "Grocery Planner",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Grocery",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon.svg",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Applies the stored/system theme before paint — avoids a flash of the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="flex min-h-full flex-col md:flex-row">
        <ThemeProvider>
          <LanguageProvider>
            <AppNav />
            <div className="flex-1 md:pl-64">
              {/* Bottom padding clears the tab bar on mobile. */}
              <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-12 md:pt-8">
                {children}
              </main>
            </div>
          </LanguageProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
