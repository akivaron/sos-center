import AsyncStorage from "@react-native-async-storage/async-storage";

import { api } from "../api";
import type { QueuedSOS } from "../types";

const QUEUE_KEY = "resq-sos-queue-v1";

async function readQueue(): Promise<QueuedSOS[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(QUEUE_KEY)) ?? "[]");
  } catch {
    return [];
  }
}

export async function queueSOS(signal: QueuedSOS) {
  const queue = await readQueue();
  if (!queue.some((item) => item.client_event_id === signal.client_event_id)) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, signal]));
  }
}

export async function flushSOSQueue() {
  const queue = await readQueue();
  const remaining: QueuedSOS[] = [];
  for (const signal of queue) {
    try {
      await api.sendSOS(signal);
    } catch {
      remaining.push(signal);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { sent: queue.length - remaining.length, remaining: remaining.length };
}