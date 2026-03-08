'use client';

const TWENTY_URL = process.env.NEXT_PUBLIC_TWENTY_URL || 'http://localhost:3004';

export default function CRMPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={TWENTY_URL}
        title="CRM"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
