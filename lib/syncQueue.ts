import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const QUEUE_KEY = 'meep-sync-queue';

interface QueueItem {
  type: 'upsert' | 'delete';
  table: string;
  data: any;
  timestamp: number;
}

async function getQueue(): Promise<QueueItem[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function addToQueue(item: Omit<QueueItem, 'timestamp'>): Promise<void> {
  const queue = await getQueue();
  queue.push({ ...item, timestamp: Date.now() });
  await saveQueue(queue);
}

export async function flushQueue(): Promise<void> {
  const queue = await getQueue();
  if (queue.length === 0) return;

  const remaining: QueueItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'upsert') {
        const { error } = await supabase.from(item.table).upsert(item.data);
        if (error) {
          remaining.push(item);
        }
      } else if (item.type === 'delete') {
        const { error } = await supabase.from(item.table).delete().eq('id', item.data.id);
        if (error) {
          remaining.push(item);
        }
      }
    } catch {
      remaining.push(item);
    }
  }

  await saveQueue(remaining);
}
