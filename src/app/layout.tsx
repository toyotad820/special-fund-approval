import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TOYOTA車輛部系統",
  description: "TOYOTA車輛部各項申請系統入口",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-slate-800">
        {children}
      </body>
    </html>
  );
}
