'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_BIGCAPITAL_URL || 'http://localhost:3001';

export default function BookkeepingPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="Bookkeeping"
      fallbackMessage="The Bigcapital bookkeeping service is starting up. It may take 1-2 minutes on first launch while the database initializes."
    />
  );
}
