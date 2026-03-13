'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://flow.maxed.life/maxed-auth';

export default function WorkflowsPage() {
  return <ServiceFrame src={SERVICE_URL} title="Workflow Automation" />;
}
