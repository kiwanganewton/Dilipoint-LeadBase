import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadBase | Dilipoint",
  description: "Simple, organized lead management for Dilipoint.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
