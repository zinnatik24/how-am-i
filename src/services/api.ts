import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL =
  Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://how-am-i.famehub.ru';

const TOKEN_KEY = '@howami_auth_token';
const USER_KEY = '@howami_user_profile';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  inviteCode: string;
  pushToken?: string | null;
}

export interface PartnerProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  status: string;
}

export interface CloudCheckin {
  id: string;
  user_id: string;
  local_id?: string;
  emotion_id: string;
  energy: 'high' | 'low';
  pleasantness: 'pleasant' | 'unpleasant';
  intensity: number;
  quadrant: string;
  context_people: string[];
  context_place: string[];
  context_activity: string[];
  note?: string;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

// Token Storage
export async function getStoredToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setStoredToken(token: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function removeStoredToken(): Promise<void> {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function getStoredUser(): Promise<UserProfile | null> {
  const data = await AsyncStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

export async function setStoredUser(user: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

// API Helper
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

// 1. Google Auth
export async function loginWithGoogleApi(params: {
  idToken?: string;
  accessToken?: string;
}): Promise<{ token: string; user: UserProfile }> {
  const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  await setStoredToken(data.token);
  await setStoredUser(data.user);
  return data;
}

// 2. Demo Auth for immediate zero-config testing
export async function loginWithDemoApi(name: string, email: string): Promise<{ token: string; user: UserProfile }> {
  const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/demo', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  });
  await setStoredToken(data.token);
  await setStoredUser(data.user);
  return data;
}

// 3. Current User Profile
export async function fetchMe(): Promise<{ user: UserProfile; partners: PartnerProfile[] }> {
  const data = await apiFetch<{ user: UserProfile; partners: PartnerProfile[] }>('/api/auth/me', {
    method: 'GET',
  });
  if (data.user) {
    await setStoredUser(data.user);
  }
  return data;
}

// 4. Push Token Registration
export async function registerPushToken(pushToken: string): Promise<void> {
  try {
    await apiFetch('/api/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken }),
    });
  } catch (err) {
    console.warn('[API] Could not register push token:', err);
  }
}

// 5. Connect Partner with Invite Code
export async function connectPartnerApi(inviteCode: string): Promise<{ success: boolean; partner: PartnerProfile }> {
  return apiFetch<{ success: boolean; partner: PartnerProfile }>('/api/partner/connect', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
  });
}

// 6. Save Checkin to Cloud (triggers push notification to partner)
export async function saveCheckinToCloud(payload: {
  localId?: string;
  emotionId: string;
  energy: string;
  pleasantness: string;
  intensity: number;
  quadrant: string;
  contextPeople?: string[];
  contextPlace?: string[];
  contextActivity?: string[];
  note?: string;
  createdAt?: string;
  emotionNameRu?: string;
  quadrantNameRu?: string;
  shareWithPartners?: boolean;
}): Promise<void> {
  try {
    await apiFetch('/api/checkins', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[API] Could not sync checkin to cloud (offline?):', err);
  }
}

// 7. Get Partner's Live Mood Feed
export async function fetchPartnerFeed(): Promise<CloudCheckin[]> {
  try {
    const data = await apiFetch<{ feed: CloudCheckin[] }>('/api/partner/feed', {
      method: 'GET',
    });
    return data.feed || [];
  } catch (err) {
    console.warn('[API] Could not fetch partner feed:', err);
    return [];
  }
}

// 8. Care Ping («Спросить: Как ты?»)
export async function sendPartnerPingApi(partnerId?: string): Promise<{ success: boolean; message: string }> {
  return apiFetch('/api/partner/ping', {
    method: 'POST',
    body: JSON.stringify({ partnerId }),
  });
}

// 9. Care Reactions (Обнять, Я рядом, Горжусь, Хочешь поговорить?)
export async function sendPartnerReactionApi(
  partnerId: string,
  reactionType: string,
  reactionLabel: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch('/api/partner/reaction', {
    method: 'POST',
    body: JSON.stringify({ partnerId, reactionType, reactionLabel }),
  });
}
