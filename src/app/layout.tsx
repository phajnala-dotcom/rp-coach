import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RP Native Coach - Alex",
  description: "Real-time Modern RP pronunciation coaching with Gemini 2.5 Flash Native Audio",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
