'use client';

const INVOICE_NINJA_URL = process.env.NEXT_PUBLIC_INVOICE_NINJA_URL || 'http://localhost:8080';

export default function InvoicingPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <iframe
        src={INVOICE_NINJA_URL}
        title="Invoicing"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}
