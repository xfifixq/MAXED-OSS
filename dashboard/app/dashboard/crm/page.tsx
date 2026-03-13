'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://crm.maxed.life';

export default function CRMPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="CRM"
      fallbackMessage="The Twenty CRM service is starting up. It may take 2-3 minutes on first launch while the database initializes."
    />
  );
}
