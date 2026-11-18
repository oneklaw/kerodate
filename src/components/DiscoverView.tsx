import { useState } from 'react';
import { Heart, MessageCircle, MapPin, ShieldCheck } from 'lucide-react';
import { FREE_MESSAGES_PER_CHAT, Profile, Conversation } from '../domain/datingEngine';

interface DiscoverViewProps {
  profiles: Profile[];
  conversations: Conversation[];
  onToggleLike: (profileId: string) => Promise<void>;
  onStartChat: (profileId: string) => Promise<void>;
}

export function DiscoverView({
  profiles,
  conversations,
  onToggleLike,
  onStartChat,
}: DiscoverViewProps) {
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const cities = ['all', ...Array.from(new Set(profiles.map((p) => p.city)))];
  const visibleProfiles =
    cityFilter === 'all' ? profiles : profiles.filter((p) => p.city === cityFilter);

  const getFreeRemainingForProfile = (profileId: string) => {
    const existing = conversations.find((c) => c.matchId === profileId);
    if (!existing) return FREE_MESSAGES_PER_CHAT;
    return Math.max(0, FREE_MESSAGES_PER_CHAT - existing.freeMessagesUsed);
  };

  const handleMessageClick = async (profileId: string) => {
    setBusyId(profileId);
    try {
      await onStartChat(profileId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section aria-label="Discover matches" className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Free Discovery · Verified Members
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mt-1 text-balance">
            Meet intentional people near you
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">
            Browsing, matching, and profile filters are completely free. Every new conversation starts with 4 complimentary messages before coin metering applies.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto shrink-0">
          {cities.map((city) => (
            <button
              key={city}
              type="button"
              onClick={() => setCityFilter(city)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                cityFilter === city
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              {city === 'all' ? 'All Cities' : city}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleProfiles.map((profile) => {
          const freeLeft = getFreeRemainingForProfile(profile.id);
          const imageFailed = failedImages[profile.id];

          return (
            <article
              key={profile.id}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="relative aspect-[3/4] bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                {!imageFailed ? (
                  <img
                    src={profile.imageUrl}
                    alt={`${profile.name}, ${profile.age} in ${profile.city}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [profile.id]: true }))
                    }
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900 p-6 text-center">
                    <span className="text-3xl font-display font-bold text-zinc-600 dark:text-zinc-300">
                      {profile.name.slice(0, 1)}
                    </span>
                    <span className="text-xs text-zinc-500 mt-1">{profile.name}</span>
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/35 to-transparent pointer-events-none" />

                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xl font-bold tracking-tight">
                      {profile.name}, {profile.age}
                    </h2>
                    {profile.verified && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-100"
                        title="Verified Profile"
                      >
                        <ShieldCheck className="w-4 h-4 text-rose-400" aria-hidden="true" />
                        Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-200 mt-0.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {profile.city} · {profile.distanceKm} km away · {profile.lastActive}
                    </span>
                  </p>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {profile.occupation} · {profile.interests.join(' · ')}
                  </p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2 leading-relaxed">
                    {profile.bio}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {freeLeft > 0
                        ? `${freeLeft} of 4 free messages left`
                        : 'Free allowance used · 1 coin/msg'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProfile(profile)}
                      className="font-medium text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 underline-offset-2 hover:underline"
                    >
                      View profile
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onToggleLike(profile.id)}
                      aria-label={profile.liked ? `Unlike ${profile.name}` : `Like ${profile.name}`}
                      className={`min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                        profile.liked
                          ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                          : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${profile.liked ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                      {profile.liked ? 'Liked' : 'Like'}
                    </button>

                    <button
                      type="button"
                      disabled={busyId === profile.id}
                      onClick={() => handleMessageClick(profile.id)}
                      className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap disabled:opacity-60"
                    >
                      <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      {busyId === profile.id
                        ? 'Opening chat...'
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
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="profile-modal-title" className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {selectedProfile.name}, {selectedProfile.age}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {selectedProfile.occupation} · {selectedProfile.city} · {selectedProfile.distanceKm} km away
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="min-h-[40px] px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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
              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    const id = selectedProfile.id;
                    setSelectedProfile(null);
                    await handleMessageClick(id);
                  }}
                  className="min-h-[44px] px-5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold"
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
