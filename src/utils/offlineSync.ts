export interface QueuedOfflineMessage {
  clientTempId: string;
  chatId: string;
  text: string;
  queuedAt: string;
}

const QUEUE_KEY = 'kora_offline_queue_v1';
const SNAPSHOT_KEY = 'kora_cached_snapshot_v1';

export function loadOfflineQueue(): QueuedOfflineMessage[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(queue: QueuedOfflineMessage[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota issues
  }
}

export function enqueueOfflineMessage(item: QueuedOfflineMessage): QueuedOfflineMessage[] {
  const current = loadOfflineQueue();
  const next = [...current, item];
  saveOfflineQueue(next);
  return next;
}

export function saveCachedSnapshot<T>(snapshot: T): void {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota issues
  }
}

export function loadCachedSnapshot<T>(): T | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function createSyncChannel(onMessage: (event: { type: string }) => void): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  const channel = new BroadcastChannel('kora_realtime_sync');
  channel.onmessage = (ev) => {
    if (ev.data && typeof ev.data.type === 'string') {
      onMessage(ev.data);
    }
  };
  return channel;
}
