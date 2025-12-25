import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GenAm Coach - Alex",
  description: "Real-time General American pronunciation coaching with Gemini 2.5 Flash Native Audio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GenAm Coach",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GenAm Coach" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
