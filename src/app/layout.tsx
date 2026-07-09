import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "特案支援金報備系統",
  description: "特案支援金線上報備與簽核",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-800">
        {children}
      </body>
    </html>
  );
}
