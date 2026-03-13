'use client';

import ServiceFrame from '@/components/ServiceFrame';

const SERVICE_URL = 'https://sign.maxed.life/maxed-auth';

export default function ProposalsPage() {
  return <ServiceFrame src={SERVICE_URL} title="Proposals & E-Signatures" />;
}
