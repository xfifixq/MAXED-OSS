'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import { formatCurrency, formatDate, normalizeFirmClients } from '@/lib/service-adapters';

type DraftInvoice = {
  clientId: string;
  amount: string;
  dueDate: string;
  status: string;
};

export default function InvoicingPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [draft, setDraft] = useState<DraftInvoice>({
    clientId: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'sent',
  });

  const loadInvoices = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const clientsPayload = await firmFetch('/clients');
      const normalizedClients = normalizeFirmClients(clientsPayload);
      setClients(normalizedClients);
      setDraft((current) => ({
        ...current,
        clientId: current.clientId || normalizedClients[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoices.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const invoices = useMemo(
    () =>
      clients
        .flatMap((client) =>
          client.invoices.map((invoice) => ({
            ...invoice,
            clientId: client.id,
            clientName: client.name,
          })),
        )
        .sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '')),
    [clients],
  );

  const totals = useMemo(() => {
    const outstanding = invoices.filter((invoice) => invoice.status !== 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
    const paid = invoices.filter((invoice) => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount, 0);
    const overdue = invoices.filter((invoice) => invoice.status !== 'paid' && invoice.dueDate && new Date(invoice.dueDate) < new Date()).length;
    return { outstanding, paid, overdue };
  }, [invoices]);

  const createInvoice = useCallback(async () => {
    if (!draft.clientId || !draft.amount || !draft.dueDate) return;

    setSaving(true);
    setError('');

    try {
      await serviceFetch(`/api/clients/${draft.clientId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(draft.amount),
          status: draft.status,
          dueDate: new Date(draft.dueDate).toISOString(),
        }),
      });

      setDraft((current) => ({
        ...current,
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
      }));
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invoice.');
    } finally {
      setSaving(false);
    }
  }, [draft.amount, draft.clientId, draft.dueDate, draft.status, loadInvoices]);

  return (
    <WorkspaceShell
      service="invoiceninja"
      eyebrow="Native Billing"
      title="Maxed Billing"
      description="A Maxed-native invoicing workspace for issuing, tracking, and following up on client billing records without dropping users into an embedded billing app."
      actions={
        <button onClick={loadInvoices} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh invoices
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Outstanding" value={loading ? '--' : formatCurrency(totals.outstanding)} detail={`${invoices.filter((invoice) => invoice.status !== 'paid').length} open invoices`} />
          <WorkspaceMetric label="Collected" value={loading ? '--' : formatCurrency(totals.paid)} detail="Paid invoice value" />
          <WorkspaceMetric label="Overdue" value={loading ? '--' : String(totals.overdue)} detail="Needs follow-up" />
          <WorkspaceMetric label="Clients billed" value={loading ? '--' : String(new Set(invoices.map((invoice) => invoice.clientId)).size)} detail="Across the firm" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadInvoices} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <WorkspacePanel title="Create invoice" description="Issue a client invoice from the native Maxed billing screen.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : clients.length === 0 ? (
            <WorkspaceEmpty
              title="No clients available"
              message="Create a client record first, then issue invoices directly from this workspace."
            />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Client</label>
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
              <div>
                <label className="block text-sm font-medium text-slate-700">Status</label>
                <select
                  className="input mt-2"
                  value={draft.status}
                  onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <button onClick={createInvoice} disabled={saving} className="btn-primary w-full disabled:opacity-60">
                {saving ? 'Creating invoice...' : 'Create invoice'}
              </button>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Invoice queue" description="Firm-wide billing records surfaced natively inside Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : invoices.length === 0 ? (
            <WorkspaceEmpty
              title="No invoices yet"
              message="Invoices created here will immediately appear in the client portal and billing queue."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="table-header">Client</th>
                      <th className="table-header">Due</th>
                      <th className="table-header">Status</th>
                      <th className="table-header text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {invoices.slice(0, 14).map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-slate-50">
                        <td className="table-cell">
                          <div>
                            <p className="font-medium text-slate-900">{invoice.clientName}</p>
                            <p className="text-xs text-slate-400">Invoice {invoice.invoiceNinjaId || invoice.id.slice(0, 8)}</p>
                          </div>
                        </td>
                        <td className="table-cell text-slate-500">{formatDate(invoice.dueDate)}</td>
                        <td className="table-cell">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {invoice.status}
                          </span>
                        </td>
                        <td className="table-cell text-right font-medium text-slate-900">{formatCurrency(invoice.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
