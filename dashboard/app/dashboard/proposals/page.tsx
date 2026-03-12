'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003';

export default function ProposalsPage() {
  return <ServiceFrame src={SERVICE_URL} title="Proposals & E-Signatures" />;
}
