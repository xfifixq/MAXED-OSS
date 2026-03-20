'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { serviceFetch } from '@/lib/service-client';
import {
  formatDateTime,
  formatDurationMinutes,
  normalizeKimaiActivities,
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
  const [error, setError] = useState('');
  const [timesheets, setTimesheets] = useState<ReturnType<typeof normalizeKimaiTimesheets>>([]);
  const [projects, setProjects] = useState<ReturnType<typeof normalizeKimaiProjects>>([]);
  const [activities, setActivities] = useState<ReturnType<typeof normalizeKimaiActivities>>([]);
  const [draft, setDraft] = useState<DraftTimesheet>({
    project: '',
    activity: '',
    begin: currentLocalDateTime(),
    end: currentLocalDateTime(),
    description: '',
  });

  const loadTimesheets = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const [timesheetPayload, projectsPayload, activitiesPayload] = await Promise.all([
        serviceFetch('/api/services/kimai/timesheets'),
        serviceFetch('/api/services/kimai/projects'),
        serviceFetch('/api/services/kimai/activities'),
      ]);

      const normalizedProjects = normalizeKimaiProjects(projectsPayload);
      const normalizedActivities = normalizeKimaiActivities(activitiesPayload);

      setTimesheets(normalizeKimaiTimesheets(timesheetPayload));
      setProjects(normalizedProjects);
      setActivities(normalizedActivities);
      setDraft((current) => ({
        ...current,
        project: current.project || normalizedProjects[0]?.id || '',
        activity: current.activity || normalizedActivities[0]?.id || '',
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

  const totalMinutes = useMemo(
    () => timesheets.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    [timesheets],
  );

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

  return (
    <WorkspaceShell
      service="kimai"
      eyebrow="Native Time Tracking"
      title="Maxed Time"
      description="Track time, review recent entries, and manage billable work from a native Maxed surface instead of a nested Kimai workspace."
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
          <WorkspaceMetric label="Activities" value={loading ? '--' : String(activities.length)} detail="Billable categories" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadTimesheets} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.88fr,1.12fr]">
        <WorkspacePanel title="Log time" description="Create a native entry that posts directly into Kimai.">
          {loading ? (
            <WorkspaceSkeleton rows={4} />
          ) : projects.length === 0 || activities.length === 0 ? (
            <WorkspaceEmpty
              title="Missing projects or activities"
              message="Kimai needs at least one project and one activity before time can be logged here."
            />
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
            <WorkspaceEmpty
              title="No time entries"
              message="Time logged in Kimai will appear here as soon as the service is connected."
            />
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
    </WorkspaceShell>
  );
}
