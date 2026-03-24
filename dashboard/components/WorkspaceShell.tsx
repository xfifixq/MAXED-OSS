'use client';

import type { ReactNode } from 'react';
import { bridgeUrl, getFirmId } from '@/lib/api';
import { useServiceStatus } from '@/lib/useServiceStatus';

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function statusTone(health?: string) {
  if (health === 'connected') {
    return {
      dot: 'bg-emerald-400',
      badge: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-inset ring-emerald-400/30',
      label: 'Live',
    };
  }

  if (health === 'degraded') {
    return {
      dot: 'bg-amber-300',
      badge: 'bg-amber-500/15 text-amber-50 ring-1 ring-inset ring-amber-300/40',
      label: 'Needs repair',
    };
  }

  if (health === 'unknown') {
    return {
      dot: 'bg-slate-300',
      badge: 'bg-slate-500/15 text-slate-100 ring-1 ring-inset ring-slate-300/30',
      label: 'Pending',
    };
  }

  return {
    dot: 'bg-rose-300',
    badge: 'bg-rose-500/15 text-rose-50 ring-1 ring-inset ring-rose-300/35',
    label: 'Needs setup',
  };
}

export function WorkspaceShell({
  service,
  title,
  description,
  eyebrow = 'Maxed Workspace',
  actions,
  metrics,
  children,
}: {
  service?: string;
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  metrics?: ReactNode;
  children: ReactNode;
}) {
  const { statuses } = useServiceStatus();
  const serviceStatus = service ? statuses[service] : null;
  const tone = service ? statusTone(serviceStatus?.health) : null;
  const liveModuleUrl = service && serviceStatus?.configured && getFirmId()
    ? bridgeUrl(service, { mode: 'direct' })
    : '';

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-[28px] bg-slate-950 px-6 py-6 text-white shadow-xl sm:px-8 sm:py-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_80%_20%,_rgba(59,130,246,0.24),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.88),_rgba(2,6,23,1))]" />
        <div className="relative space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200">
                  {eyebrow}
                </span>
                {tone && (
                  <span className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium', tone.badge)}>
                    <span className={cx('h-2 w-2 rounded-full', tone.dot)} />
                    {tone.label}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">{title}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300 sm:text-[15px]">{description}</p>
              </div>
            </div>
            {actions || liveModuleUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                {actions}
                {liveModuleUrl ? (
                  <a
                    href={liveModuleUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15"
                  >
                    Open Live Module
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          {metrics ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{metrics}</div> : null}
        </div>
      </section>

      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function WorkspaceMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-400">{detail}</p> : null}
    </div>
  );
}

export function WorkspacePanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-3">{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function WorkspaceEmpty({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0014.586 2H8a2 2 0 00-2 2v16a2 2 0 002 2z" />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">{message}</p>
      {action ? <div className="mt-5 flex items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export function WorkspaceError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-rose-900">Workspace unavailable</p>
          <p className="mt-1">{message}</p>
        </div>
        {onRetry ? (
          <button onClick={onRetry} className="btn-secondary border-rose-200 bg-white text-rose-700 hover:bg-rose-100">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WorkspaceSkeleton({
  rows = 3,
}: {
  rows?: number;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}
