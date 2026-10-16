import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import { CheckInRecord } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import {
  UserProfile,
  PartnerProfile,
  CloudCheckin,
  PartnerReaction,
  ChatMessage,
  ChatCheckinData,
  ConversationItem,
  getStoredUser,
  getStoredToken,
  removeStoredToken,
  loginWithGoogleApi,
  loginWithDemoApi,
  fetchMe,
  registerPushToken,
  connectPartnerApi,
  fetchPartnerFeed,
  fetchIncomingReactions,
  fetchMessagesApi,
  sendChatMessageApi,
  fetchConversationsApi,
  sendPartnerPingApi,
  sendPartnerReactionApi,
} from '../services/api';
import {
  getGoogleClientId,
  setGoogleClientId,
  startGoogleOAuthRedirect,
  parseGoogleOAuthCallback,
} from '../services/googleAuth';

WebBrowser.maybeCompleteAuthSession();

// Configure local notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PendingInvite {
  code: string;
  fromName?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  partners: PartnerProfile[];
  conversations: ConversationItem[];
  partnerFeed: CloudCheckin[];
  incomingReactions: PartnerReaction[];
  chatMessages: ChatMessage[];
  isLoading: boolean;
  isAuthenticated: boolean;
  pushToken: string | null;
  pendingInvite: PendingInvite | null;
  clearPendingInvite: () => void;
  signInWithGoogle: () => Promise<void>;
  signInDemo: (name: string, email: string) => Promise<void>;
  signOut: () => Promise<void>;
  connectPartner: (inviteCode: string) => Promise<{ success: boolean; partner?: PartnerProfile; error?: string }>;
  refreshFeed: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  fetchChatMessages: (partnerId?: string) => Promise<void>;
  sendChatMessage: (
    partnerId: string,
    content?: string,
    type?: 'text' | 'checkin' | 'reaction' | 'ping',
    checkinData?: ChatCheckinData
  ) => Promise<{ success: boolean; message?: ChatMessage }>;
  sendCarePing: (partnerId?: string) => Promise<{ success: boolean; message: string }>;
  sendCareReaction: (partnerId: string, reactionType: string, reactionLabel: string) => Promise<{ success: boolean; message: string }>;
  broadcastCheckinToChat: (record: CheckInRecord) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [partnerFeed, setPartnerFeed] = useState<CloudCheckin[]>([]);
  const [incomingReactions, setIncomingReactions] = useState<PartnerReaction[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [pendingInvite, setPendingInvite] = useState<PendingInvite | null>(null);

  // Initialize Auth state on mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const savedToken = await getStoredToken();
        const savedUser = await getStoredUser();

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(savedUser);

          // Fetch fresh profile and partners from server
          try {
            const fresh = await fetchMe();
            setUser(fresh.user);
            setPartners(fresh.partners || []);
          } catch (e) {
            console.log('[AUTH] Offline or server unreachable, using cached user');
          }
        }
      } catch (err) {
        console.error('[AUTH] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  // Check for Google OAuth callback in URL hash (#access_token=... or ?access_token=...)
  useEffect(() => {
    const callback = parseGoogleOAuthCallback();
    if (!callback) return;

    if (callback.error) {
      console.warn('[AUTH] Google OAuth error:', callback.error, callback.errorDescription);
      Alert.alert(
        'Ошибка Google входа',
        callback.errorDescription || callback.error || 'Авторизация отменена'
      );
      return;
    }

    if (callback.accessToken) {
      console.log('🔑 [AUTH] Received Google access token, logging in...');
      setIsLoading(true);
      loginWithGoogleApi({ accessToken: callback.accessToken })
        .then(async (res) => {
          setToken(res.token);
          setUser(res.user);
          const fresh = await fetchMe();
          setPartners(fresh.partners || []);
          Alert.alert('Успешный вход!', `Добро пожаловать, ${res.user.name}!`);
        })
        .catch((err: any) => {
          console.error('[AUTH] Failed to login with Google token:', err);
          Alert.alert('Ошибка входа', err.message || 'Не удалось завершить вход');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, []);

  // Register push notifications when user is authenticated
  useEffect(() => {
    async function setupPush() {
      if (!user || Platform.OS === 'web') return;

      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
          if (tokenData?.data) {
            setPushToken(tokenData.data);
            await registerPushToken(tokenData.data);
            console.log('✅ [PUSH] Registered Expo push token:', tokenData.data);
          }
        }
      } catch (err) {
        console.log('[PUSH] Simulator or notifications unavailable:', err);
      }
    }

    setupPush();
  }, [user]);

  // Load partner feed & chat when partners change
  useEffect(() => {
    if (partners.length > 0) {
      refreshFeed();
      fetchChatMessages();
    }
  }, [partners]);

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const convs = await fetchConversationsApi();
      setConversations(convs);
    } catch (e) {
      console.warn('[AUTH] Could not fetch conversations:', e);
    }
  };

  const fetchChatMessages = async (partnerId?: string) => {
    if (!token) return;
    try {
      const pid = partnerId || partners[0]?.id;
      const res = await fetchMessagesApi(pid);
      if (res && res.messages) {
        setChatMessages(res.messages);
      }
    } catch (e) {
      console.warn('[AUTH] Could not fetch chat messages:', e);
    }
  };

  const refreshFeed = async () => {
    if (!token) return;
    try {
      const [feed, reactions] = await Promise.all([
        fetchPartnerFeed().catch(() => []),
        fetchIncomingReactions().catch(() => []),
        fetchConversations().catch(() => []),
      ]);
      setPartnerFeed(feed);
      setIncomingReactions(reactions);
      if (partners.length > 0) {
        await fetchChatMessages();
      }
    } catch (e) {
      console.warn('[AUTH] Could not refresh partner feed:', e);
    }
  };

  // Auto-poll partner updates & chat messages every 4 seconds for responsive real-time feeling
  useEffect(() => {
    if (!token || !user) return;
    const timer = setInterval(() => {
      refreshFeed();
    }, 4000);
    return () => clearInterval(timer);
  }, [token, user, partners]);

  // Google Sign-In Flow
  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const configuredClientId = await getGoogleClientId();

      // Launch official Google OAuth 2.0 Redirect
      if (configuredClientId && Platform.OS === 'web') {
        startGoogleOAuthRedirect(configuredClientId);
        return;
      }

      // Quick test fallback
      Alert.alert(
        'Быстрый вход для проверки',
        'Выберите профиль для проверки синхронизации чекинов и близких:',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Войти как Вася',
            onPress: () => signInDemo('Вася', 'vasya@example.com'),
          },
          {
            text: 'Войти как Аня (Жена)',
            onPress: () => signInDemo('Аня (Жена)', 'anya@example.com'),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Ошибка входа', err.message || 'Не удалось войти');
    } finally {
      setIsLoading(false);
    }
  };

  // Demo Sign-In
  const signInDemo = async (name: string, email: string) => {
    setIsLoading(true);
    try {
      const res = await loginWithDemoApi(name, email);
      setToken(res.token);
      setUser(res.user);
      const fresh = await fetchMe();
      setPartners(fresh.partners || []);
      Alert.alert('Успешный вход!', `Добро пожаловать, ${res.user.name}!\nВаш код приглашения: ${res.user.inviteCode}`);
    } catch (err: any) {
      Alert.alert('Ошибка входа', err.message || 'Сервер недоступен');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for invite code in web URL (?invite=CODE&from=NAME)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get('invite');
      const from = params.get('from');
      if (invite) {
        setPendingInvite({
          code: invite.trim().toUpperCase(),
          fromName: from ? decodeURIComponent(from) : undefined,
        });
      }
    }
  }, []);

  const clearPendingInvite = () => {
    setPendingInvite(null);
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  // Connect Partner with 6-char code
  const connectPartner = async (inviteCode: string) => {
    if (!inviteCode.trim()) {
      return { success: false, error: 'Введите код партнера' };
    }
    try {
      const res = await connectPartnerApi(inviteCode.trim());
      if (res.success && res.partner) {
        setPartners((prev) => {
          const exists = prev.some((p) => p.id === res.partner.id);
          return exists ? prev : [...prev, res.partner];
        });
        clearPendingInvite();
        await refreshFeed();
        return { success: true, partner: res.partner };
      }
      return { success: false, error: 'Не удалось подключить' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Ошибка подключения' };
    }
  };

  const sendChatMessage = async (
    partnerId: string,
    content?: string,
    type: 'text' | 'checkin' | 'reaction' | 'ping' = 'text',
    checkinData?: ChatCheckinData
  ) => {
    try {
      const optimisticMsg: ChatMessage = {
        id: `opt_${Date.now()}`,
        conversation_id: [user?.id || '', partnerId].sort().join('_'),
        from_user_id: user?.id || '',
        to_user_id: partnerId,
        type,
        content: content || null,
        checkin_data: checkinData || null,
        created_at: new Date().toISOString(),
        from_name: user?.name,
        from_avatar: user?.avatarUrl || undefined,
      };
      setChatMessages((prev) => [...prev, optimisticMsg]);

      const res = await sendChatMessageApi({
        partnerId,
        content,
        type,
        checkinData,
      });

      if (res.success && res.message) {
        setChatMessages((prev) =>
          prev.map((m) => (m.id === optimisticMsg.id ? res.message : m))
        );
      }
      return res;
    } catch (err: any) {
      console.error('[AUTH] Failed to send chat message:', err);
      return { success: false, error: err.message || 'Ошибка отправки' };
    }
  };

  const sendCarePing = async (partnerId?: string) => {
    try {
      const res = await sendPartnerPingApi(partnerId);
      await fetchChatMessages(partnerId);
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка отправки' };
    }
  };

  const sendCareReaction = async (partnerId: string, reactionType: string, reactionLabel: string) => {
    try {
      const res = await sendPartnerReactionApi(partnerId, reactionType, reactionLabel);
      await fetchChatMessages(partnerId);
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка отправки' };
    }
  };

  const broadcastCheckinToChat = (record: CheckInRecord) => {
    const emotionsList =
      record.emotions && record.emotions.length > 0
        ? record.emotions
        : [
            {
              id: record.emotionId,
              name: record.emotionName || record.emotionId,
              quadrantId: record.quadrantId,
              intensity: record.intensity || 2,
            },
          ];

    const cleanNote =
      record.note &&
      record.note.trim() &&
      !record.note.trim().toLowerCase().startsWith('отметил')
        ? record.note.trim()
        : null;

    const primaryEmotion = emotionsList[0];
    const quad = QUADRANTS[primaryEmotion?.quadrantId || record.quadrantId];

    const checkinData: ChatCheckinData = {
      checkin_id: record.id,
      emotion_id: record.emotionId,
      emotionNameRu: primaryEmotion?.name || record.emotionName || record.emotionId,
      quadrant: primaryEmotion?.quadrantId || record.quadrantId,
      quadrantNameRu: quad?.translations?.ru || record.quadrantId,
      energy: quad?.energy || 'low',
      pleasantness: quad?.pleasantness || 'pleasant',
      intensity: record.intensity || 2,
      emotions: emotionsList,
      context_people: record.context?.people || [],
      context_place: record.context?.location || [],
      context_activity: record.context?.activity || [],
      note: cleanNote || undefined,
      created_at: record.timestamp,
    };

    const targetPartners =
      partners.length > 0
        ? partners
        : user
        ? [{ id: 'partner_local', name: 'Партнёр', email: '', avatarUrl: null }]
        : [];

    targetPartners.forEach((p) => {
      const optimisticMsg: ChatMessage = {
        id: `opt_chk_${Date.now()}_${p.id}`,
        conversation_id: [user?.id || 'me', p.id].sort().join('_'),
        from_user_id: user?.id || 'me',
        to_user_id: p.id,
        type: 'checkin',
        content: cleanNote,
        checkin_data: checkinData,
        created_at: record.timestamp,
        from_name: user?.name,
        from_avatar: user?.avatarUrl || undefined,
      };
      setChatMessages((prev) => [...prev, optimisticMsg]);
    });
  };

  const signOut = async () => {
    await removeStoredToken();
    setUser(null);
    setToken(null);
    setPartners([]);
    setConversations([]);
    setPartnerFeed([]);
    setChatMessages([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        partners,
        conversations,
        partnerFeed,
        incomingReactions,
        chatMessages,
        isLoading,
        isAuthenticated: !!user,
        pushToken,
        pendingInvite,
        clearPendingInvite,
        signInWithGoogle,
        signInDemo,
        signOut,
        connectPartner,
        refreshFeed,
        fetchConversations,
        fetchChatMessages,
        sendChatMessage,
        sendCarePing,
        sendCareReaction,
        broadcastCheckinToChat,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
