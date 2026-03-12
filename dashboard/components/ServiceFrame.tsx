'use client';

import { useState } from 'react';

interface ServiceFrameProps {
  src: string;
  title: string;
  fallbackMessage?: string;
}

export default function ServiceFrame({ src, title, fallbackMessage }: ServiceFrameProps) {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(true);

  if (hasError) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title} Unavailable</h3>
          <p className="text-sm text-gray-500 mb-4">
            {fallbackMessage || `The ${title} service is starting up or temporarily unavailable. This usually resolves within a few minutes.`}
          </p>
          <button
            onClick={() => { setHasError(false); setLoading(true); }}
            className="btn-primary text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-xl z-10">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading {title}...</p>
          </div>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className="w-full h-full border-0 rounded-xl"
        allow="fullscreen; clipboard-write; clipboard-read"
        onLoad={() => setLoading(false)}
        onError={() => { setLoading(false); setHasError(true); }}
      />
    </div>
  );
}
