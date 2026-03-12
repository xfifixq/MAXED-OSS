'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_KIMAI_URL || 'http://localhost:8001';

export default function TimeTrackingPage() {
  return <ServiceFrame src={SERVICE_URL} title="Time Tracking" />;
}
