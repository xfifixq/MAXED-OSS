'use client';

const KIMAI_URL = process.env.NEXT_PUBLIC_KIMAI_URL || 'http://localhost:8001';

export default function TimeTrackingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={KIMAI_URL}
        title="Time Tracking"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
