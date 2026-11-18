import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Lock, Send, WifiOff } from 'lucide-react';
import {
  Conversation,
  FREE_MESSAGES_PER_CHAT,
  Profile,
} from '../domain/datingEngine';

interface ChatViewProps {
  profiles: Profile[];
  conversations: Conversation[];
  activeChatId: string | null;
  coinBalance: number;
  isOffline: boolean;
  queuedCount: number;
  onSelectChat: (chatId: string) => void;
  onSendMessage: (chatId: string, text: string) => Promise<{ ok: boolean; error?: string; code?: number }>;
  onNavigateTopUp: () => void;
}

export function ChatView({
  profiles,
  conversations,
  activeChatId,
  coinBalance,
  isOffline,
  queuedCount,
  onSelectChat,
  onSendMessage,
  onNavigateTopUp,
}: ChatViewProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [needsTopUp, setNeedsTopUp] = useState(false);

  const selectedChat =
    conversations.find((c) => c.id === activeChatId) ?? conversations[0] ?? null;

  const getProfile = (matchId: string) =>
    profiles.find((p) => p.id === matchId);

  const selectedProfile = selectedChat ? getProfile(selectedChat.matchId) : undefined;
  const freeRemaining = selectedChat
    ? Math.max(0, FREE_MESSAGES_PER_CHAT - selectedChat.freeMessagesUsed)
    : 0;

  const messagesListRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = messagesListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [selectedChat?.id, selectedChat?.messages.length]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !draft.trim() || sending) return;
    setFeedbackError(null);
    setNeedsTopUp(false);
    setSending(true);
    try {
      const result = await onSendMessage(selectedChat.id, draft);
      if (result.ok) {
        setDraft('');
      } else {
        setFeedbackError(result.error ?? 'Could not send message.');
        if (result.code === 402) {
          setNeedsTopUp(true);
        }
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Messages" className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[620px]">
      <aside className="lg:col-span-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Conversations</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {conversations.length} active · 4 free messages per new chat
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums font-semibold text-zinc-700 dark:text-zinc-300">
            {coinBalance} coins
          </span>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto flex-1">
          {conversations.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
              No active chats yet. Pick a match from Discover to start with 4 free messages.
            </div>
          ) : (
            conversations.map((conv) => {
              const match = getProfile(conv.matchId);
              const lastMsg = conv.messages[conv.messages.length - 1];
              const freeLeft = Math.max(0, FREE_MESSAGES_PER_CHAT - conv.freeMessagesUsed);
              const isActive = selectedChat?.id === conv.id;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => {
                    setFeedbackError(null);
                    setNeedsTopUp(false);
                    onSelectChat(conv.id);
                  }}
                  className={`w-full text-left px-5 py-4 flex items-start gap-3.5 transition-colors min-h-[64px] ${
                    isActive
                      ? 'bg-rose-50/60 dark:bg-rose-950/25'
                      : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <img
                    src={match?.imageUrl || ''}
                    alt={match?.name || 'Match'}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {match?.name ?? 'Match'}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
                        {freeLeft > 0 ? `${freeLeft}/4 free` : '1 coin/msg'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate mt-1">
                      {lastMsg ? lastMsg.text : 'Start the conversation'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="lg:col-span-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col overflow-hidden">
        {selectedChat && selectedProfile ? (
          <>
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedProfile.imageUrl}
                  alt={selectedProfile.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover bg-zinc-200 dark:bg-zinc-800"
                />
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                    {selectedProfile.name}, {selectedProfile.age}
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {selectedProfile.city} · {selectedProfile.occupation}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {freeRemaining > 0
                      ? `${freeRemaining} of 4 free messages remaining`
                      : 'Metered rate: 1 coin per message'}
                  </p>
                  <div className="w-44 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-rose-600 transition-all duration-200"
                      style={{
                        width: `${((FREE_MESSAGES_PER_CHAT - freeRemaining) / FREE_MESSAGES_PER_CHAT) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {isOffline && (
              <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                <span className="flex items-center gap-2 font-medium">
                  <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  Offline mode active — messages queue locally and sync automatically on reconnect.
                </span>
                <span className="font-mono tabular-nums">{queuedCount} queued</span>
              </div>
            )}

            <div
              ref={messagesListRef}
              data-testid="chat-messages-list"
              className="flex-1 p-6 pb-7 space-y-4 overflow-y-auto max-h-[420px] bg-zinc-50/50 dark:bg-zinc-950/40"
            >
              {selectedChat.messages.map((msg) => {
                const isMe = msg.sender === 'me';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isMe
                          ? 'bg-rose-600 text-white'
                          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <div className="mt-1 px-1 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tabular-nums flex items-center gap-1.5">
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {isMe && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {msg.syncStatus === 'queued'
                              ? 'Queued offline'
                              : msg.isFreeMessage
                                ? 'Free message'
                                : `${msg.coinsCharged} coin`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {feedbackError && (
              <div
                role="alert"
                className="mx-6 mt-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  {feedbackError}
                </span>
                {needsTopUp && (
                  <button
                    type="button"
                    onClick={onNavigateTopUp}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold whitespace-nowrap shrink-0 flex items-center gap-1"
                  >
                    Top Up Coins
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
            >
              <div className="flex items-center gap-3">
                <label htmlFor="chat-message-input" className="sr-only">
                  Write a message to {selectedProfile.name}
                </label>
                <input
                  id="chat-message-input"
                  type="text"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={
                    freeRemaining > 0
                      ? `Write a free message (${freeRemaining} free left)...`
                      : coinBalance > 0
                        ? `Write a message (1 coin · ${coinBalance} remaining)...`
                        : 'Top up coins to continue messaging...'
                  }
                  className="flex-1 min-h-[44px] px-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-rose-600/40"
                />
                <button
                  type="submit"
                  disabled={sending || !draft.trim()}
                  className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  {freeRemaining === 0 && coinBalance === 0 ? (
                    <Lock className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Send className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{isOffline ? 'Queue' : 'Send'}</span>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            Select a conversation or start a new chat from Discover.
          </div>
        )}
      </div>
    </section>
  );
}
