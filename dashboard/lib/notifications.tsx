'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { firmApiUrl } from './api';

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
const POLL_INTERVAL = 30_000; // 30 seconds

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

  // Load on mount
  useEffect(() => {
    setNotifications(loadFromStorage());
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
        const res = await fetch(firmApiUrl('/stats'), {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const data = await res.json();

        const last = loadLastStats();
        if (last && mounted) {
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

          if (data.pendingInvoices > last.pendingInvoices) {
            const diff = data.pendingInvoices - last.pendingInvoices;
            newNotifs.push(
              createNotification(
                'invoice',
                'Pending Invoice',
                `${diff} new pending invoice${diff > 1 ? 's' : ''} require attention.`
              )
            );
          }

          if (data.pendingInvoices < last.pendingInvoices) {
            const diff = last.pendingInvoices - data.pendingInvoices;
            newNotifs.push(
              createNotification(
                'invoice',
                'Invoice Paid',
                `${diff} invoice${diff > 1 ? 's have' : ' has'} been paid.`
              )
            );
          }

          if (data.upcomingDeadlines > last.upcomingDeadlines) {
            newNotifs.push(
              createNotification(
                'system',
                'Upcoming Deadline',
                'A new deadline has been added to your calendar.'
              )
            );
          }

          if (newNotifs.length > 0) {
            setNotifications((prev) => [...newNotifs, ...prev]);
          }
        }

        saveLastStats({
          totalClients: data.totalClients ?? 0,
          pendingInvoices: data.pendingInvoices ?? 0,
          activeWorkflows: data.activeWorkflows ?? 0,
          upcomingDeadlines: data.upcomingDeadlines ?? 0,
        });
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
