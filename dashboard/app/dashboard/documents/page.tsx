'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://docs.maxed.life';

export default function DocumentsPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="Document Management"
    />
  );
}
