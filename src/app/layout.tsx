import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attendance System",
  description: "Employee attendance & leave tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.8.0/font/bootstrap-icons.css"
          rel="stylesheet"
        />
        <link
          href="https://cdn.datatables.net/1.11.5/css/dataTables.bootstrap5.min.css"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <Script
          src="https://code.jquery.com/jquery-3.6.0.min.js"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.min.js"
          strategy="afterInteractive"
        />
        <Script
          src="https://cdn.datatables.net/1.11.5/js/dataTables.bootstrap5.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
