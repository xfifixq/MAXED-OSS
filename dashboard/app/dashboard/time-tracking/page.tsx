'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { serviceFetch } from '@/lib/service-client';
import {
  formatDateTime,
  formatDurationMinutes,
  normalizeKimaiActivities,
  normalizeKimaiCustomers,
  normalizeKimaiProjects,
  normalizeKimaiTimesheets,
} from '@/lib/service-adapters';

type DraftTimesheet = {
  project: string;
  activity: string;
  begin: string;
  end: string;
  description: string;
};

type DraftSetup = {
  customerName: string;
  projectName: string;
  activityName: string;
  customerId: string;
};

function currentLocalDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function TimeTrackingPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [timesheets, setTimesheets] = useState<ReturnType<typeof normalizeKimaiTimesheets>>([]);
  const [customers, setCustomers] = useState<ReturnType<typeof normalizeKimaiCustomers>>([]);
  const [projects, setProjects] = useState<ReturnType<typeof normalizeKimaiProjects>>([]);
  const [activities, setActivities] = useState<ReturnType<typeof normalizeKimaiActivities>>([]);
  const [draft, setDraft] = useState<DraftTimesheet>({
    project: '',
    activity: '',
    begin: currentLocalDateTime(),
    end: currentLocalDateTime(),
    description: '',
  });
  const [setupDraft, setSetupDraft] = useState<DraftSetup>({
    customerName: '',
    projectName: '',
    activityName: '',
    customerId: '',
  });

  const loadTimesheets = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const [timesheetPayload, projectsPayload, activitiesPayload, customersPayload] = await Promise.all([
        serviceFetch('/api/services/kimai/timesheets'),
        serviceFetch('/api/services/kimai/projects'),
        serviceFetch('/api/services/kimai/activities'),
        serviceFetch('/api/services/kimai/customers'),
      ]);

      const normalizedProjects = normalizeKimaiProjects(projectsPayload);
      const normalizedActivities = normalizeKimaiActivities(activitiesPayload);
      const normalizedCustomers = normalizeKimaiCustomers(customersPayload);

      setTimesheets(normalizeKimaiTimesheets(timesheetPayload));
      setProjects(normalizedProjects);
      setActivities(normalizedActivities);
      setCustomers(normalizedCustomers);
      setDraft((current) => ({
        ...current,
        project: current.project || normalizedProjects[0]?.id || '',
        activity: current.activity || normalizedActivities[0]?.id || '',
      }));
      setSetupDraft((current) => ({
        ...current,
        customerId: current.customerId || normalizedCustomers[0]?.id || '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load time tracking.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadTimesheets();
  }, [loadTimesheets]);

  const totalMinutes = useMemo(() => timesheets.reduce((sum, entry) => sum + entry.durationMinutes, 0), [timesheets]);

  const createTimesheet = useCallback(async () => {
    if (!draft.project || !draft.activity || !draft.begin || !draft.end) return;

    setSaving(true);
    setError('');

    try {
      await serviceFetch('/api/services/kimai/timesheets', {
        method: 'POST',
        body: JSON.stringify({
          project: Number(draft.project) || draft.project,
          activity: Number(draft.activity) || draft.activity,
          begin: new Date(draft.begin).toISOString(),
          end: new Date(draft.end).toISOString(),
          description: draft.description,
        }),
      });

      setDraft((current) => ({
        ...current,
        begin: currentLocalDateTime(),
        end: currentLocalDateTime(),
        description: '',
      }));
      await loadTimesheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create time entry.');
    } finally {
      setSaving(false);
    }
  }, [draft.activity, draft.begin, draft.description, draft.end, draft.project, loadTimesheets]);

  const createSetupRecords = useCallback(async () => {
    setCreating(true);
    setError('');

    try {
      if (setupDraft.customerName.trim()) {
        await serviceFetch('/api/services/kimai/customers', {
          method: 'POST',
          body: JSON.stringify({
            name: setupDraft.customerName.trim(),
          }),
        });
      }

      if (setupDraft.projectName.trim() && setupDraft.customerId) {
        await serviceFetch('/api/services/kimai/projects', {
          method: 'POST',
          body: JSON.stringify({
            name: setupDraft.projectName.trim(),
            customer: Number(setupDraft.customerId) || setupDraft.customerId,
          }),
        });
      }

      if (setupDraft.activityName.trim()) {
        await serviceFetch('/api/services/kimai/activities', {
          method: 'POST',
          body: JSON.stringify({
            name: setupDraft.activityName.trim(),
          }),
        });
      }

      setSetupDraft({
        customerName: '',
        projectName: '',
        activityName: '',
        customerId: '',
      });
      await loadTimesheets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create Kimai setup records.');
    } finally {
      setCreating(false);
    }
  }, [loadTimesheets, setupDraft.activityName, setupDraft.customerId, setupDraft.customerName, setupDraft.projectName]);

  return (
    <WorkspaceShell
      service="kimai"
      eyebrow="Native Time Tracking"
      title="Maxed Time"
      description="Kimai-backed time tracking for CPA delivery teams. Log time, review recent entries, and create the core customer, project, and activity records needed to keep work moving."
      actions={
        <button onClick={loadTimesheets} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh time
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Tracked time" value={loading ? '--' : formatDurationMinutes(totalMinutes)} detail="Recent Kimai entries" />
          <WorkspaceMetric label="Entries" value={loading ? '--' : String(timesheets.length)} detail="Returned in the current feed" />
          <WorkspaceMetric label="Projects" value={loading ? '--' : String(projects.length)} detail="Available for logging" />
          <WorkspaceMetric label="Customers" value={loading ? '--' : String(customers.length)} detail="Kimai customer records" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadTimesheets} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <WorkspacePanel title="Log time" description="Create a native entry that posts directly into Kimai.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : projects.length === 0 || activities.length === 0 ? (
            <WorkspaceEmpty title="Missing projects or activities" message="Create the Kimai setup records below before logging time here." />
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Project</label>
                <select className="input mt-2" value={draft.project} onChange={(event) => setDraft((current) => ({ ...current, project: event.target.value }))}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Activity</label>
                <select className="input mt-2" value={draft.activity} onChange={(event) => setDraft((current) => ({ ...current, activity: event.target.value }))}>
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Start</label>
                  <input className="input mt-2" type="datetime-local" value={draft.begin} onChange={(event) => setDraft((current) => ({ ...current, begin: event.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">End</label>
                  <input className="input mt-2" type="datetime-local" value={draft.end} onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea className="input mt-2 min-h-[96px] resize-y" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <button onClick={createTimesheet} disabled={saving} className="btn-primary w-full disabled:opacity-60">
                {saving ? 'Saving entry...' : 'Save time entry'}
              </button>
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title="Recent time entries" description="Latest Kimai timesheets, normalized into Maxed cards.">
          {loading ? (
            <WorkspaceSkeleton rows={5} />
          ) : timesheets.length === 0 ? (
            <WorkspaceEmpty title="No time entries" message="Time logged in Kimai will appear here as soon as the service is connected." />
          ) : (
            <div className="space-y-3">
              {timesheets.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{entry.projectName || 'Project'} · {entry.activityName || 'Activity'}</p>
                      <p className="mt-1 text-sm text-slate-500">{entry.description || 'No description'}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                        {formatDateTime(entry.begin)}
                        {entry.end ? ` → ${formatDateTime(entry.end)}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-950">{formatDurationMinutes(entry.durationMinutes)}</p>
                      {entry.rate ? <p className="mt-1 text-sm text-slate-500">${entry.rate}/hr</p> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkspacePanel>
      </div>

      <WorkspacePanel title="Kimai setup" description="Create the core records a CPA firm needs before staff can log time consistently.">
        {loading ? (
          <WorkspaceSkeleton rows={4} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">New customer</label>
              <input
                className="input mt-2"
                value={setupDraft.customerName}
                onChange={(event) => setSetupDraft((current) => ({ ...current, customerName: event.target.value }))}
                placeholder="Acme Holdings"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Project customer</label>
              <select
                className="input mt-2"
                value={setupDraft.customerId}
                onChange={(event) => setSetupDraft((current) => ({ ...current, customerId: event.target.value }))}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">New project</label>
              <input
                className="input mt-2"
                value={setupDraft.projectName}
                onChange={(event) => setSetupDraft((current) => ({ ...current, projectName: event.target.value }))}
                placeholder="2026 monthly close"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">New activity</label>
              <input
                className="input mt-2"
                value={setupDraft.activityName}
                onChange={(event) => setSetupDraft((current) => ({ ...current, activityName: event.target.value }))}
                placeholder="Tax planning"
              />
            </div>
          </div>
        )}
        {!loading ? (
          <div className="mt-4 flex justify-end">
            <button onClick={createSetupRecords} disabled={creating} className="btn-primary disabled:opacity-60">
              {creating ? 'Saving setup...' : 'Create Kimai records'}
            </button>
          </div>
        ) : null}
      </WorkspacePanel>
    </WorkspaceShell>
  );
}
