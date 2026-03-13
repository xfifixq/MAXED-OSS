'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://reports.maxed.life/maxed-auth';

export default function ReportingPage() {
  return <ServiceFrame src={SERVICE_URL} title="Reporting & Analytics" />;
}
