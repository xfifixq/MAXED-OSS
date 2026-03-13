'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://chat.maxed.life/maxed-auth';

export default function ChatPage() {
  return <ServiceFrame src={SERVICE_URL} title="Team Chat" />;
}
