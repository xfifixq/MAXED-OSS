'use client';

const SERVICE_URL = process.env.NEXT_PUBLIC_N8N_URL || 'http://localhost:5678';

export default function WorkflowsPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={SERVICE_URL}
        title="Workflow Automation"
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
      />
    </div>
  );
}
