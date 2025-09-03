import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dead Internet Detector - AI vs Human Detection Game",
  description: "A thrilling multiplayer social deduction game where players try to identify who is human and who is using AI. Join 8-16 players in creative challenges and strategic voting!",
  keywords: ["multiplayer game", "social deduction", "AI detection", "party game", "online game"],
  authors: [{ name: "Dead Internet Detector Team" }],
  viewport: "width=device-width, initial-scale=1",
  themeColor: "#8b5cf6",
  colorScheme: "dark",
  openGraph: {
    title: "Dead Internet Detector - AI vs Human Detection Game",
    description: "Can you spot who's using AI? Join the ultimate social deduction game!",
    type: "website",
    siteName: "Dead Internet Detector",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dead Internet Detector",
    description: "The ultimate AI vs Human detection game",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning={true}
      >
        {children}
      </body>
    </html>
  );
}
