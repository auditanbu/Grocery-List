import type { Metadata, Viewport } from "next";

import { AppNav } from "@/components/AppNav";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { AdminProvider } from "@/lib/admin-context";
import { isAdminSession } from "@/lib/admin";
import { LanguageProvider } from "@/lib/language";
import { ThemeProvider, noFlashThemeScript } from "@/lib/theme";
import "./globals.css";

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
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Applies the stored/system theme before paint — avoids a flash of the wrong one. */}
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="flex min-h-full flex-col md:flex-row">
        <ThemeProvider>
          <AdminProvider initialIsAdmin={isAdmin}>
            <LanguageProvider>
              <AppNav />
              <div className="flex-1 md:pl-64">
                {/* Bottom padding clears the tab bar on mobile. */}
                <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:pb-12 md:pt-8">
                  {children}
                </main>
              </div>
            </LanguageProvider>
          </AdminProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
