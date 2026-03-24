'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { firmApiUrl } from '@/lib/api';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch } from '@/lib/service-client';
import {
  formatCurrency,
  formatDate,
  normalizeFirmClients,
  normalizeInvoiceNinjaClients,
  normalizeInvoiceNinjaInvoices,
  normalizeInvoiceNinjaPayments,
} from '@/lib/service-adapters';

type DraftInvoice = {
  clientId: string;
  amount: string;
  dueDate: string;
  status: string;
  description: string;
};

type DraftPayment = {
  invoiceId: string;
  clientId: string;
  amount: string;
  date: string;
};

type InvoicingWorkspacePayload = {
  workspace?: {
    configured?: boolean;
    health?: string;
    liveProbe?: {
      reason?: string;
      status?: number;
    };
  };
  issues?: Array<{
    operation?: string;
    reason?: string;
    status?: number;
    detail?: string;
  }>;
  data?: {
    clients?: unknown;
    remoteClients?: unknown;
    invoices?: unknown;
    payments?: unknown;
  };
};

export default function InvoicingPage() {
  const { firmId, isReady } = useFirmReady();
  const searchParams = useSearchParams();
  const preferredClientId = searchParams.get('clientId') || '';
  const [loading, setLoading] = useState(true);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [remoteClients, setRemoteClients] = useState<ReturnType<typeof normalizeInvoiceNinjaClients>>([]);
  const [remoteInvoices, setRemoteInvoices] = useState<ReturnType<typeof normalizeInvoiceNinjaInvoices>>([]);
  const [payments, setPayments] = useState<ReturnType<typeof normalizeInvoiceNinjaPayments>>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = useState<DraftInvoice>({
    clientId: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'draft',
    description: 'Monthly accounting services',
  });
  const [paymentDraft, setPaymentDraft] = useState<DraftPayment>({
    invoiceId: '',
    clientId: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
  });

  const loadBilling = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');
    setWarning('');

    try {
      const payload = await firmFetch<InvoicingWorkspacePayload>('/workspaces/invoicing');
      const issue = payload.issues?.[0];
      const probeReason = payload.workspace?.liveProbe?.reason?.replace(/_/g, ' ');
      const normalizedClients = normalizeFirmClients(payload.data?.clients);
      const invoices = normalizeInvoiceNinjaInvoices(payload.data?.invoices);

      if (issue) {
        setWarning(
          `Invoice Ninja needs repair before live billing data is trustworthy. ${issue.operation || 'connector'} failed: ${issue.reason || 'unknown'}${issue.status ? ` (HTTP ${issue.status})` : ''}${issue.detail ? ` · ${issue.detail}` : ''}`,
        );
      } else if (payload.workspace?.configured && payload.workspace?.health !== 'connected') {
        setWarning(`Invoice Ninja is mapped in Maxed, but the live connector still needs repair: ${probeReason || 'unknown issue'}.`);
      }

      setClients(normalizedClients);
      const nextClientId = preferredClientId || normalizedClients[0]?.id || '';
      setDraft((current) => ({ ...current, clientId: current.clientId || nextClientId }));
      setRemoteClients(normalizeInvoiceNinjaClients(payload.data?.remoteClients));
      setRemoteInvoices(invoices);
      setSelectedInvoiceId((current) => current || invoices[0]?.id || '');
      setPaymentDraft((current) => ({
        ...current,
        invoiceId: current.invoiceId || invoices.find((invoice) => invoice.balanceDue > 0)?.id || '',
      }));
      setPayments(normalizeInvoiceNinjaPayments(payload.data?.payments));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load billing workspace.');
    } finally {
      setLoading(false);
    }
  }, [isReady, preferredClientId]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  const loadInvoiceDetail = useCallback(async () => {
    if (!selectedInvoiceId || !isReady) return;

    try {
      const payload = await firmFetch(`/workspaces/invoicing/invoices/${selectedInvoiceId}`);
      setSelectedInvoiceDetail((payload as { data?: Record<string, unknown> }).data || (payload as Record<string, unknown>));
    } catch {
      setSelectedInvoiceDetail(null);
    }
  }, [isReady, selectedInvoiceId]);

  useEffect(() => {
    loadInvoiceDetail();
  }, [loadInvoiceDetail]);

  const totals = useMemo(() => {
    const outstanding = remoteInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0);
    const billed = remoteInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
    const collected = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const overdue = remoteInvoices.filter((invoice) => invoice.balanceDue > 0 && invoice.dueDate && new Date(invoice.dueDate) < new Date()).length;
    return { outstanding, billed, collected, overdue };
  }, [payments, remoteInvoices]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === draft.clientId) || null,
    [clients, draft.clientId],
  );

  const createInvoice = useCallback(async () => {
    if (!draft.clientId || !draft.amount || !draft.dueDate) return;

    setSavingInvoice(true);
    setError('');

    try {
      await firmFetch('/workspaces/invoicing/invoices', {
        method: 'POST',
        body: JSON.stringify({
          clientId: draft.clientId,
          amount: Number(draft.amount),
          dueDate: draft.dueDate,
          status: draft.status,
          description: draft.description,
        }),
      });

      setDraft((current) => ({
        ...current,
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
      }));
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invoice.');
    } finally {
      setSavingInvoice(false);
    }
  }, [draft.amount, draft.clientId, draft.description, draft.dueDate, draft.status, loadBilling]);

  const recordPayment = useCallback(async () => {
    if (!paymentDraft.invoiceId || !paymentDraft.amount) return;

    setSavingPayment(true);
    setError('');

    try {
      const invoice = remoteInvoices.find((entry) => entry.id === paymentDraft.invoiceId);
      await firmFetch('/workspaces/invoicing/payments', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(paymentDraft.amount),
          date: paymentDraft.date,
          client_id: invoice?.clientId || paymentDraft.clientId || undefined,
          invoices: {
            [paymentDraft.invoiceId]: Number(paymentDraft.amount),
          },
        }),
      });

      setPaymentDraft((current) => ({
        ...current,
        amount: '',
        date: new Date().toISOString().slice(0, 10),
      }));
      await loadBilling();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setSavingPayment(false);
    }
  }, [loadBilling, paymentDraft.amount, paymentDraft.clientId, paymentDraft.date, paymentDraft.invoiceId, remoteInvoices]);

  const downloadInvoice = useCallback(async (invoiceId: string, label: string) => {
    try {
      if (!firmId) throw new Error('Firm session missing.');
      const res = await fetch(firmApiUrl(`/workspaces/invoicing/invoices/${invoiceId}/download`));
      if (!res.ok) throw new Error(`Unable to download ${label}.`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${label || invoiceId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download invoice PDF.');
    }
  }, [firmId]);

  return (
    <WorkspaceShell
      service="invoiceninja"
      eyebrow="Maxed Billing"
      title="Maxed Billing"
      description="A billing workspace for CPA work. Issue invoices from firm clients, track the receivables queue, and record payments inside Maxed."
      actions={
        <button onClick={loadBilling} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh billing
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Outstanding" value={loading ? '--' : formatCurrency(totals.outstanding)} detail={`${remoteInvoices.filter((invoice) => invoice.balanceDue > 0).length} open invoices`} />
          <WorkspaceMetric label="Billed" value={loading ? '--' : formatCurrency(totals.billed)} detail="Invoice volume" />
          <WorkspaceMetric label="Collected" value={loading ? '--' : formatCurrency(totals.collected)} detail="Recorded payments" />
          <WorkspaceMetric label="Overdue" value={loading ? '--' : String(totals.overdue)} detail="Invoices past due" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadBilling} /> : null}
      {warning ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">{warning}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <WorkspacePanel title="Issue invoice" description="Create an Invoice Ninja client on demand, then issue a bill against that client.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : clients.length === 0 ? (
            <WorkspaceEmpty
              title="No firm clients available"
              message="Create a firm client record first, then issue invoices directly from this workspace."
            />
          ) : (
            <div className="space-y-4">
              {selectedClient ? (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{selectedClient.name}</p>
                      <p className="mt-1 text-sm text-slate-500">Invoice creation is currently scoped to this client.</p>
                    </div>
                    <Link href={`/dashboard/clients/${selectedClient.id}`} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                      Open client
                    </Link>
                  </div>
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-slate-700">Firm client</label>
                <select
                  className="input mt-2"
                  value={draft.clientId}
                  onChange={(event) => setDraft((current) => ({ ...current, clientId: event.target.value }))}
                >
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <input
                  className="input mt-2"
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Monthly bookkeeping, tax prep, advisory retainer..."
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  <input
                    className="input mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.amount}
                    onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Due date</label>
                  <input
                    className="input mt-2"
                    type="date"
                    value={draft.dueDate}
                    onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </div>
              </div>
              <button onClick={createInvoice} disabled={savingInvoice} className="btn-primary w-full disabled:opacity-60">
                {savingInvoice ? 'Issuing invoice...' : 'Issue invoice'}
              </button>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Record payment" description="Apply a payment to any live Invoice Ninja invoice.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : remoteInvoices.length === 0 ? (
            <WorkspaceEmpty
              title="No invoices available"
              message="Issue an invoice first, then record a payment against the outstanding balance."
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Invoice</label>
                <select
                  className="input mt-2"
                  value={paymentDraft.invoiceId}
                  onChange={(event) => setPaymentDraft((current) => ({ ...current, invoiceId: event.target.value }))}
                >
                  {remoteInvoices.filter((invoice) => invoice.balanceDue > 0).map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.number} · {invoice.clientName} · {formatCurrency(invoice.balanceDue)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Amount</label>
                  <input
                    className="input mt-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentDraft.amount}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Payment date</label>
                  <input
                    className="input mt-2"
                    type="date"
                    value={paymentDraft.date}
                    onChange={(event) => setPaymentDraft((current) => ({ ...current, date: event.target.value }))}
                  />
                </div>
              </div>
              <button onClick={recordPayment} disabled={savingPayment} className="btn-primary w-full disabled:opacity-60">
                {savingPayment ? 'Recording payment...' : 'Record payment'}
              </button>
            </div>
          )}
        </WorkspacePanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <WorkspacePanel title="Live invoice queue" description="The current invoice register surfaced in Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : remoteInvoices.length === 0 ? (
            <WorkspaceEmpty
              title="No invoices returned"
              message="Once Invoice Ninja is configured, live invoices will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-header">Invoice</th>
                      <th className="table-header">Client</th>
                      <th className="table-header">Due</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {remoteInvoices.map((invoice) => (
                      <tr key={invoice.id} className={`hover:bg-slate-50 ${selectedInvoiceId === invoice.id ? 'bg-brand-50/60' : ''}`}>
                        <td className="table-cell font-medium text-slate-900">
                          <button onClick={() => setSelectedInvoiceId(invoice.id)} className="text-left hover:text-brand-700">
                            {invoice.number}
                          </button>
                        </td>
                        <td className="table-cell text-slate-500">{invoice.clientName}</td>
                        <td className="table-cell text-slate-500">{formatDate(invoice.dueDate)}</td>
                        <td className="table-cell">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{invoice.status}</span>
                        </td>
                        <td className="table-cell text-right font-medium text-slate-900">{formatCurrency(invoice.balanceDue || invoice.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Billing context" description="Remote client and payment activity from Invoice Ninja.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Selected invoice</p>
                {!selectedInvoiceId ? (
                  <p className="mt-3 text-sm text-slate-500">Choose an invoice from the queue to inspect its live detail.</p>
                ) : !selectedInvoiceDetail ? (
                  <p className="mt-3 text-sm text-slate-500">Invoice detail is unavailable right now, but you can still download the PDF.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="font-medium text-slate-900">{String(selectedInvoiceDetail.number || selectedInvoiceId)}</p>
                      <p className="text-sm text-slate-500">{String(selectedInvoiceDetail.status || 'Invoice')}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                        <p className="mt-1 text-sm text-slate-700">{formatCurrency(Number(selectedInvoiceDetail.amount || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Balance due</p>
                        <p className="mt-1 text-sm text-slate-700">{formatCurrency(Number(selectedInvoiceDetail.balance || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Created</p>
                        <p className="mt-1 text-sm text-slate-700">{formatDate(String(selectedInvoiceDetail.created_at || selectedInvoiceDetail.date || ''))}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Due</p>
                        <p className="mt-1 text-sm text-slate-700">{formatDate(String(selectedInvoiceDetail.due_date || ''))}</p>
                      </div>
                    </div>
                  </div>
                )}
                {selectedInvoiceId ? (
                  <div className="mt-4">
                    <button onClick={() => downloadInvoice(selectedInvoiceId, String(selectedInvoiceDetail?.number || selectedInvoiceId))} className="btn-secondary">
                      Download PDF
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Remote clients</p>
                <div className="mt-3 space-y-3">
                  {remoteClients.slice(0, 5).map((client) => (
                    <div key={client.id} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{client.name}</p>
                        <p className="text-sm text-slate-500">{client.email || 'No email on record'}</p>
                      </div>
                      <p className="text-sm font-medium text-slate-900">{formatCurrency(client.balance)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Recent payments</p>
                {payments.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">No payments recorded yet.</p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {payments.slice(0, 6).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{payment.invoiceId || 'Invoice payment'}</p>
                          <p className="text-sm text-slate-500">{formatDate(payment.date)}</p>
                        </div>
                        <p className="text-sm font-medium text-slate-900">{formatCurrency(payment.amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
