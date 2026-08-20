import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dyne — Student Life OS",
  description:
    "Dyne is a unified operating system for student life: tasks, assignments, courses, exams, calendar, goals, habits, study sessions, and analytics in one calm, focused workspace.",
  keywords: [
    "Dyne",
    "student",
    "productivity",
    "tasks",
    "assignments",
    "calendar",
    "study",
  ],
  authors: [{ name: "Dyne" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Dyne — Student Life OS",
    description: "Your academic and personal life, finally in one place.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
