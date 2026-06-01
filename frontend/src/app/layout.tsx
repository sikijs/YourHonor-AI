import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'YourHonor AI - Legal Education Platform',
  description: 'AI-powered legal education assistant for law students',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}