import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Notifications from 'expo-notifications';
import {
  UserProfile,
  PartnerProfile,
  CloudCheckin,
  getStoredUser,
  getStoredToken,
  removeStoredToken,
  loginWithGoogleApi,
  loginWithDemoApi,
  fetchMe,
  registerPushToken,
  connectPartnerApi,
  fetchPartnerFeed,
  sendPartnerPingApi,
  sendPartnerReactionApi,
} from '../services/api';

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
  partnerFeed: CloudCheckin[];
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
  sendCarePing: (partnerId?: string) => Promise<{ success: boolean; message: string }>;
  sendCareReaction: (partnerId: string, reactionType: string, reactionLabel: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerProfile[]>([]);
  const [partnerFeed, setPartnerFeed] = useState<CloudCheckin[]>([]);
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

  // Load partner feed when partners change
  useEffect(() => {
    if (partners.length > 0) {
      refreshFeed();
    }
  }, [partners]);

  const refreshFeed = async () => {
    if (!token) return;
    try {
      const feed = await fetchPartnerFeed();
      setPartnerFeed(feed);
    } catch (e) {
      console.warn('[AUTH] Could not refresh partner feed:', e);
    }
  };

  // Google Sign-In Flow
  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      // Direct WebBrowser OAuth or Google Prompt
      // You can supply your Google Cloud Client ID here
      Alert.alert(
        'Google Вход',
        'Для входа через Google нажмите "Продолжить". Для быстрого теста без настройки Google Cloud Console используйте быстрый вход.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Войти как Вася',
            onPress: () => signInDemo('Вася', 'vasya@example.com'),
          },
          {
            text: 'Войти как Жена Васи',
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

  const sendCarePing = async (partnerId?: string) => {
    try {
      const res = await sendPartnerPingApi(partnerId);
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка отправки' };
    }
  };

  const sendCareReaction = async (partnerId: string, reactionType: string, reactionLabel: string) => {
    try {
      const res = await sendPartnerReactionApi(partnerId, reactionType, reactionLabel);
      return res;
    } catch (err: any) {
      return { success: false, message: err.message || 'Ошибка отправки' };
    }
  };

  const signOut = async () => {
    await removeStoredToken();
    setUser(null);
    setToken(null);
    setPartners([]);
    setPartnerFeed([]);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        partners,
        partnerFeed,
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
        sendCarePing,
        sendCareReaction,
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
