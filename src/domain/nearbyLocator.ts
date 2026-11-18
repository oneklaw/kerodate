import { Conversation, Profile } from './datingEngine';

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface LocatedProfile extends Profile {
  computedDistanceKm: number;
  bearingDeg: number;
  compassDirection: string;
}

export interface ProfileBadge {
  kind: 'verified' | 'online_now' | 'recently_online';
  label: string;
}

export interface AutoBringNearbyResult {
  conversations: Conversation[];
  addedMatchIds: string[];
  nearbyMatchIds: string[];
}

export const DEFAULT_AUTO_CHAT_RADIUS_KM = 10;

export const HUB_LOCATIONS: Record<string, GeoPoint> = {
  kampala: { lat: 0.3476, lng: 32.5825, label: 'Kampala Central' },
  london: { lat: 51.5074, lng: -0.1278, label: 'Central London' },
  milan: { lat: 45.4642, lng: 9.19, label: 'Milan Centro' },
  nairobi: { lat: -1.2921, lng: 36.8219, label: 'Nairobi Westlands' },
  copenhagen: { lat: 55.6761, lng: 12.5683, label: 'Copenhagen Indre By' },
};

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function calculateHaversineKm(a: GeoPoint, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((EARTH_RADIUS_KM * c).toFixed(1));
}

export function calculateBearingDeg(a: GeoPoint, b: { lat: number; lng: number }): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return Math.round(deg);
}

export function bearingToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

export function getProfileBadges(profile: Profile): ProfileBadge[] {
  const badges: ProfileBadge[] = [];
  if (profile.onlineStatus === 'online') {
    badges.push({ kind: 'online_now', label: 'Online Now' });
  } else if (profile.lastActiveMinutes <= 60) {
    badges.push({ kind: 'recently_online', label: 'Recently Online' });
  }
  if (profile.verified) {
    badges.push({ kind: 'verified', label: 'Verified Member' });
  }
  return badges;
}

export function locateNearbyProfiles(
  profiles: Profile[],
  origin: GeoPoint,
  options: {
    maxRadiusKm: number | null;
    onlineOnly: boolean;
  },
): LocatedProfile[] {
  const located = profiles.map((profile) => {
    const computedDistanceKm = calculateHaversineKm(origin, {
      lat: profile.lat,
      lng: profile.lng,
    });
    const bearingDeg = calculateBearingDeg(origin, {
      lat: profile.lat,
      lng: profile.lng,
    });
    return {
      ...profile,
      computedDistanceKm,
      bearingDeg,
      compassDirection: bearingToCompass(bearingDeg),
    };
  });

  return located
    .filter((p) => {
      if (options.onlineOnly && p.onlineStatus !== 'online') {
        return false;
      }
      if (options.maxRadiusKm !== null && p.computedDistanceKm > options.maxRadiusKm) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.onlineStatus === 'online' && b.onlineStatus !== 'online') return -1;
      if (a.onlineStatus !== 'online' && b.onlineStatus === 'online') return 1;
      return a.computedDistanceKm - b.computedDistanceKm;
    });
}

export function syncNearbyProfilesToConversations(
  profiles: Profile[],
  conversations: Conversation[],
  origin: GeoPoint,
  options?: {
    maxRadiusKm?: number | null;
    onlineOnly?: boolean;
    nowIso?: string;
  },
): AutoBringNearbyResult {
  const maxRadiusKm =
    options?.maxRadiusKm === undefined ? DEFAULT_AUTO_CHAT_RADIUS_KM : options.maxRadiusKm;
  const onlineOnly = options?.onlineOnly ?? false;
  const nowIso = options?.nowIso ?? new Date().toISOString();

  const nearby = locateNearbyProfiles(profiles, origin, {
    maxRadiusKm,
    onlineOnly,
  });

  const existingMatchIds = new Set(conversations.map((c) => c.matchId));
  const nextConversations = [...conversations];
  const addedMatchIds: string[] = [];

  for (const member of nearby) {
    if (existingMatchIds.has(member.id)) continue;
    const chatId = `chat_${member.name.toLowerCase()}`;
    const welcomeText = `Nearby match (${member.computedDistanceKm} km ${member.compassDirection} in ${member.city}) · ${member.lastActive}. You have 4 free messages to say hello!`;
    nextConversations.push({
      id: chatId,
      matchId: member.id,
      freeMessagesUsed: 0,
      totalMessagesSent: 0,
      updatedAt: nowIso,
      messages: [
        {
          id: `msg_nearby_${member.id}_${Date.parse(nowIso) || Date.now()}`,
          chatId,
          sender: 'match',
          text: welcomeText,
          createdAt: nowIso,
          isFreeMessage: false,
          coinsCharged: 0,
          syncStatus: 'synced',
        },
      ],
    });
    existingMatchIds.add(member.id);
    addedMatchIds.push(member.id);
  }

  return {
    conversations: nextConversations,
    addedMatchIds,
    nearbyMatchIds: nearby.map((m) => m.id),
  };
}
