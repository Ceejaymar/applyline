import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { ThemeProvider } from "@/components/app/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Applyline",
  description: "A local-first job application tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
