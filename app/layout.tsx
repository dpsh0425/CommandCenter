import type { Metadata, Viewport } from "next";
import "./globals.css";

// viewport-fit=cover lets the phone bottom bar pad itself clear of the home indicator (env(safe-area-inset-bottom)).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export const metadata: Metadata = {
  title: { default: "Command Center", template: "%s · Command Center" },
  description: "Grad applications, research, and task tracking — one system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
