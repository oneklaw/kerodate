import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bearingToCompass,
  calculateBearingDeg,
  calculateHaversineKm,
  getProfileBadges,
  HUB_LOCATIONS,
  locateNearbyProfiles,
  syncNearbyProfilesToConversations,
} from './nearbyLocator';
import { Conversation, Profile } from './datingEngine';

const sampleProfiles: Profile[] = [
  {
    id: 'p1',
    name: 'Amara',
    age: 27,
    city: 'Kampala',
    occupation: 'Architect',
    bio: 'Bio 1',
    interests: ['Coffee'],
    imageUrl: '/a.jpg',
    verified: true,
    lastActive: 'Online now',
    lastActiveMinutes: 0,
    onlineStatus: 'online',
    lat: 0.358,
    lng: 32.598,
    distanceKm: 2.1,
  },
  {
    id: 'p2',
    name: 'David',
    age: 32,
    city: 'Kampala',
    occupation: 'Photographer',
    bio: 'Bio 2',
    interests: ['Film'],
    imageUrl: '/b.jpg',
    verified: true,
    lastActive: 'Active 18m ago',
    lastActiveMinutes: 18,
    onlineStatus: 'away',
    lat: 0.39,
    lng: 32.62,
    distanceKm: 6.3,
  },
  {
    id: 'p3',
    name: 'Nadia',
    age: 28,
    city: 'Kampala',
    occupation: 'Designer',
    bio: 'Bio 3',
    interests: ['Ceramics'],
    imageUrl: '/c.jpg',
    verified: true,
    lastActive: 'Online now',
    lastActiveMinutes: 0,
    onlineStatus: 'online',
    lat: 0.52,
    lng: 32.75,
    distanceKm: 26,
  },
];

test('haversine distance and bearing compute accurate coordinates', () => {
  const origin = HUB_LOCATIONS.kampala;
  const dist = calculateHaversineKm(origin, { lat: 0.358, lng: 32.598 });
  assert.ok(dist > 1.5 && dist < 3.0);

  const bearing = calculateBearingDeg(origin, { lat: 0.358, lng: 32.598 });
  assert.equal(bearingToCompass(bearing), 'NE');
});

test('locateNearbyProfiles filters by onlineStatus and maxRadiusKm and prioritizes online', () => {
  const origin = HUB_LOCATIONS.kampala;

  const onlineWithin10 = locateNearbyProfiles(sampleProfiles, origin, {
    maxRadiusKm: 10,
    onlineOnly: true,
  });
  assert.equal(onlineWithin10.length, 1);
  assert.equal(onlineWithin10[0].id, 'p1');

  const allWithin10 = locateNearbyProfiles(sampleProfiles, origin, {
    maxRadiusKm: 10,
    onlineOnly: false,
  });
  assert.equal(allWithin10.length, 2);
  assert.equal(allWithin10[0].id, 'p1');
  assert.equal(allWithin10[1].id, 'p2');
});

test('getProfileBadges returns Verified Member, Online Now, and Recently Online trust badges', () => {
  const onlineBadges = getProfileBadges(sampleProfiles[0]);
  assert.deepEqual(
    onlineBadges.map((b) => b.label),
    ['Online Now', 'Verified Member'],
  );

  const recentBadges = getProfileBadges(sampleProfiles[1]);
  assert.deepEqual(
    recentBadges.map((b) => b.label),
    ['Recently Online', 'Verified Member'],
  );
});

test('syncNearbyProfilesToConversations automatically brings nearby people into chat without duplicates', () => {
  const origin = HUB_LOCATIONS.kampala;
  const existing: Conversation[] = [
    {
      id: 'chat_amara',
      matchId: 'p1',
      freeMessagesUsed: 1,
      totalMessagesSent: 1,
      updatedAt: '2026-11-18T10:00:00.000Z',
      messages: [],
    },
  ];

  const synced = syncNearbyProfilesToConversations(sampleProfiles, existing, origin, {
    maxRadiusKm: 10,
    onlineOnly: false,
    nowIso: '2026-11-18T10:05:00.000Z',
  });

  assert.deepEqual(synced.addedMatchIds, ['p2']);
  assert.equal(synced.conversations.length, 2);
  assert.equal(synced.conversations[1].matchId, 'p2');
  assert.equal(synced.conversations[1].freeMessagesUsed, 0);
  assert.ok(synced.conversations[1].messages[0].text.includes('4 free messages'));
});
