'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_PAPERLESS_URL || 'http://localhost:8000';

export default function DocumentsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="Document Management"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
