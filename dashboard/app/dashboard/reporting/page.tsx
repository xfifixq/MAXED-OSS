'use client';

const METABASE_URL = process.env.NEXT_PUBLIC_METABASE_URL || 'http://localhost:3002';

export default function ReportingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={METABASE_URL}
        title="Reporting and Analytics"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
