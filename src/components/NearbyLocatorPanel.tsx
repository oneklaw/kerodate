import { useMemo, useState } from 'react';
import {
  Compass,
  Crosshair,
  MapPin,
  MessageCircle,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import {
  Conversation,
  FREE_MESSAGES_PER_CHAT,
  Profile,
} from '../domain/datingEngine';
import {
  GeoPoint,
  HUB_LOCATIONS,
  locateNearbyProfiles,
  LocatedProfile,
} from '../domain/nearbyLocator';

interface NearbyLocatorPanelProps {
  profiles: Profile[];
  conversations: Conversation[];
  origin: GeoPoint;
  onUpdateLocation: (lat: number, lng: number, label: string) => Promise<void>;
  onStartChat: (profileId: string) => Promise<void>;
  onSyncNearbyChats?: (radiusKm: number | null, onlineOnly: boolean) => Promise<void>;
}

const RADIUS_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '3 km', value: 3 },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: 'All', value: null },
];

export function NearbyLocatorPanel({
  profiles,
  conversations,
  origin,
  onUpdateLocation,
  onStartChat,
  onSyncNearbyChats,
}: NearbyLocatorPanelProps) {
  const [radiusKm, setRadiusKm] = useState<number | null>(10);
  const [onlineOnly, setOnlineOnly] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const nearby = useMemo(
    () =>
      locateNearbyProfiles(profiles, origin, {
        maxRadiusKm: radiusKm,
        onlineOnly,
      }),
    [profiles, origin, radiusKm, onlineOnly],
  );

  const activeMember: LocatedProfile | null = useMemo(() => {
    if (nearby.length === 0) return null;
    return nearby.find((p) => p.id === selectedId) ?? nearby[0];
  }, [nearby, selectedId]);

  const maxPlotRadius = radiusKm ?? Math.max(15, ...nearby.map((p) => p.computedDistanceKm + 2));

  const getFreeRemaining = (profileId: string) => {
    const conv = conversations.find((c) => c.matchId === profileId);
    return conv ? Math.max(0, FREE_MESSAGES_PER_CHAT - conv.freeMessagesUsed) : FREE_MESSAGES_PER_CHAT;
  };

  const handleUseGps = () => {
    setGpsStatus(null);
    if (!navigator.geolocation) {
      setGpsStatus('Browser geolocation unavailable. Select a hub city below.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await onUpdateLocation(
            Number(pos.coords.latitude.toFixed(4)),
            Number(pos.coords.longitude.toFixed(4)),
            'Live GPS Position',
          );
          setGpsStatus(
            `GPS locked (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`,
          );
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setGpsStatus('Location permission denied — using active city hub coordinates.');
      },
      { timeout: 6000 },
    );
  };

  return (
    <div
      data-testid="nearby-online-locator"
      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12"
    >
      {/* Left: Interactive Geolocation Radar & Spatial Pin Plot */}
      <div className="lg:col-span-7 p-4 sm:p-5 border-b lg:border-b-0 lg:border-r border-zinc-200 dark:border-zinc-800 flex flex-col justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-950/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              Nearby Online Locator
            </p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {nearby.length} {onlineOnly ? 'online' : 'active'} member{nearby.length === 1 ? '' : 's'} near {origin.label}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlineOnly((v) => !v)}
              className={`min-h-[36px] px-3 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                onlineOnly
                  ? 'border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'
              }`}
            >
              {onlineOnly ? 'Online Now Only' : 'Show Away Too'}
            </button>

            <button
              type="button"
              disabled={locating}
              onClick={handleUseGps}
              className="min-h-[36px] px-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
            >
              <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
              {locating ? 'Locating...' : 'Use My GPS'}
            </button>
          </div>
        </div>

        {/* Spatial Polar Locator Grid */}
        <div className="relative h-64 sm:h-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
          {/* Concentric Radar Rings + Crosshairs */}
          <svg
            viewBox="0 0 400 260"
            className="w-full h-full pointer-events-none select-none"
            aria-hidden="true"
          >
            <defs>
              <pattern id="kero-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.5"
                  className="text-zinc-200/70 dark:text-zinc-800/70"
                />
              </pattern>
            </defs>
            <rect width="400" height="260" fill="url(#kero-grid)" />
            <line x1="200" y1="8" x2="200" y2="252" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-300 dark:text-zinc-700" />
            <line x1="20" y1="130" x2="380" y2="130" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-300 dark:text-zinc-700" />
            <circle cx="200" cy="130" r="42" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <circle cx="200" cy="130" r="84" fill="none" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
            <circle cx="200" cy="130" r="118" fill="none" stroke="currentColor" className="text-rose-500/25" />
            <text x="200" y="20" textAnchor="middle" className="fill-zinc-400 text-[9px] font-mono">N</text>
            <text x="200" y="250" textAnchor="middle" className="fill-zinc-400 text-[9px] font-mono">S</text>
            <text x="372" y="133" textAnchor="end" className="fill-zinc-400 text-[9px] font-mono">E</text>
            <text x="28" y="133" textAnchor="start" className="fill-zinc-400 text-[9px] font-mono">W</text>
          </svg>

          {/* Center Origin Pin */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            aria-label="Your current origin"
          >
            <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shadow-md ring-4 ring-rose-500/20">
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <span className="mt-1 px-1.5 py-0.5 rounded bg-zinc-900/85 dark:bg-zinc-100/90 text-white dark:text-zinc-900 text-[10px] font-mono font-semibold">
              You
            </span>
          </div>

          {/* Located Member Pins */}
          {(() => {
            const placed = nearby.map((member) => {
              const ratio = 0.34 + Math.min(1, member.computedDistanceKm / maxPlotRadius) * 0.52;
              const rad = ((member.bearingDeg - 90) * Math.PI) / 180;
              return {
                member,
                xPct: 50 + Math.cos(rad) * ratio * 38,
                yPct: 50 + Math.sin(rad) * ratio * 40,
              };
            });

            // Repel overlapping pins gently so every pin has an unobstructed hitbox
            for (let pass = 0; pass < 3; pass += 1) {
              for (let i = 0; i < placed.length; i += 1) {
                for (let j = i + 1; j < placed.length; j += 1) {
                  const dx = placed[j].xPct - placed[i].xPct;
                  const dy = placed[j].yPct - placed[i].yPct;
                  const dist = Math.hypot(dx, dy);
                  if (dist < 16) {
                    const angle = dist > 0.1 ? Math.atan2(dy, dx) : (i + 1) * 1.1;
                    const push = (16 - dist) / 2 + 1;
                    placed[i].xPct = Math.max(12, Math.min(88, placed[i].xPct - Math.cos(angle) * push));
                    placed[i].yPct = Math.max(16, Math.min(84, placed[i].yPct - Math.sin(angle) * push));
                    placed[j].xPct = Math.max(12, Math.min(88, placed[j].xPct + Math.cos(angle) * push));
                    placed[j].yPct = Math.max(16, Math.min(84, placed[j].yPct + Math.sin(angle) * push));
                  }
                }
              }
            }

            return placed.map(({ member, xPct, yPct }) => {
              const isSelected = activeMember?.id === member.id;
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedId(member.id)}
                  aria-label={`Select ${member.name}, ${member.computedDistanceKm} km ${member.compassDirection}`}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-transform ${
                    isSelected ? 'z-30 scale-105' : 'z-10 hover:z-20 hover:scale-105'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-full p-0.5 shadow-md transition-colors ${
                      isSelected
                        ? 'bg-rose-600 ring-4 ring-rose-500/25'
                        : member.onlineStatus === 'online'
                          ? 'bg-emerald-600'
                          : 'bg-zinc-400'
                    }`}
                  >
                    <img
                      src={member.imageUrl}
                      alt={member.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full rounded-full object-cover object-top"
                    />
                  </div>
                  <span
                    className={`mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold whitespace-nowrap shadow-sm ${
                      isSelected
                        ? 'bg-rose-600 text-white'
                        : 'bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    {member.name} · {member.computedDistanceKm}km
                  </span>
                </button>
              );
            });
          })()}
        </div>

        {/* Radius + Hub Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            {RADIUS_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  setRadiusKm(opt.value);
                  onSyncNearbyChats?.(opt.value, false);
                }}
                className={`px-2.5 py-1 rounded-md font-mono tabular-nums font-medium transition-colors ${
                  radiusKm === opt.value
                    ? 'bg-rose-600 text-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <label htmlFor="hub-select" className="text-zinc-500 dark:text-zinc-400">
              Hub:
            </label>
            <select
              id="hub-select"
              value=""
              onChange={(e) => {
                const hub = HUB_LOCATIONS[e.target.value];
                if (hub) onUpdateLocation(hub.lat, hub.lng, hub.label);
              }}
              className="min-h-[32px] px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200"
            >
              <option value="" disabled>
                {origin.label}
              </option>
              {Object.entries(HUB_LOCATIONS).map(([key, hub]) => (
                <option key={key} value={key}>
                  {hub.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {gpsStatus && (
          <p className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">{gpsStatus}</p>
        )}
      </div>

      {/* Right: Selected Pin Spotlight + Quick Nearby List */}
      <div className="lg:col-span-5 p-4 sm:p-5 flex flex-col justify-between gap-4">
        {activeMember ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3.5">
              <img
                src={activeMember.imageUrl}
                alt={activeMember.name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-xl object-cover object-top shrink-0 bg-zinc-200 dark:bg-zinc-800"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 truncate">
                    {activeMember.name}, {activeMember.age}
                  </h3>
                  {activeMember.verified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 shrink-0">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1.5 font-mono tabular-nums">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-rose-600" aria-hidden="true" />
                  <span>
                    {activeMember.computedDistanceKm} km {activeMember.compassDirection} · {activeMember.lastActive}
                  </span>
                </p>
                <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mt-1">
                  {activeMember.occupation} · {activeMember.interests.join(' · ')}
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {activeMember.bio}
            </p>

            <button
              type="button"
              onClick={() => onStartChat(activeMember.id)}
              className="w-full min-h-[42px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Message {activeMember.name} ({getFreeRemaining(activeMember.id)} free)
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
              No online members inside {radiusKm} km
            </p>
            <p>Expand the distance radius or include recently active profiles.</p>
            <button
              type="button"
              onClick={() => {
                setRadiusKm(25);
                setOnlineOnly(false);
              }}
              className="min-h-[36px] px-3 rounded-lg bg-rose-600 text-white font-semibold"
            >
              Expand to 25 km
            </button>
          </div>
        )}

        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <p className="font-semibold text-zinc-500 dark:text-zinc-400">
              Nearby Roster ({nearby.length})
            </p>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">
              Auto-synced to Chats
            </span>
          </div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-40 overflow-y-auto">
            {nearby.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={`w-full py-2 px-2 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                  activeMember?.id === m.id
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 text-zinc-900 dark:text-zinc-50'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                <span className="font-medium truncate">
                  {m.name} · {m.lastActive}
                </span>
                <span className="font-mono tabular-nums text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 ml-2">
                  {m.computedDistanceKm} km {m.compassDirection}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
