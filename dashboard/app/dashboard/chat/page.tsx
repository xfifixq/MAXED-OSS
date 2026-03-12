'use client';

const MATTERMOST_URL = process.env.NEXT_PUBLIC_MATTERMOST_URL || 'http://localhost:8065';

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={MATTERMOST_URL}
        title="Team Chat"
        className="w-full h-full border-0"
        allow="fullscreen; microphone; camera"
      />
    </div>
  );
}
