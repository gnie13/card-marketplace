import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/lib/app";
import { Footer, Header } from "@/components/ui";

export const metadata: Metadata = {
  title: "QCCards",
  description: "Trading cards in stock, priced against the live market. Sign in to send an offer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProvider>
          <Header />
          <main className="wrap">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
