'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { firmApiUrl, serviceHeaders } from './api';

export interface Notification {
  id: string;
  type: 'invoice' | 'document' | 'client' | 'workflow' | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: string; // ISO string
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
  dismissNotification: () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

const STORAGE_KEY = 'maxed_notifications';
const STATS_KEY = 'maxed_last_stats';
const SERVICE_SNAPSHOT_KEY = 'maxed_service_snapshot';
const STORAGE_VERSION_KEY = 'maxed_notifications_version';
const STORAGE_VERSION = '2026-03-15-2';
const POLL_INTERVAL = 30_000; // 30 seconds

const SERVICE_LABELS: Record<string, string> = {
  paperless: 'Documents',
  docuseal: 'Signatures',
  invoiceninja: 'Billing',
  n8n: 'Automations',
  kimai: 'Time Tracking',
  bigcapital: 'Ledger',
  twenty: 'CRM',
  metabase: 'Analytics',
  mattermost: 'Team Chat',
};

function loadFromStorage(): Notification[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(notifications: Notification[]) {
  if (typeof window === 'undefined') return;
  // Keep only the most recent 50 notifications
  const trimmed = notifications.slice(0, 50);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function loadLastStats(): Record<string, number> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLastStats(stats: Record<string, number>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function loadServiceSnapshot(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SERVICE_SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveServiceSnapshot(snapshot: Record<string, string>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SERVICE_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createNotification(
  type: Notification['type'],
  title: string,
  message: string
): Notification {
  return {
    id: makeId(),
    type,
    title,
    message,
    read: false,
    timestamp: new Date().toISOString(),
  };
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const bootstrappedRef = useRef(false);

  // Load on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentVersion = localStorage.getItem(STORAGE_VERSION_KEY);
      if (currentVersion !== STORAGE_VERSION) {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STATS_KEY);
        localStorage.removeItem(SERVICE_SNAPSHOT_KEY);
        localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      }
    }
    setNotifications(loadFromStorage());
    bootstrappedRef.current = true;
  }, []);

  // Persist whenever notifications change
  useEffect(() => {
    if (notifications.length > 0) {
      saveToStorage(notifications);
    }
  }, [notifications]);

  // Poll the API for stat changes and generate notifications
  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const headers = serviceHeaders();
        const firmId = headers['X-Firm-Id'];
        if (!firmId) return;

        const [statsRes, controlPlaneRes] = await Promise.all([
          fetch(firmApiUrl('/stats'), {
            headers,
            signal: AbortSignal.timeout(8000),
          }),
          fetch(firmApiUrl('/control-plane/services'), {
            headers,
            signal: AbortSignal.timeout(8000),
          }),
        ]);
        if (!statsRes.ok) return;
        const data = await statsRes.json();
        const controlPlane = controlPlaneRes.ok ? await controlPlaneRes.json() : null;

        const last = loadLastStats();
        if (last && mounted && bootstrappedRef.current) {
          const newNotifs: Notification[] = [];

          if (data.totalClients > last.totalClients) {
            const diff = data.totalClients - last.totalClients;
            newNotifs.push(
              createNotification(
                'client',
                'New Client',
                `${diff} new client${diff > 1 ? 's' : ''} added to the firm.`
              )
            );
          }

          if (newNotifs.length > 0) {
            setNotifications((prev) => [...newNotifs, ...prev]);
          }
        }

        const lastSnapshot = loadServiceSnapshot();
        const currentSnapshot = Object.entries(controlPlane?.services || {})
          .reduce<Record<string, string>>((acc, [key, value]) => {
            const configured = Boolean((value as { configured?: boolean })?.configured);
            const liveProbe = (value as { liveProbe?: { ok?: boolean; reason?: string } })?.liveProbe;
            acc[key] = !configured
              ? 'missing'
              : liveProbe?.ok
                ? 'connected'
                : `degraded:${liveProbe?.reason || 'unknown'}`;
            return acc;
          }, {});

        if (lastSnapshot && mounted && bootstrappedRef.current) {
          const serviceAlerts: Notification[] = [];
          for (const [service, state] of Object.entries(currentSnapshot)) {
            const previous = lastSnapshot[service];
            if (!previous || previous === state) continue;
            const label = SERVICE_LABELS[service] || service;

            if (state === 'connected') {
              serviceAlerts.push(
                createNotification('system', `${label} connected`, `${label} is responding again.`)
              );
            } else if (state.startsWith('degraded:')) {
              const reason = state.split(':')[1]?.replace(/_/g, ' ') || 'connector issue';
              serviceAlerts.push(
                createNotification('system', `${label} needs repair`, `${label} is configured, but the live connector is failing: ${reason}.`)
              );
            } else if (state === 'missing') {
              serviceAlerts.push(
                createNotification('system', `${label} not configured`, `${label} credentials are missing for this firm.`)
              );
            }
          }

          if (serviceAlerts.length > 0) {
            setNotifications((prev) => [...serviceAlerts, ...prev]);
          }
        }

        saveLastStats({
          totalClients: data.totalClients ?? 0,
          pendingInvoices: data.pendingInvoices ?? 0,
          activeWorkflows: data.activeWorkflows ?? 0,
          upcomingDeadlines: data.upcomingDeadlines ?? 0,
        });
        saveServiceSnapshot(currentSnapshot);
      } catch {
        // API unreachable - no-op
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllRead, dismissNotification }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
