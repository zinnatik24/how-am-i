import AsyncStorage from '@react-native-async-storage/async-storage';
import { FriendRecord } from '../types';

const STORAGE_KEY_FRIENDS = '@how_we_feel_friends_v1';

const DEFAULT_FRIENDS: FriendRecord[] = [
  {
    id: 'f-1',
    name: 'Аня (Партнёр)',
    relationship: 'partner',
    avatarColor: '#F4A261',
    lastCheckIn: {
      quadrantId: 'high_pleasant',
      emotionId: 'joyful',
      emotionName: 'Радость',
      timeAgo: '1 час назад',
      note: 'Успешный проект и классный солнечный день!',
    },
  },
  {
    id: 'f-2',
    name: 'Максим (Друг)',
    relationship: 'friend',
    avatarColor: '#2A9D8F',
    lastCheckIn: {
      quadrantId: 'low_pleasant',
      emotionId: 'calm',
      emotionName: 'Спокойствие',
      timeAgo: '3 часа назад',
      note: 'Прогулка в парке после работы.',
    },
  },
  {
    id: 'f-3',
    name: 'Мама (Семья)',
    relationship: 'family',
    avatarColor: '#E63946',
    lastCheckIn: {
      quadrantId: 'high_unpleasant',
      emotionId: 'stressed',
      emotionName: 'Стресс',
      timeAgo: '5 часов назад',
      note: 'Много суеты и хлопот перед поездкой.',
    },
  },
];

export async function getFriends(): Promise<FriendRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_FRIENDS);
    if (!raw) {
      // Seed default circle
      await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(DEFAULT_FRIENDS));
      return DEFAULT_FRIENDS;
    }
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_FRIENDS;
  }
}

export async function addFriend(friend: FriendRecord): Promise<FriendRecord[]> {
  const current = await getFriends();
  const updated = [friend, ...current];
  await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
  return updated;
}

export async function deleteFriend(id: string): Promise<FriendRecord[]> {
  const current = await getFriends();
  const updated = current.filter((f) => f.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
  return updated;
}

export async function recordFriendReaction(friendId: string, reaction: string): Promise<FriendRecord[]> {
  const current = await getFriends();
  const updated = current.map((f) =>
    f.id === friendId ? { ...f, lastReactionSent: reaction } : f
  );
  await AsyncStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(updated));
  return updated;
}
