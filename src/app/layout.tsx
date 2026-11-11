import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Due Diligence",
  description: "Relatório preliminar de due diligence a partir de certidões oficiais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
