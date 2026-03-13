'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://billing.maxed.life';

export default function InvoicingPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="Invoicing"
      fallbackMessage="The Invoice Ninja service is starting up. It may take 1-2 minutes on first launch while the database migrates."
    />
  );
}
