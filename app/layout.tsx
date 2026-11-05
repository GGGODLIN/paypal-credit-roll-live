import type { Metadata } from "next";
import { Archivo, Bodoni_Moda, Courier_Prime, Geist_Mono } from "next/font/google";
import "./globals.css";

// Four voices: Bodoni Moda for titles and names on the roll, Archivo (its width axis gives the
// condensed credit captions) for the interface, Courier Prime for typed cue-sheet paperwork and
// Geist Mono for machine data such as hashes, timecode and PayPal ids.
const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const courier = Courier_Prime({
  variable: "--font-courier",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s · CreditRoll Live",
    default: "CreditRoll Live — Interactive Cinema End-Credits & PayPal Sandbox Settlement Studio",
  },
  description:
    "A film's end credits as an auditable payout map: AG Studio custom widgets, a deterministic reconciler and a two-way PayPal Sandbox settlement loop.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bodoni.variable} ${archivo.variable} ${courier.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
