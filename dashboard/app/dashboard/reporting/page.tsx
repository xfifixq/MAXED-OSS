'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002';

export default function ReportingPage() {
  return <ServiceFrame src={SERVICE_URL} title="Reporting & Analytics" />;
}
