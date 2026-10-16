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
  isOnline?: boolean;
  lastSeenAt?: string | null;
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

export interface PartnerReaction {
  id: string;
  from_user_id: string;
  to_user_id: string;
  reaction_type: string;
  reaction_label: string;
  created_at: string;
  from_name?: string;
  from_avatar?: string;
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

// 2b. Telegram Auth
export async function loginWithTelegramApi(params: {
  telegramId?: string | number;
  username?: string;
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  name?: string;
}): Promise<{ token: string; user: UserProfile }> {
  const data = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(params),
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
  emotions?: Array<{ id: string; name: string; quadrantId: string; intensity: number }>;
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

// 6b. Fetch Authenticated User's Check-ins from Cloud
export async function fetchUserCheckinsApi(): Promise<any[]> {
  try {
    const data = await apiFetch<{ checkins: any[] }>('/api/checkins?limit=200', {
      method: 'GET',
    });
    return data.checkins || [];
  } catch (err) {
    console.warn('[API] Could not fetch user checkins:', err);
    return [];
  }
}

// 6c. Batch Sync Guest Check-ins to Cloud on Login/Signup
export async function syncCheckinsBatchApi(checkins: any[]): Promise<{ count: number }> {
  try {
    const res = await apiFetch<{ success: boolean; count: number }>('/api/checkins/sync-batch', {
      method: 'POST',
      body: JSON.stringify({ checkins }),
    });
    return { count: res.count || 0 };
  } catch (err) {
    console.warn('[API] Could not batch sync checkins:', err);
    return { count: 0 };
  }
}

// 6d. Soft Delete Check-in on Cloud
export async function softDeleteCheckInApi(id: string): Promise<boolean> {
  try {
    await apiFetch(`/api/checkins/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return true;
  } catch (err) {
    console.warn('[API] Could not soft delete checkin on cloud:', err);
    return false;
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

// 10. Fetch Incoming Reactions & Pings Received from Partner
export async function fetchIncomingReactions(): Promise<PartnerReaction[]> {
  return apiFetch<PartnerReaction[]>('/api/partner/reactions', {
    method: 'GET',
  });
}

// 11. Chat Messages Interfaces and APIs
export interface ChatCheckinData {
  checkin_id?: string;
  emotion_id: string;
  emotionNameRu?: string;
  quadrant: string;
  quadrantNameRu?: string;
  energy: string;
  pleasantness: string;
  intensity: number;
  emotions?: Array<{
    id: string;
    name: string;
    quadrantId: string;
    intensity: number;
  }>;
  context_people?: string[];
  context_place?: string[];
  context_activity?: string[];
  note?: string;
  created_at?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  from_user_id: string;
  to_user_id: string;
  type: 'text' | 'checkin' | 'reaction' | 'ping';
  content?: string | null;
  checkin_data?: ChatCheckinData | null;
  created_at: string;
  from_name?: string;
  from_avatar?: string;
  is_read?: boolean;
}

export async function fetchMessagesApi(partnerId?: string): Promise<{ messages: ChatMessage[]; conversationId: string | null }> {
  const queryParam = partnerId ? `?partnerId=${encodeURIComponent(partnerId)}` : '';
  return apiFetch<{ messages: ChatMessage[]; conversationId: string | null }>(`/api/messages${queryParam}`, {
    method: 'GET',
  });
}

export async function sendChatMessageApi(payload: {
  partnerId: string;
  content?: string;
  type?: 'text' | 'checkin' | 'reaction' | 'ping';
  checkinData?: ChatCheckinData;
}): Promise<{ success: boolean; message: ChatMessage }> {
  return apiFetch<{ success: boolean; message: ChatMessage }>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// 12. Conversations List API (WhatsApp/Telegram-like feed)
export interface ConversationItem {
  partner: PartnerProfile;
  conversationId: string;
  lastMessage?: ChatMessage | null;
  latestCheckin?: CloudCheckin | null;
}

export async function fetchConversationsApi(): Promise<ConversationItem[]> {
  const data = await apiFetch<{ conversations: ConversationItem[] }>('/api/conversations', {
    method: 'GET',
  });
  return data.conversations || [];
}


