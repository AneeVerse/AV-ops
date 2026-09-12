import type { Metadata } from "next";
import "antd/dist/reset.css";
import "./styles.css";

export const metadata: Metadata = {
  title: "PDF to PPT Generator",
  description: "Generate editable PowerPoint decks from PDFs with Aneeverse automation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
