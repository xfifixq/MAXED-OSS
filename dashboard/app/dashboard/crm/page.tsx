'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import {
  formatCurrency,
  formatDate,
  normalizeFirmClients,
  normalizeTwentyCompanies,
  normalizeTwentyPeople,
} from '@/lib/service-adapters';

type PipelineBucket = {
  key: string;
  label: string;
  description: string;
  clients: ReturnType<typeof normalizeFirmClients>;
};

type CompanyDraft = {
  name: string;
  domainName: string;
};

type PersonDraft = {
  companyId: string;
  firstName: string;
  lastName: string;
  primaryEmail: string;
};

export default function CRMPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [companies, setCompanies] = useState<ReturnType<typeof normalizeTwentyCompanies>>([]);
  const [people, setPeople] = useState<ReturnType<typeof normalizeTwentyPeople>>([]);
  const [companyDraft, setCompanyDraft] = useState<CompanyDraft>({ name: '', domainName: '' });
  const [personDraft, setPersonDraft] = useState<PersonDraft>({ companyId: '', firstName: '', lastName: '', primaryEmail: '' });

  const loadCRM = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    const results = await Promise.allSettled([
      firmFetch('/clients'),
      serviceFetch('/api/services/twenty/companies'),
      serviceFetch('/api/services/twenty/people'),
    ]);

    const [clientsResult, companiesResult, peopleResult] = results;

    if (clientsResult.status === 'fulfilled') {
      setClients(normalizeFirmClients(clientsResult.value));
    } else {
      setError(clientsResult.reason instanceof Error ? clientsResult.reason.message : 'Unable to load client relationships.');
    }

    if (companiesResult.status === 'fulfilled') {
      const nextCompanies = normalizeTwentyCompanies(companiesResult.value);
      setCompanies(nextCompanies);
      setPersonDraft((current) => ({ ...current, companyId: current.companyId || nextCompanies[0]?.id || '' }));
    } else {
      setCompanies([]);
    }

    if (peopleResult.status === 'fulfilled') {
      setPeople(normalizeTwentyPeople(peopleResult.value));
    } else {
      setPeople([]);
    }

    setLoading(false);
  }, [isReady]);

  useEffect(() => {
    loadCRM();
  }, [loadCRM]);

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

  const createCompany = useCallback(async () => {
    if (!companyDraft.name.trim()) return;

    setCreatingCompany(true);
    setError('');

    try {
      await serviceFetch('/api/services/twenty/companies', {
        method: 'POST',
        body: JSON.stringify({
          name: companyDraft.name.trim(),
          domainName: companyDraft.domainName.trim() || undefined,
        }),
      });
      setCompanyDraft({ name: '', domainName: '' });
      await loadCRM();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create CRM company.');
    } finally {
      setCreatingCompany(false);
    }
  }, [companyDraft.domainName, companyDraft.name, loadCRM]);

  const createPerson = useCallback(async () => {
    if (!personDraft.firstName.trim() || !personDraft.primaryEmail.trim()) return;

    setCreatingPerson(true);
    setError('');

    try {
      await serviceFetch('/api/services/twenty/people', {
        method: 'POST',
        body: JSON.stringify({
          firstName: personDraft.firstName.trim(),
          lastName: personDraft.lastName.trim() || undefined,
          primaryEmail: personDraft.primaryEmail.trim(),
          companyId: personDraft.companyId || undefined,
        }),
      });
      setPersonDraft((current) => ({ ...current, firstName: '', lastName: '', primaryEmail: '' }));
      await loadCRM();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create CRM contact.');
    } finally {
      setCreatingPerson(false);
    }
  }, [loadCRM, personDraft.companyId, personDraft.firstName, personDraft.lastName, personDraft.primaryEmail]);

  return (
    <WorkspaceShell
      service="twenty"
      eyebrow="Maxed CRM"
      title="Maxed CRM"
      description="A relationship workspace that combines the Maxed client record with live company and contact data. Pipeline, firm client context, and CRM object creation now live in one place."
      actions={
        <>
          <button onClick={loadCRM} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
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
          <WorkspaceMetric label="CRM companies" value={loading ? '--' : String(companies.length)} detail="Live company records" />
          <WorkspaceMetric label="CRM people" value={loading ? '--' : String(people.length)} detail="Live contact records" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadCRM} /> : null}

      <WorkspacePanel title="Relationship pipeline" description="Client relationship stages derived from real Maxed activity.">
        {loading ? (
          <WorkspaceSkeleton rows={6} />
        ) : clients.length === 0 ? (
          <WorkspaceEmpty title="No relationships yet" message="Create your first client to start building the Maxed relationship pipeline." />
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

      <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <WorkspacePanel title="Create CRM records" description="Create company and contact records from inside Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : (
            <div className="space-y-6">
              <div className="space-y-4">
                <p className="text-sm font-semibold text-slate-900">New company</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Company name</label>
                  <input
                    className="input mt-2"
                    value={companyDraft.name}
                    onChange={(event) => setCompanyDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Northwind Fitness Studio"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Domain</label>
                  <input
                    className="input mt-2"
                    value={companyDraft.domainName}
                    onChange={(event) => setCompanyDraft((current) => ({ ...current, domainName: event.target.value }))}
                    placeholder="northwindfit.com"
                  />
                </div>
                <button onClick={createCompany} disabled={creatingCompany} className="btn-primary w-full disabled:opacity-60">
                  {creatingCompany ? 'Creating company...' : 'Create company'}
                </button>
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold text-slate-900">New contact</p>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Company</label>
                  <select
                    className="input mt-2"
                    value={personDraft.companyId}
                    onChange={(event) => setPersonDraft((current) => ({ ...current, companyId: event.target.value }))}
                  >
                    <option value="">No linked company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">First name</label>
                    <input
                      className="input mt-2"
                      value={personDraft.firstName}
                      onChange={(event) => setPersonDraft((current) => ({ ...current, firstName: event.target.value }))}
                      placeholder="Avery"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Last name</label>
                    <input
                      className="input mt-2"
                      value={personDraft.lastName}
                      onChange={(event) => setPersonDraft((current) => ({ ...current, lastName: event.target.value }))}
                      placeholder="Lane"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    className="input mt-2"
                    value={personDraft.primaryEmail}
                    onChange={(event) => setPersonDraft((current) => ({ ...current, primaryEmail: event.target.value }))}
                    placeholder="avery@northwindfit.com"
                  />
                </div>
                <button onClick={createPerson} disabled={creatingPerson} className="btn-primary w-full disabled:opacity-60">
                  {creatingPerson ? 'Creating contact...' : 'Create contact'}
                </button>
              </div>
            </div>
          )}
        </WorkspacePanel>

        <div className="space-y-6">
          <WorkspacePanel title="CRM companies" description="Live company records surfaced in Maxed.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : companies.length === 0 ? (
              <WorkspaceEmpty title="No CRM companies yet" message="Create a company above or connect the CRM layer first." />
            ) : (
              <div className="space-y-3">
                {companies.slice(0, 10).map((company) => (
                  <div key={company.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <p className="font-semibold text-slate-900">{company.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{company.domain || 'No domain set'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Created {formatDate(company.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="CRM contacts" description="Live contact records for current firm relationships.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : people.length === 0 ? (
              <WorkspaceEmpty title="No CRM contacts yet" message="Create a contact above or sync people into the CRM layer." />
            ) : (
              <div className="space-y-3">
                {people.slice(0, 10).map((person) => (
                  <div key={person.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <p className="font-semibold text-slate-900">{person.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{person.email || 'No email set'}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Created {formatDate(person.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </WorkspacePanel>
        </div>
      </div>
    </WorkspaceShell>
  );
}
