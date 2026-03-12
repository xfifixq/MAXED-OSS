'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002';

export default function ReportingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="Reporting & Analytics"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
