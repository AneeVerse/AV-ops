import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "jwel_img_gen",
  description: "Jewelry image generation interface for n8n and Replicate Nano Banana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
