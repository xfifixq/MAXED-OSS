'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_PAPERLESS_URL || 'http://localhost:8000';

export default function DocumentsPage() {
  return (
    <ServiceFrame
      src={SERVICE_URL}
      title="Document Management"
    />
  );
}
