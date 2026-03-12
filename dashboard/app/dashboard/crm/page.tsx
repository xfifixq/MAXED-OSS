'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_TWENTY_URL || 'http://localhost:3004';

export default function CRMPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="CRM"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
