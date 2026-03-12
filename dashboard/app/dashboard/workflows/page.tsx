'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678';

export default function WorkflowsPage() {
  return <ServiceFrame src={SERVICE_URL} title="Workflow Automation" />;
}
