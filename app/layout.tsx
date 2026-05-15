import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneHourAPicture",
  description: "Share one photo per hour with your crew",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-fuchsia-100 text-white overflow-hidden antialiased" style={{ height: "100dvh" }}>
        {children}
      </body>
    </html>
  );
}
