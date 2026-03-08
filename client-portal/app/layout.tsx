import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Client Portal | MAXED Financial',
  description: 'Securely access your financial documents, invoices, and communicate with your accounting team.',
  viewport: 'width=device-width, initial-scale=1',
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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/maxed_acc_logo.png" type="image/png" sizes="any" />
        <link rel="apple-touch-icon" href="/maxed_acc_logo.png" />
      </head>
      <body className={`${inter.className} min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
