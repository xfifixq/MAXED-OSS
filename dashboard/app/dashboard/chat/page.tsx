'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { WorkspaceEmpty, WorkspaceError, WorkspaceMetric, WorkspacePanel, WorkspaceShell, WorkspaceSkeleton } from '@/components/WorkspaceShell';
import { useFirmReady } from '@/lib/useFirmReady';
import { serviceFetch } from '@/lib/service-client';
import {
  formatDateTime,
  normalizeMattermostChannels,
  normalizeMattermostPosts,
  normalizeMattermostTeams,
} from '@/lib/service-adapters';

type DraftChannel = {
  teamId: string;
  name: string;
  displayName: string;
  type: 'O' | 'P';
};

export default function ChatPage() {
  const { isReady } = useFirmReady();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [error, setError] = useState('');
  const [currentUserName, setCurrentUserName] = useState('Team member');
  const [teams, setTeams] = useState<ReturnType<typeof normalizeMattermostTeams>>([]);
  const [channels, setChannels] = useState<ReturnType<typeof normalizeMattermostChannels>>([]);
  const [posts, setPosts] = useState<ReturnType<typeof normalizeMattermostPosts>>([]);
  const [activeTeamId, setActiveTeamId] = useState('');
  const [activeChannelId, setActiveChannelId] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [draftChannel, setDraftChannel] = useState<DraftChannel>({
    teamId: '',
    name: '',
    displayName: '',
    type: 'O',
  });

  const loadWorkspace = useCallback(async () => {
    if (!isReady) return;

    setLoading(true);
    setError('');

    try {
      const [mePayload, teamsPayload] = await Promise.all([
        serviceFetch('/api/services/mattermost/me'),
        serviceFetch('/api/services/mattermost/teams'),
      ]);

      const nextTeams = normalizeMattermostTeams(teamsPayload);
      setTeams(nextTeams);
      setCurrentUserName(String((mePayload as { username?: string; first_name?: string; last_name?: string })?.username || 'Team member'));
      setActiveTeamId((current) => current || nextTeams[0]?.id || '');
      setDraftChannel((current) => ({ ...current, teamId: current.teamId || nextTeams[0]?.id || '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load team chat.');
    } finally {
      setLoading(false);
    }
  }, [isReady]);

  const loadChannels = useCallback(async () => {
    if (!isReady || !activeTeamId) return;

    try {
      const payload = await serviceFetch(`/api/services/mattermost/teams/${activeTeamId}/channels`);
      const nextChannels = normalizeMattermostChannels(payload);
      setChannels(nextChannels);
      setActiveChannelId((current) => current || nextChannels[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load channels.');
    }
  }, [activeTeamId, isReady]);

  const loadPosts = useCallback(async () => {
    if (!isReady || !activeChannelId) return;

    try {
      const payload = await serviceFetch(`/api/services/mattermost/channels/${activeChannelId}/posts`);
      setPosts(normalizeMattermostPosts(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load posts.');
    }
  }, [activeChannelId, isReady]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    loadPosts();
    if (!activeChannelId) return;

    const interval = window.setInterval(loadPosts, 15000);
    return () => window.clearInterval(interval);
  }, [activeChannelId, loadPosts]);

  const sendMessage = useCallback(async () => {
    if (!activeChannelId || !draftMessage.trim()) return;

    setSending(true);
    setError('');

    try {
      await serviceFetch(`/api/services/mattermost/channels/${activeChannelId}/posts`, {
        method: 'POST',
        body: JSON.stringify({
          channel_id: activeChannelId,
          message: draftMessage.trim(),
        }),
      });
      setDraftMessage('');
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  }, [activeChannelId, draftMessage, loadPosts]);

  const createChannel = useCallback(async () => {
    if (!draftChannel.teamId || !draftChannel.name.trim() || !draftChannel.displayName.trim()) return;

    setCreatingChannel(true);
    setError('');

    try {
      await serviceFetch('/api/services/mattermost/channels', {
        method: 'POST',
        body: JSON.stringify({
          team_id: draftChannel.teamId,
          name: draftChannel.name.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
          display_name: draftChannel.displayName.trim(),
          type: draftChannel.type,
        }),
      });

      setDraftChannel((current) => ({
        ...current,
        name: '',
        displayName: '',
      }));
      await loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create channel.');
    } finally {
      setCreatingChannel(false);
    }
  }, [draftChannel.displayName, draftChannel.name, draftChannel.teamId, draftChannel.type, loadChannels]);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) || null,
    [activeChannelId, channels],
  );

  return (
    <WorkspaceShell
      service="mattermost"
      eyebrow="Maxed Team Chat"
      title="Maxed Team Chat"
      description="A team collaboration workspace for the firm. Browse channels, create new channels, and post messages from inside Maxed."
      actions={
        <button onClick={loadWorkspace} className="btn-secondary border-white/15 bg-white/10 text-white hover:bg-white/15">
          Refresh chat
        </button>
      }
      metrics={
        <>
          <WorkspaceMetric label="Teams" value={loading ? '--' : String(teams.length)} detail="Mattermost teams available" />
          <WorkspaceMetric label="Channels" value={loading ? '--' : String(channels.length)} detail="Channels in the selected team" />
          <WorkspaceMetric label="Posts" value={loading ? '--' : String(posts.length)} detail="Current channel history" />
          <WorkspaceMetric label="Signed in as" value={loading ? '--' : currentUserName} detail="Mattermost user backing this workspace" />
        </>
      }
    >
      {error ? <WorkspaceError message={error} onRetry={loadWorkspace} /> : null}

      <div className="grid gap-6 xl:grid-cols-[0.82fr,1.18fr]">
        <div className="space-y-6">
          <WorkspacePanel title="Teams and channels" description="Choose a team, then work inside its channel list.">
            {loading ? (
              <WorkspaceSkeleton rows={6} />
            ) : teams.length === 0 ? (
              <WorkspaceEmpty title="No teams available" message="Create or join a Mattermost team before using the native chat workspace." />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team</label>
                  <select
                    className="input mt-2"
                    value={activeTeamId}
                    onChange={(event) => {
                      setActiveTeamId(event.target.value);
                      setActiveChannelId('');
                      setDraftChannel((current) => ({ ...current, teamId: event.target.value }));
                    }}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-3">
                  {channels.map((channel) => {
                    const active = channel.id === activeChannelId;
                    return (
                      <button
                        key={channel.id}
                        onClick={() => setActiveChannelId(channel.id)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                          active ? 'border-brand-300 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-medium text-slate-900">{channel.displayName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                          {channel.type === 'P' ? 'Private channel' : 'Public channel'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </WorkspacePanel>

          <WorkspacePanel title="Create channel" description="Open a new client room, close-team room, or engagement channel.">
            {loading ? (
              <WorkspaceSkeleton rows={4} />
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Team</label>
                  <select
                    className="input mt-2"
                    value={draftChannel.teamId}
                    onChange={(event) => setDraftChannel((current) => ({ ...current, teamId: event.target.value }))}
                  >
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Display name</label>
                  <input
                    className="input mt-2"
                    value={draftChannel.displayName}
                    onChange={(event) => setDraftChannel((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder="Client onboarding"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">URL name</label>
                  <input
                    className="input mt-2"
                    value={draftChannel.name}
                    onChange={(event) => setDraftChannel((current) => ({ ...current, name: event.target.value }))}
                    placeholder="client-onboarding"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Visibility</label>
                  <select
                    className="input mt-2"
                    value={draftChannel.type}
                    onChange={(event) => setDraftChannel((current) => ({ ...current, type: event.target.value as 'O' | 'P' }))}
                  >
                    <option value="O">Public</option>
                    <option value="P">Private</option>
                  </select>
                </div>
                <button onClick={createChannel} disabled={creatingChannel} className="btn-primary w-full disabled:opacity-60">
                  {creatingChannel ? 'Creating channel...' : 'Create channel'}
                </button>
              </div>
            )}
          </WorkspacePanel>
        </div>

        <WorkspacePanel title={activeChannel ? activeChannel.displayName : 'Channel'} description="View and respond to the current Mattermost thread.">
          {loading ? (
            <WorkspaceSkeleton rows={6} />
          ) : !activeChannel ? (
            <WorkspaceEmpty title="No channel selected" message="Choose a team channel from the left to read or post messages." />
          ) : (
            <div className="space-y-4">
              <div className="max-h-[34rem] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
                {posts.length === 0 ? (
                  <WorkspaceEmpty title="No posts yet" message="Start the conversation in this channel from the composer below." />
                ) : (
                  posts.map((post) => (
                    <div key={post.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                      <p className="text-sm whitespace-pre-wrap text-slate-900">{post.message}</p>
                      <p className="mt-2 text-xs text-slate-400">{formatDateTime(post.createAt)}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-3">
                <textarea
                  className="input min-h-[120px] resize-y"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={`Post to ${activeChannel.displayName}...`}
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
