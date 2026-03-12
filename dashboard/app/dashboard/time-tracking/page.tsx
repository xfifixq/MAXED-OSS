'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_KIMAI_URL || 'http://localhost:8001';

export default function TimeTrackingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="Time Tracking"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
