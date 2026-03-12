'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'http://localhost:8065';

export default function ChatPage() {
  return <ServiceFrame src={SERVICE_URL} title="Team Chat" />;
}
