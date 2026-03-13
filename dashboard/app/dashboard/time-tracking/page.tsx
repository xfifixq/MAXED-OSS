'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://time.maxed.life';

export default function TimeTrackingPage() {
  return <ServiceFrame src={SERVICE_URL} title="Time Tracking" />;
}
