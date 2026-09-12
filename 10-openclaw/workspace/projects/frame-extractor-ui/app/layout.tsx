import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frame Extractor",
  description: "Extract video frames and save them to Google Drive",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
