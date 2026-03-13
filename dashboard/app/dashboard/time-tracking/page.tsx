'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiUrl } from '@/lib/api';

interface TimesheetProject {
  id: number;
  name: string;
  customer?: { id: number; name: string };
}

interface TimesheetActivity {
  id: number;
  name: string;
  project?: number | null;
}

interface TimesheetEntry {
  id: number;
  begin: string;
  end: string | null;
  duration: number;
  project: TimesheetProject | number;
  activity: TimesheetActivity | number;
  description: string;
  rate: number;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h 0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getProjectName(project: TimesheetProject | number, projects: TimesheetProject[]): string {
  if (typeof project === 'object' && project?.name) return project.name;
  const found = projects.find((p) => p.id === project);
  return found?.name || `Project #${project}`;
}

function getActivityName(activity: TimesheetActivity | number, activities: TimesheetActivity[]): string {
  if (typeof activity === 'object' && activity?.name) return activity.name;
  const found = activities.find((a) => a.id === activity);
  return found?.name || `Activity #${activity}`;
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return date >= startOfWeek && date < endOfWeek;
}

// ---------- Log Time Modal ----------

function LogTimeModal({
  open,
  onClose,
  onCreated,
  projects,
  activities,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  projects: TimesheetProject[];
  activities: TimesheetActivity[];
}) {
  const [form, setForm] = useState({
    project: '',
    activity: '',
    begin: '',
    end: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filter activities by selected project when possible
  const filteredActivities = form.project
    ? activities.filter(
        (a) => !a.project || a.project === Number(form.project)
      )
    : activities;

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.project || !form.activity || !form.begin || !form.end) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/services/kimai/timesheets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project: Number(form.project),
          activity: Number(form.activity),
          begin: new Date(form.begin).toISOString(),
          end: new Date(form.end).toISOString(),
          description: form.description,
        }),
      });
      if (!res.ok) throw new Error('Failed to create time entry');
      setForm({ project: '', activity: '', begin: '', end: '', description: '' });
      onCreated();
      onClose();
    } catch {
      setError('Could not save time entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Log Time</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              className="input"
              value={form.project}
              onChange={(e) => setForm({ ...form, project: e.target.value, activity: '' })}
              required
            >
              <option value="">Select a project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.customer?.name ? ` (${p.customer.name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity</label>
            <select
              className="input"
              value={form.activity}
              onChange={(e) => setForm({ ...form, activity: e.target.value })}
              required
            >
              <option value="">Select an activity</option>
              {filteredActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
              <input
                className="input"
                type="datetime-local"
                value={form.begin}
                onChange={(e) => setForm({ ...form, begin: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
              <input
                className="input"
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What did you work on?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 disabled:opacity-50">
              {submitting ? 'Saving...' : 'Log Time'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------- Placeholder Data ----------

const PLACEHOLDER_ENTRIES: TimesheetEntry[] = [
  { id: 1, begin: new Date().toISOString(), end: new Date().toISOString(), duration: 7200, project: { id: 1, name: 'Tax Preparation' }, activity: { id: 1, name: 'Filing' }, description: '2024 Q4 corporate tax return', rate: 175 },
  { id: 2, begin: new Date(Date.now() - 86400000).toISOString(), end: new Date(Date.now() - 86400000 + 5400000).toISOString(), duration: 5400, project: { id: 2, name: 'Audit Services' }, activity: { id: 2, name: 'Review' }, description: 'Financial statement review', rate: 200 },
  { id: 3, begin: new Date(Date.now() - 172800000).toISOString(), end: new Date(Date.now() - 172800000 + 3600000).toISOString(), duration: 3600, project: { id: 3, name: 'Consulting' }, activity: { id: 3, name: 'Meeting' }, description: 'Client advisory session', rate: 225 },
  { id: 4, begin: new Date(Date.now() - 259200000).toISOString(), end: new Date(Date.now() - 259200000 + 10800000).toISOString(), duration: 10800, project: { id: 1, name: 'Tax Preparation' }, activity: { id: 4, name: 'Research' }, description: 'State tax code research', rate: 175 },
  { id: 5, begin: new Date(Date.now() - 345600000).toISOString(), end: new Date(Date.now() - 345600000 + 9000000).toISOString(), duration: 9000, project: { id: 2, name: 'Audit Services' }, activity: { id: 5, name: 'Fieldwork' }, description: 'On-site inventory count', rate: 200 },
];

const PLACEHOLDER_PROJECTS: TimesheetProject[] = [
  { id: 1, name: 'Tax Preparation', customer: { id: 1, name: 'Acme Corp' } },
  { id: 2, name: 'Audit Services', customer: { id: 2, name: 'TechStart Inc' } },
  { id: 3, name: 'Consulting', customer: { id: 3, name: 'Baker & Associates' } },
];

const PLACEHOLDER_ACTIVITIES: TimesheetActivity[] = [
  { id: 1, name: 'Filing' },
  { id: 2, name: 'Review' },
  { id: 3, name: 'Meeting' },
  { id: 4, name: 'Research' },
  { id: 5, name: 'Fieldwork' },
];

// ---------- Main Page ----------

export default function TimeTrackingPage() {
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [projects, setProjects] = useState<TimesheetProject[]>([]);
  const [activities, setActivities] = useState<TimesheetActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tsRes, projRes, actRes] = await Promise.all([
        fetch(apiUrl('/api/services/kimai/timesheets?page=1&size=50')),
        fetch(apiUrl('/api/services/kimai/projects')),
        fetch(apiUrl('/api/services/kimai/activities')),
      ]);

      const [tsData, projData, actData] = await Promise.all([
        tsRes.ok ? tsRes.json() : null,
        projRes.ok ? projRes.json() : null,
        actRes.ok ? actRes.json() : null,
      ]);

      setEntries(Array.isArray(tsData) ? tsData : PLACEHOLDER_ENTRIES);
      setProjects(Array.isArray(projData) ? projData : PLACEHOLDER_PROJECTS);
      setActivities(Array.isArray(actData) ? actData : PLACEHOLDER_ACTIVITIES);
    } catch {
      setEntries(PLACEHOLDER_ENTRIES);
      setProjects(PLACEHOLDER_PROJECTS);
      setActivities(PLACEHOLDER_ACTIVITIES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Computed stats
  const weekEntries = entries.filter((e) => isThisWeek(e.begin));
  const totalSecondsThisWeek = weekEntries.reduce((sum, e) => sum + (e.duration || 0), 0);
  const billableAmount = weekEntries.reduce((sum, e) => {
    const hours = (e.duration || 0) / 3600;
    return sum + hours * (e.rate || 0);
  }, 0);
  const activeTimer = entries.find((e) => !e.end || e.end === '');
  const totalEntries = entries.length;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">Track billable hours and time entries</p>
        </div>
        <button onClick={() => setShowLogModal(true)} className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log Time
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Hours This Week</p>
              {loading ? (
                <div className="skeleton h-7 w-20 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{formatDuration(totalSecondsThisWeek)}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Billable Amount</p>
              {loading ? (
                <div className="skeleton h-7 w-24 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(billableAmount)}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Timer</p>
              {loading ? (
                <div className="skeleton h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{activeTimer ? 'Running' : 'None'}</p>
              )}
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${activeTimer ? 'bg-orange-50' : 'bg-gray-50'}`}>
              <svg className={`w-5 h-5 ${activeTimer ? 'text-orange-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Entries</p>
              {loading ? (
                <div className="skeleton h-7 w-12 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{totalEntries}</p>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Timesheet Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Date</th>
                <th className="table-header">Project</th>
                <th className="table-header">Activity</th>
                <th className="table-header">Description</th>
                <th className="table-header">Duration</th>
                <th className="table-header">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-32" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-24" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-40" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-16" /></td>
                    <td className="table-cell"><div className="skeleton h-4 w-20" /></td>
                  </tr>
                ))
              ) : entries.length > 0 ? (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{formatDate(entry.begin)}</div>
                      <div className="text-xs text-gray-400">{formatTime(entry.begin)}</div>
                    </td>
                    <td className="table-cell text-gray-700">
                      {getProjectName(entry.project, projects)}
                    </td>
                    <td className="table-cell text-gray-500">
                      {getActivityName(entry.activity, activities)}
                    </td>
                    <td className="table-cell text-gray-500 max-w-xs truncate">
                      {entry.description || '\u2014'}
                    </td>
                    <td className="table-cell">
                      <span className="font-medium text-gray-900">
                        {entry.end ? formatDuration(entry.duration) : (
                          <span className="text-orange-600 font-semibold">Running</span>
                        )}
                      </span>
                    </td>
                    <td className="table-cell text-gray-700">
                      {entry.rate ? formatCurrency(entry.rate) + '/hr' : '\u2014'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-500">
                    No time entries found. Click &quot;Log Time&quot; to add your first entry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LogTimeModal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        onCreated={fetchData}
        projects={projects}
        activities={activities}
      />
    </div>
  );
}
