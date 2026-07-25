import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProviderWrapper } from "@/components/beammp/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BeamMP Host — Local Server + playit.gg Tunnel",
  description:
    "Host a BeamMP dedicated server on your own PC and expose it to the internet through a playit.gg tunnel — all from one desktop GUI.",
  keywords: [
    "BeamMP",
    "BeamNG.drive",
    "playit.gg",
    "game server",
    "tunnel",
    "hosting",
  ],
  authors: [{ name: "BeamMP Host" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProviderWrapper>
          {children}
          <Toaster />
          <SonnerToaster richColors closeButton position="bottom-right" />
        </ThemeProviderWrapper>
      </body>
    </html>
  );
}
