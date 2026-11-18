import { useState } from 'react';
import { Clock, Heart, MapPin, MessageCircle, Radio, ShieldCheck } from 'lucide-react';
import { Conversation, FREE_MESSAGES_PER_CHAT, Profile } from '../domain/datingEngine';
import { GeoPoint, getProfileBadges, HUB_LOCATIONS } from '../domain/nearbyLocator';
import { NearbyLocatorPanel } from './NearbyLocatorPanel';

interface DiscoverViewProps {
  profiles: Profile[];
  conversations: Conversation[];
  origin?: GeoPoint;
  onUpdateLocation: (lat: number, lng: number, label: string) => Promise<void>;
  onToggleLike: (profileId: string) => Promise<void>;
  onStartChat: (profileId: string) => Promise<void>;
  onSyncNearbyChats?: (radiusKm: number | null, onlineOnly: boolean) => Promise<void>;
}

export function DiscoverView({
  profiles,
  conversations,
  origin,
  onUpdateLocation,
  onToggleLike,
  onStartChat,
  onSyncNearbyChats,
}: DiscoverViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'online'>('all');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeOrigin = origin ?? HUB_LOCATIONS.kampala;
  const visibleProfiles =
    statusFilter === 'online'
      ? profiles.filter((p) => p.onlineStatus === 'online')
      : profiles;

  const getFreeRemainingForProfile = (profileId: string) => {
    const existing = conversations.find((c) => c.matchId === profileId);
    if (!existing) return FREE_MESSAGES_PER_CHAT;
    return Math.max(0, FREE_MESSAGES_PER_CHAT - existing.freeMessagesUsed);
  };

  const isInActiveChats = (profileId: string) =>
    conversations.some((c) => c.matchId === profileId);

  const handleMessageClick = async (profileId: string) => {
    setBusyId(profileId);
    try {
      await onStartChat(profileId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Discover matches and nearby online locator" className="space-y-5">
      {/* Compact Hero + Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
            Discover &amp; Nearby Online Locator
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
            Free matching and live proximity radar · Nearby people automatically join your chat list with 4 free messages.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[34px] ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            All Members ({profiles.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('online')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[34px] ${
              statusFilter === 'online'
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Online Now ({profiles.filter((p) => p.onlineStatus === 'online').length})
          </button>
        </div>
      </div>

      {/* Interactive Nearby Online Locator */}
      <NearbyLocatorPanel
        profiles={profiles}
        conversations={conversations}
        origin={activeOrigin}
        onUpdateLocation={onUpdateLocation}
        onStartChat={onStartChat}
        onSyncNearbyChats={onSyncNearbyChats}
      />

      {/* Compact, High-Density Editorial Match Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleProfiles.map((profile) => {
          const freeLeft = getFreeRemainingForProfile(profile.id);
          const inChats = isInActiveChats(profile.id);
          const imageFailed = failedImages[profile.id];
          const badges = getProfileBadges(profile);
          const activityBadge = badges.find(
            (b) => b.kind === 'online_now' || b.kind === 'recently_online',
          );
          const verifiedBadge = badges.find((b) => b.kind === 'verified');

          return (
            <article
              key={profile.id}
              data-testid={`profile-card-${profile.id}`}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="relative h-64 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                {!imageFailed ? (
                  <img
                    src={profile.imageUrl}
                    alt={`${profile.name}, ${profile.age} in ${profile.city}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [profile.id]: true }))
                    }
                    className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900 p-4 text-center">
                    <span className="text-2xl font-display font-bold text-zinc-600 dark:text-zinc-300">
                      {profile.name.slice(0, 1)}
                    </span>
                  </div>
                )}

                {/* Top Trust & Engagement Badges */}
                <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 pointer-events-none">
                  {activityBadge ? (
                    <span
                      data-testid={`badge-activity-${profile.id}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold backdrop-blur-sm border shadow-xs ${
                        activityBadge.kind === 'online_now'
                          ? 'bg-emerald-950/85 text-emerald-200 border-emerald-500/40'
                          : 'bg-amber-950/85 text-amber-200 border-amber-500/40'
                      }`}
                    >
                      {activityBadge.kind === 'online_now' ? (
                        <Radio className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                      ) : (
                        <Clock className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                      )}
                      {activityBadge.label}
                    </span>
                  ) : (
                    <span />
                  )}

                  {verifiedBadge && (
                    <span
                      data-testid={`badge-verified-${profile.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-950/85 text-zinc-50 border border-white/15 backdrop-blur-sm text-[11px] font-semibold shadow-xs"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                      {verifiedBadge.label}
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

                <div className="absolute bottom-3 left-4 right-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold tracking-tight">
                      {profile.name}, {profile.age}
                    </h2>
                    {inChats && (
                      <span className="text-[11px] font-mono text-emerald-300 font-medium shrink-0">
                        In Chats
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-200 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
                    <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>
                      {profile.city} · {profile.distanceKm} km · {profile.lastActive}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
                    {profile.occupation} · {profile.interests.join(' · ')}
                  </p>
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 mt-1.5 leading-relaxed line-clamp-2">
                    {profile.bio}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {freeLeft > 0
                        ? `${freeLeft} of 4 free messages left`
                        : 'Free allowance used · 1 coin/msg'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProfile(profile)}
                      className="font-medium text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 hover:underline"
                    >
                      View profile
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleLike(profile.id)}
                      aria-label={profile.liked ? `Unlike ${profile.name}` : `Like ${profile.name}`}
                      className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        profile.liked
                          ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${profile.liked ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      {profile.liked ? 'Liked' : 'Like'}
                    </button>

                    <button
                      type="button"
                      disabled={busyId === profile.id}
                      onClick={() => handleMessageClick(profile.id)}
                      className="flex-1 min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-60"
                    >
                      <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {busyId === profile.id
                        ? 'Opening...'
                        : freeLeft > 0
                          ? `Message (${freeLeft} free)`
                          : 'Open Chat'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full overflow-hidden">
            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="profile-modal-title" className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    {selectedProfile.name}, {selectedProfile.age}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono">
                    {selectedProfile.occupation} · {selectedProfile.city} · {selectedProfile.distanceKm} km · {selectedProfile.lastActive}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {getProfileBadges(selectedProfile).map((badge) => (
                      <span
                        key={badge.kind}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          badge.kind === 'verified'
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700'
                            : badge.kind === 'online_now'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900'
                        }`}
                      >
                        {badge.kind === 'verified' ? (
                          <ShieldCheck className="w-3 h-3 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                        ) : badge.kind === 'online_now' ? (
                          <Radio className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <Clock className="w-3 h-3" aria-hidden="true" />
                        )}
                        {badge.label}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="min-h-[38px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Close
                </button>
              </div>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {selectedProfile.bio}
              </p>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Interests: {selectedProfile.interests.join(' · ')}
              </div>
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const id = selectedProfile.id;
                    setSelectedProfile(null);
                    await handleMessageClick(id);
                  }}
                  className="min-h-[42px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
                >
                  Start Free Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
