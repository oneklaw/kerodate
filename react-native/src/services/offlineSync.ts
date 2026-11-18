import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_QUEUE_KEY = 'kora_rn_offline_queue_v1';

export interface OutgoingMessageItem {
  clientTempId: string;
  chatId: string;
  text: string;
  queuedAt: string;
}

export async function sendOrQueueMessage(
  apiBaseUrl: string,
  authToken: string,
  item: OutgoingMessageItem,
): Promise<{ status: 'synced' | 'queued' }> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OutgoingMessageItem[] = raw ? JSON.parse(raw) : [];
    queue.push(item);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return { status: 'queued' };
  }

  await fetch(`${apiBaseUrl}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ messages: [item] }),
  });

  return { status: 'synced' };
}
