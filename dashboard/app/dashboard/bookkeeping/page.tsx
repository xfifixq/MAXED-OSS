'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_BIGCAPITAL_URL || 'http://localhost:3001';

export default function BookkeepingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="Bookkeeping"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
