'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_TWENTY_URL || 'http://localhost:3004';

export default function CRMPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="CRM"
      fallbackMessage="The Twenty CRM service is starting up. It may take 2-3 minutes on first launch while the database initializes."
    />
  );
}
