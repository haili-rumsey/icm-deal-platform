import type { Metadata } from "next";
import { Merriweather, Nunito_Sans } from "next/font/google";
import "./globals.css";

// Stream's approved typefaces: Nunito Sans (body, subheads), Merriweather (headlines).
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"] });
const merriweather = Merriweather({ variable: "--font-merriweather", subsets: ["latin"], weight: ["300", "400", "700"] });

export const metadata: Metadata = {
  title: "ICM Deal Platform",
  description: "Stream Realty Partners · Industrial Capital Markets",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${merriweather.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
