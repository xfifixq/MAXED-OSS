'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch } from '@/lib/service-client';
import { formatCurrency, normalizeFirmClients } from '@/lib/service-adapters';

type PipelineBucket = {
  key: string;
  label: string;
  description: string;
  clients: ReturnType<typeof normalizeFirmClients>;
};

export default function CRMPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);

  const loadClients = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const payload = await firmFetch('/clients');
      setClients(normalizeFirmClients(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load client relationships.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const pipeline = useMemo<PipelineBucket[]>(() => {
    const buckets: PipelineBucket[] = [
      { key: 'onboarding', label: 'Onboarding', description: 'Needs intake docs or billing setup', clients: [] },
      { key: 'active', label: 'Active accounts', description: 'Ongoing document and message flow', clients: [] },
      { key: 'followup', label: 'Billing follow-up', description: 'Has open invoices requiring attention', clients: [] },
      { key: 'strategic', label: 'Strategic accounts', description: 'Large or advisory-heavy relationships', clients: [] },
    ];

    clients.forEach((client) => {
      const unpaidInvoices = client.invoices.filter((invoice) => invoice.status !== 'paid').length;
      const isStrategic = client.annualRevenue >= 500000 || client.employeeCount >= 10;
      const hasActivity = client.documents.length > 0 || client.messages.length > 0 || client.invoices.length > 0;

      if (!hasActivity) {
        buckets[0].clients.push(client);
      } else if (unpaidInvoices > 0) {
        buckets[2].clients.push(client);
      } else if (isStrategic) {
        buckets[3].clients.push(client);
      } else {
        buckets[1].clients.push(client);
      }
    });

    return buckets;
  }, [clients]);

  const totalRevenue = clients.reduce((sum, client) => sum + client.annualRevenue, 0);

  return (
    <WorkspaceShell
      service="twenty"
      eyebrow="Native CRM"
      title="Maxed CRM"
      description="A relationship workspace built around the Maxed client record instead of a nested external CRM. It surfaces onboarding status, billing follow-up, and strategic account coverage in one place."
      actions={
        <>
          <button onClick={loadClients} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
            Refresh relationships
          </button>
          <Link href="/dashboard/clients" className="btn-primary">
            Add client
          </Link>
        </>
      }
      metrics={
        <>
          <WorkspaceMetric label="Clients" value={loading ? '--' : String(clients.length)} detail="Tracked in Maxed" />
          <WorkspaceMetric label="Portfolio value" value={loading ? '--' : formatCurrency(totalRevenue)} detail="Declared annual revenue" />
          <WorkspaceMetric label="Open follow-up" value={loading ? '--' : String(pipeline.find((bucket) => bucket.key === 'followup')?.clients.length || 0)} detail="Clients with unpaid invoices" />
          <WorkspaceMetric label="Strategic accounts" value={loading ? '--' : String(pipeline.find((bucket) => bucket.key === 'strategic')?.clients.length || 0)} detail="Higher-touch relationships" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadClients} /> : null}

      <WorkspacePanel title="Relationship pipeline" description="Client relationship stages derived from real Maxed activity.">
        {loading ? (
          <WorkspaceSkeleton rows={6} />
        ) : clients.length === 0 ? (
          <WorkspaceEmpty
            title="No relationships yet"
            message="Create your first client to start building a native Maxed pipeline."
          />
        ) : (
          <div className="grid gap-4 xl:grid-cols-4">
            {pipeline.map((bucket) => (
              <div key={bucket.key} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">{bucket.label}</p>
                  <p className="mt-1 text-sm text-slate-500">{bucket.description}</p>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{bucket.clients.length}</p>
                </div>

                <div className="space-y-3">
                  {bucket.clients.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-400">
                      No clients in this stage.
                    </div>
                  ) : (
                    bucket.clients.map((client) => (
                      <Link
                        key={client.id}
                        href={`/dashboard/clients/${client.id}`}
                        className="block rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
                      >
                        <p className="font-semibold text-slate-900">{client.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{client.businessType}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{client.documents.length} docs</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{client.messages.length} msgs</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1">{client.invoices.length} invoices</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </WorkspacePanel>
    </WorkspaceShell>
  );
}
