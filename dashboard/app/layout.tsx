import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maxed Platform - CPA Firm Dashboard',
  description: 'Unified dashboard for CPA firm management, advisory, and automation.',
  icons: {
    icon: '/maxed_acc_logo.png',
    apple: '/maxed_acc_logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
