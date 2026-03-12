'use client';

const PAPERLESS_URL = process.env.NEXT_PUBLIC_PAPERLESS_URL || 'http://localhost:8000';

export default function DocumentsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={PAPERLESS_URL}
        title="Document Management"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
