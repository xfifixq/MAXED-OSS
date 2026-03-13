'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiUrl } from '@/lib/api';

interface Channel {
  id: string;
  display_name: string;
  name: string;
  type: string;
  total_msg_count?: number;
}

interface Post {
  id: string;
  message: string;
  create_at: number;
  user_id: string;
  username?: string;
}

interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

const PLACEHOLDER_CHANNELS: Channel[] = [
  { id: '1', display_name: 'General', name: 'general', type: 'O', total_msg_count: 142 },
  { id: '2', display_name: 'Tax Season 2026', name: 'tax-season-2026', type: 'O', total_msg_count: 89 },
  { id: '3', display_name: 'Client Updates', name: 'client-updates', type: 'O', total_msg_count: 56 },
  { id: '4', display_name: 'Announcements', name: 'announcements', type: 'O', total_msg_count: 23 },
  { id: '5', display_name: 'Random', name: 'random', type: 'O', total_msg_count: 201 },
];

const PLACEHOLDER_POSTS: Record<string, Post[]> = {
  '1': [
    { id: 'p1', message: 'Good morning team! Reminder: Q1 tax filings are due April 15th.', create_at: Date.now() - 3600000 * 3, user_id: 'u1', username: 'admin' },
    { id: 'p2', message: 'Thanks for the reminder. I have 12 returns left to review.', create_at: Date.now() - 3600000 * 2.5, user_id: 'u2', username: 'sarah.j' },
    { id: 'p3', message: 'Acme Corp sent over their updated W-2s. I uploaded them to Documents.', create_at: Date.now() - 3600000 * 2, user_id: 'u3', username: 'mike.c' },
    { id: 'p4', message: 'Perfect, I\'ll review those today. Also, the new payroll integration is working great.', create_at: Date.now() - 3600000, user_id: 'u1', username: 'admin' },
    { id: 'p5', message: 'Has anyone heard back from Summit Partners about their extension?', create_at: Date.now() - 1800000, user_id: 'u4', username: 'lisa.p' },
  ],
  '2': [
    { id: 'p6', message: 'Tax season checklist updated in the shared drive.', create_at: Date.now() - 86400000, user_id: 'u1', username: 'admin' },
    { id: 'p7', message: 'All individual returns for A-M clients are filed.', create_at: Date.now() - 43200000, user_id: 'u2', username: 'sarah.j' },
  ],
  '3': [
    { id: 'p8', message: 'New client onboarded: GreenTech Solutions. S-Corp, $2.1M revenue.', create_at: Date.now() - 172800000, user_id: 'u3', username: 'mike.c' },
  ],
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDay(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string) {
  return name.split(/[._-]/).map(p => p[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join('');
}

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500'];
function userColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<string>('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [usePlaceholder, setUsePlaceholder] = useState(false);

  useEffect(() => {
    async function fetchChannels() {
      try {
        const [cRes, uRes] = await Promise.all([
          fetch(apiUrl('/api/services/mattermost/channels')),
          fetch(apiUrl('/api/services/mattermost/users')),
        ]);
        if (cRes.ok) {
          const data = await cRes.json();
          const list = Array.isArray(data) ? data : [];
          if (list.length > 0) {
            setChannels(list);
            setActiveChannel(list[0].id);
          } else {
            setUsePlaceholder(true);
            setChannels(PLACEHOLDER_CHANNELS);
            setActiveChannel(PLACEHOLDER_CHANNELS[0].id);
          }
        } else {
          setUsePlaceholder(true);
          setChannels(PLACEHOLDER_CHANNELS);
          setActiveChannel(PLACEHOLDER_CHANNELS[0].id);
        }
        if (uRes.ok) {
          const data = await uRes.json();
          const map: Record<string, User> = {};
          (Array.isArray(data) ? data : []).forEach((u: User) => { map[u.id] = u; });
          setUsers(map);
        }
      } catch {
        setUsePlaceholder(true);
        setChannels(PLACEHOLDER_CHANNELS);
        setActiveChannel(PLACEHOLDER_CHANNELS[0].id);
      }
      setLoading(false);
    }
    fetchChannels();
  }, []);

  const fetchPosts = useCallback(async (channelId: string) => {
    if (usePlaceholder) {
      setPosts(PLACEHOLDER_POSTS[channelId] || []);
      return;
    }
    setLoadingPosts(true);
    try {
      const res = await fetch(apiUrl(`/api/services/mattermost/channels/${channelId}/posts`));
      if (res.ok) {
        const data = await res.json();
        if (data.order && data.posts) {
          const list = data.order.map((id: string) => data.posts[id]).filter(Boolean);
          list.reverse();
          setPosts(list);
        } else {
          setPosts([]);
        }
      }
    } catch {
      setPosts(PLACEHOLDER_POSTS[channelId] || []);
    }
    setLoadingPosts(false);
  }, [usePlaceholder]);

  useEffect(() => {
    if (activeChannel) fetchPosts(activeChannel);
  }, [activeChannel, fetchPosts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  // Poll for new messages
  useEffect(() => {
    if (!activeChannel) return;
    const interval = setInterval(() => fetchPosts(activeChannel), 10000);
    return () => clearInterval(interval);
  }, [activeChannel, fetchPosts]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !activeChannel) return;
    setSending(true);
    if (usePlaceholder) {
      setPosts((prev) => [...prev, {
        id: `p-${Date.now()}`,
        message: message.trim(),
        create_at: Date.now(),
        user_id: 'u1',
        username: 'admin',
      }]);
      setMessage('');
      setSending(false);
      return;
    }
    try {
      await fetch(apiUrl(`/api/services/mattermost/channels/${activeChannel}/posts`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: activeChannel, message: message.trim() }),
      });
      setMessage('');
      fetchPosts(activeChannel);
    } catch { /* silent */ }
    setSending(false);
  };

  const activeChannelName = channels.find(c => c.id === activeChannel)?.display_name || 'Select a channel';

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Team Chat</h1>
        <p className="text-gray-500 text-sm mt-1">Communicate with your team in real time</p>
      </div>

      <div className="card overflow-hidden flex" style={{ height: 'calc(100vh - 12rem)' }}>
        {/* Channel List */}
        <div className="w-56 lg:w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Channels</h3>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-2.5"><div className="skeleton h-4 w-28" /></div>
              ))
            ) : (
              channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    activeChannel === ch.id
                      ? 'bg-brand-50 text-brand-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-gray-400 mr-1">#</span>
                  {ch.display_name || ch.name}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Header */}
          <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2">
            <span className="text-gray-400 text-lg">#</span>
            <h2 className="font-semibold text-gray-900">{activeChannelName}</h2>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {loadingPosts ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="skeleton w-9 h-9 rounded-full flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="skeleton h-4 w-24" />
                    <div className="skeleton h-4 w-3/4" />
                  </div>
                </div>
              ))
            ) : posts.length > 0 ? (
              posts.map((post, idx) => {
                const prevPost = idx > 0 ? posts[idx - 1] : null;
                const showDay = !prevPost || formatDay(post.create_at) !== formatDay(prevPost.create_at);
                const uname = post.username || users[post.user_id]?.username || 'user';
                return (
                  <div key={post.id}>
                    {showDay && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">{formatDay(post.create_at)}</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}
                    <div className="flex gap-3 group hover:bg-gray-50 -mx-2 px-2 py-1 rounded-lg">
                      <div className={`w-9 h-9 rounded-full ${userColor(post.user_id)} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-xs font-medium text-white">{getInitials(uname)}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-gray-900">{uname}</span>
                          <span className="text-xs text-gray-400">{formatTime(post.create_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{post.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No messages in this channel yet
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="px-4 py-3 border-t border-gray-200">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Message #${activeChannelName}...`}
                className="input flex-1"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !message.trim()}
                className="btn-primary px-4 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
