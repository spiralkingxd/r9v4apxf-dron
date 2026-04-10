import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { Navbar } from "@/components/navbar";
import { ScrollReveal } from "@/components/scroll-reveal";
import NextTopLoader from "nextjs-toploader";
import { getLocale } from "@/lib/i18n";

import "@uiw/react-md-editor/markdown-editor.css";
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
  icons: { icon: '/icon.ico' },
  title: {
    default: "Madness Arena | Início",
    template: "Madness Arena | %s",
  },
  description: "Gerenciamento de torneios competitivos de Sea of Thieves.",     
  openGraph: {
    title: "Madness Arena",
    description: "Gerenciamento de torneios competitivos de Sea of Thieves.",   
    url: "https://madnessarena.vercel.app/",
    siteName: "Madness Arena",
    locale: "pt_BR",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale === "en" ? "en" : "pt-BR"} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: "((() => { try { const saved = localStorage.getItem('madness-theme'); const theme = saved === 'light' || saved === 'dark' ? saved : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'); document.documentElement.setAttribute('data-theme', theme); } catch {} })());"}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}   
      >
        <NextTopLoader color="#fbbf24" showSpinner={false} />
        <Navbar />
        <ScrollReveal />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
