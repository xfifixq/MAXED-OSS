import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'OpenCPA — Cut Your CPA Software Costs by 50-80%',
  description:
    'CPA firms spend $20,000–$76,000/year on fragmented software. OpenCPA maps every commercial tool to a free or low-cost open-source alternative so you can cut your software costs by 50-80%.',
  keywords: [
    'CPA software',
    'accounting software',
    'open source accounting',
    'CPA cost savings',
    'practice management',
    'bookkeeping software',
  ],
  openGraph: {
    title: 'OpenCPA — Cut Your CPA Software Costs by 50-80%',
    description:
      'We mapped every CPA tool to an open-source alternative. See how much your firm can save.',
    type: 'website',
    locale: 'en_US',
    siteName: 'OpenCPA',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenCPA — Cut Your CPA Software Costs by 50-80%',
    description:
      'We mapped every CPA tool to an open-source alternative. See how much your firm can save.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
