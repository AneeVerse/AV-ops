import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aneeverse Chat Control',
  description: 'Private OpenClaw agent chat for Aneeverse',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
