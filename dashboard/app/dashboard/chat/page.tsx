'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { firmFetch, serviceFetch } from '@/lib/service-client';
import { formatDateTime, normalizeFirmClients } from '@/lib/service-adapters';

export default function ChatPage() {
  const { data: session } = useSession();
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [clients, setClients] = useState<ReturnType<typeof normalizeFirmClients>>([]);
  const [activeClientId, setActiveClientId] = useState('');
  const [draftMessage, setDraftMessage] = useState('');

  const loadMessages = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const clientsPayload = await firmFetch('/clients');
      const normalizedClients = normalizeFirmClients(clientsPayload).sort((a, b) => {
        const latestA = a.messages[0]?.createdAt || a.createdAt || '';
        const latestB = b.messages[0]?.createdAt || b.createdAt || '';
        return latestB.localeCompare(latestA);
      });
      setClients(normalizedClients);
      setActiveClientId((current) => current || normalizedClients[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  useEffect(() => {
    loadMessages();
    if (!isReady) return;

    const interval = window.setInterval(loadMessages, 30000);
    return () => window.clearInterval(interval);
  }, [isReady, loadMessages]);

  const activeClient = useMemo(
    () => clients.find((client) => client.id === activeClientId) || null,
    [activeClientId, clients],
  );

  const totalMessages = useMemo(
    () => clients.reduce((sum, client) => sum + client.messages.length, 0),
    [clients],
  );

  const sendMessage = useCallback(async () => {
    if (!activeClient || !draftMessage.trim()) return;

    setSending(true);
    setError('');

    try {
      await serviceFetch(`/api/clients/${activeClient.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          senderType: 'firm',
          content: draftMessage.trim(),
        }),
      });
      setDraftMessage('');
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }, [activeClient, draftMessage, loadMessages]);

  return (
    <WorkspaceShell
      service="mattermost"
      eyebrow="Native Client Chat"
      title="Maxed Messages"
      description="A unified, client-facing messaging workspace inside Maxed. Conversations now stay in the product shell instead of bouncing users into an embedded chat app."
      actions={
        <button onClick={loadMessages} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh inbox
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Active conversations" value={loading ? '--' : String(clients.filter((client) => client.messages.length > 0).length)} detail="Client threads with message history" />
          <WorkspaceMetric label="Messages" value={loading ? '--' : String(totalMessages)} detail="Firm-wide conversation volume" />
          <WorkspaceMetric label="Contacts" value={loading ? '--' : String(clients.length)} detail="Clients available to message" />
          <WorkspaceMetric label="Signed in as" value={loading ? '--' : String((session?.user as { name?: string } | undefined)?.name || 'Firm staff')} detail="Outbound messages are sent from the firm side" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadMessages} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.78fr,1.22fr]">
        <WorkspacePanel title="Conversation list" description="Client communication threads surfaced as native Maxed inbox cards.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : clients.length === 0 ? (
            <WorkspaceEmpty
              title="No client conversations"
              message="Add a client or wait for inbound portal messages to start a thread."
            />
          ) : (
            <div className="space-y-3">
              {clients.map((client) => {
                const latestMessage = [...client.messages].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
                const active = client.id === activeClientId;
                return (
                  <button
                    key={client.id}
                    onClick={() => setActiveClientId(client.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{client.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{client.email}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {client.messages.length}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-slate-500">
                      {latestMessage?.content || 'No messages yet'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </WorkspacePanel>

        <WorkspacePanel title={activeClient ? activeClient.name : 'Conversation'} description="View and respond to client messages without leaving Maxed.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : !activeClient ? (
            <WorkspaceEmpty
              title="No conversation selected"
              message="Choose a client thread from the left to review or send a message."
            />
          ) : (
            <div className="space-y-4">
              <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {activeClient.messages.length === 0 ? (
                  <WorkspaceEmpty
                    title="Start the conversation"
                    message="This client does not have any messages yet. Send the first note from the composer below."
                  />
                ) : (
                  [...activeClient.messages]
                    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
                    .map((message) => {
                      const isFirm = message.senderType === 'firm';
                      return (
                        <div key={message.id} className={`flex ${isFirm ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              isFirm ? 'bg-brand-600 text-white' : 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className={`mt-2 text-xs ${isFirm ? 'text-brand-100' : 'text-slate-400'}`}>
                              {formatDateTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>

              <div className="space-y-3">
                <textarea
                  className="input min-h-[120px] resize-y"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={`Message ${activeClient.name}...`}
                />
                <div className="flex justify-end">
                  <button onClick={sendMessage} disabled={sending || !draftMessage.trim()} className="btn-primary disabled:opacity-60">
                    {sending ? 'Sending...' : 'Send message'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </WorkspacePanel>
      </div>
    </WorkspaceShell>
  );
}
