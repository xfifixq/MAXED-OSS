'use client';

const DOCUSEAL_URL = process.env.NEXT_PUBLIC_DOCUSEAL_URL || 'http://localhost:3003';

export default function ProposalsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={DOCUSEAL_URL}
        title="Proposals and E-Signatures"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
