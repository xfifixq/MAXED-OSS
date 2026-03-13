'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://time.maxed.life/maxed-auth';

export default function TimeTrackingPage() {
  return <ServiceFrame src={SERVICE_URL} title="Time Tracking" />;
}
