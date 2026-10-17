import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord, QuadrantId } from '../types';
import { QUADRANTS, EMOTIONS, getEmotionColor } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  API_BASE_URL,
  ChatMessage,
  ChatCheckinData,
  ConversationItem,
  PartnerProfile,
} from '../services/api';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';
import { getCheckIns } from '../storage/checkInStorage';
import { getEmotionsInsight } from '../utils/emotionInsight';
import { triggerHaptic } from '../utils/haptics';
import { QuadrantIcon } from '../components/QuadrantIcon';

interface FriendsScreenProps {
  latestCheckIn?: CheckInRecord;
  onOpenCheckIn?: () => void;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ latestCheckIn, onOpenCheckIn }) => {
  const { language, t } = useLanguage();
  const {
    user,
    isAuthenticated,
    partners,
    conversations,
    partnerFeed,
    chatMessages,
    pendingInvite,
    clearPendingInvite,
    signInWithApple,
    signInWithTelegram,
    signInWithGoogle,
    signOut,
    connectPartner,
    refreshFeed,
    fetchConversations,
    fetchChatMessages,
    sendChatMessage,
    sendCarePing,
    sendCareReaction,
  } = useAuth();

  // Selected partner: if null -> show Chat List (Telegram/WhatsApp style); if set -> show Chat Room
  const [selectedPartner, setSelectedPartner] = useState<PartnerProfile | null>(null);

  // Chat message input state
  const [inputText, setInputText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Partner connect code input toggle & state
  const [showCodeInput, setShowCodeInput] = useState<boolean>(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [lastSentBanner, setLastSentBanner] = useState<string | null>(null);
  const [isCopiedToast, setIsCopiedToast] = useState<boolean>(false);


  // Add Partner / Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Telegram Login Modal
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState<boolean>(false);
  const [telegramInput, setTelegramInput] = useState<string>('');
  const [telegramSubmitting, setTelegramSubmitting] = useState<boolean>(false);

  // Apple Login Modal
  const [isAppleModalOpen, setIsAppleModalOpen] = useState<boolean>(false);
  const [appleEmailInput, setAppleEmailInput] = useState<string>('');
  const [appleSubmitting, setAppleSubmitting] = useState<boolean>(false);

  const handleAppleLoginPress = async () => {
    triggerHaptic('medium');
    try {
      await signInWithApple();
    } catch (e: any) {
      if (e.message === 'APPLE_MODAL_REQUIRED') {
        setIsAppleModalOpen(true);
      }
    }
  };

  const handleAppleSubmit = async () => {
    const raw = appleEmailInput.trim();
    if (!raw || !raw.includes('@')) {
      Alert.alert('Введите email', 'Укажите ваш Apple ID или email');
      return;
    }
    triggerHaptic('medium');
    setAppleSubmitting(true);
    try {
      await signInWithApple({
        email: raw.toLowerCase(),
        fullName: raw.split('@')[0],
      });
      setIsAppleModalOpen(false);
      setAppleEmailInput('');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось войти');
    } finally {
      setAppleSubmitting(false);
    }
  };

  const handleTelegramLoginPress = () => {
    triggerHaptic('medium');
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
      const tgUser = (window as any).Telegram.WebApp.initDataUnsafe.user;
      signInWithTelegram({
        telegramId: tgUser.id,
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
        photoUrl: tgUser.photo_url,
      });
      return;
    }
    setTelegramInput('');
    setIsTelegramModalOpen(true);
  };

  const handleTelegramSubmit = async () => {
    const raw = telegramInput.trim();
    if (!raw) {
      Alert.alert('Введите никнейм', 'Пожалуйста, укажите ваш Telegram @username или имя');
      return;
    }
    triggerHaptic('medium');
    setTelegramSubmitting(true);
    try {
      await signInWithTelegram({
        username: raw.startsWith('@') ? raw : `@${raw}`,
        name: raw.replace(/^@/, ''),
      });
      setIsTelegramModalOpen(false);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось войти');
    } finally {
      setTelegramSubmitting(false);
    }
  };

  // Share checkin modal state & 3 recent checkins
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckInRecord[]>([]);

  // Expanded card state for emotion descriptions & synthesis
  const [expandedCheckinIds, setExpandedCheckinIds] = useState<Record<string, boolean>>({});

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatMessages.length]);

  // If active partner is selected, periodically refresh their messages (live chat polling)
  useEffect(() => {
    if (selectedPartner) {
      fetchChatMessages(selectedPartner.id);

      const interval = setInterval(() => {
        fetchChatMessages(selectedPartner.id);
      }, 3500);

      return () => clearInterval(interval);
    }
  }, [selectedPartner]);

  // Open chat room for a specific partner
  const handleOpenChat = (partner: PartnerProfile) => {
    triggerHaptic('light');
    setSelectedPartner(partner);
    fetchChatMessages(partner.id);
  };

  // Close chat room and return to chats list
  const handleBackToList = () => {
    triggerHaptic('light');
    setSelectedPartner(null);
    fetchConversations();
  };

  // Generate Smart Invite Link for Messengers
  const getInviteUrl = () => {
    if (!user) return API_BASE_URL;
    const from = encodeURIComponent(user.name || 'Близкий человек');
    return `${API_BASE_URL}/?invite=${user.inviteCode}&from=${from}`;
  };

  const handleShareInviteLink = async () => {
    if (!user) return;
    triggerHaptic('medium');
    const url = getInviteUrl();
    const text = `Привет! Я отмечаю своё состояние в приложении «Как Я?». Давай будем на связи, чтобы бережно делиться тем, как мы себя чувствуем:\n${url}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Как Я?',
          text,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 3000);
    } else {
      Alert.alert(
        'Приглашение скопировано!',
        `Отправьте его вашему близкому человеку в соцсети или мессенджер:\n\n${text}`,
        [{ text: 'Понятно', style: 'default' }]
      );
    }
  };

  const handleCopyCodeOnly = async () => {
    if (!user) return;
    triggerHaptic('light');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(user.inviteCode);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 2500);
    } else {
      Alert.alert('Код скопирован', user.inviteCode);
    }
  };

  // Connect via pending invite link
  const handleAcceptPendingInvite = async () => {
    if (!pendingInvite) return;
    setIsConnecting(true);
    triggerHaptic('medium');
    const result = await connectPartner(pendingInvite.code);
    setIsConnecting(false);

    if (result.success && result.partner) {
      triggerHaptic('success');
      setSelectedPartner(result.partner);
      Alert.alert(
        'Вы связаны! ❤️',
        `Вы теперь на связи с ${pendingInvite.fromName || result.partner?.name || 'партнёром'}. Настроение и чат обновляются в реальном времени!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось подключить', result.error || 'Проверьте ссылку');
    }
  };

  const handleConnectPartnerByCode = async () => {
    if (!partnerCodeInput.trim()) {
      Alert.alert('Введите код', 'Укажите 6-значный код партнёра');
      return;
    }
    setIsConnecting(true);
    triggerHaptic('medium');
    const result = await connectPartner(partnerCodeInput.trim());
    setIsConnecting(false);

    if (result.success && result.partner) {
      triggerHaptic('success');
      setPartnerCodeInput('');
      setShowCodeInput(false);
      setIsInviteModalOpen(false);
      setSelectedPartner(result.partner);
      Alert.alert(
        'Вы связаны! ❤️',
        `Вы успешно подключились к ${result.partner?.name}. Теперь вы можете общаться и видеть чекины друг друга!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось связать', result.error || 'Проверьте правильность кода');
    }
  };

  // Send Text Message
  const handleSendTextMessage = async () => {
    if (!inputText.trim() || !selectedPartner || isSending) return;
    const textToSend = inputText.trim();
    setInputText('');
    setIsSending(true);
    triggerHaptic('light');

    await sendChatMessage(selectedPartner.id, textToSend, 'text');
    setIsSending(false);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Open Real Check-in Flow (opens CheckInModal)
  const handleOpenRealCheckIn = () => {
    triggerHaptic('medium');
    if (onOpenCheckIn) {
      onOpenCheckIn();
    } else {
      Alert.alert('Чекин', 'Откройте чекин на главном экране.');
    }
  };

  // Send Check-in Card into Chat (if ever triggered directly)
  const handleShareCheckInCard = async () => {
    if (!selectedPartner) return;
    triggerHaptic('medium');

    if (!latestCheckIn) {
      if (onOpenCheckIn) {
        onOpenCheckIn();
      } else {
        Alert.alert('Нет свежего настроения', 'Сначала отметьте своё состояние на главном экране.');
      }
      return;
    }

    const emotionsList = (latestCheckIn.emotions && latestCheckIn.emotions.length > 0)
      ? latestCheckIn.emotions.map((e) => ({
          id: e.id,
          name: e.name,
          quadrantId: e.quadrantId,
          intensity: e.intensity || 2,
        }))
      : [
          {
            id: latestCheckIn.emotionId,
            name: latestCheckIn.emotionName || latestCheckIn.emotionId,
            quadrantId: latestCheckIn.quadrantId,
            intensity: latestCheckIn.intensity || 2,
          },
        ];

    const primaryEmotion = emotionsList[0];
    const quadId: QuadrantId = primaryEmotion?.quadrantId || latestCheckIn.quadrantId || 'low_pleasant';
    const quad = QUADRANTS[quadId];
    const quadName = quad?.translations?.ru || quadId;
    const emotionRu = primaryEmotion?.name || latestCheckIn.emotionName || latestCheckIn.emotionId;

    const cleanNote =
      latestCheckIn.note &&
      latestCheckIn.note.trim() &&
      !latestCheckIn.note.trim().toLowerCase().startsWith('отметил')
        ? latestCheckIn.note.trim()
        : '';

    const checkinData: ChatCheckinData = {
      checkin_id: latestCheckIn.id,
      emotion_id: latestCheckIn.emotionId,
      emotionNameRu: emotionRu,
      quadrant: quadId,
      quadrantNameRu: quadName,
      energy: quad?.energy || 'low',
      pleasantness: quad?.pleasantness || 'pleasant',
      intensity: latestCheckIn.intensity || 2,
      emotions: emotionsList,
      context_people: latestCheckIn.context?.people || [],
      context_place: latestCheckIn.context?.location || [],
      context_activity: latestCheckIn.context?.activity || [],
      note: cleanNote,
      created_at: latestCheckIn.timestamp,
    };

    const titleStr = emotionsList.map((e) => e.name).join(', ') || emotionRu;
    setLastSentBanner(`💛 Вы отправили настроение «${titleStr}»`);
    setTimeout(() => setLastSentBanner(null), 3000);

    await sendChatMessage(
      selectedPartner.id,
      cleanNote,
      'checkin',
      checkinData
    );

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Open Share Mood Bottom Sheet Modal (loads up to 3 recent check-ins)
  const handleOpenShareModal = async () => {
    triggerHaptic('medium');
    try {
      const list = await getCheckIns();
      setRecentCheckIns(list.slice(0, 3));
    } catch (e) {
      setRecentCheckIns([]);
    }
    setIsShareModalOpen(true);
  };

  // Share specific recent check-in into the chat
  const handleShareSpecificCheckIn = async (checkin: CheckInRecord) => {
    if (!selectedPartner) return;
    triggerHaptic('success');

    const emotionsList =
      checkin.emotions && checkin.emotions.length > 0
        ? checkin.emotions.map((e) => ({
            id: e.id,
            name: e.name,
            quadrantId: e.quadrantId,
            intensity: e.intensity || 2,
          }))
        : [
            {
              id: checkin.emotionId,
              name: checkin.emotionName || checkin.emotionId,
              quadrantId: checkin.quadrantId,
              intensity: checkin.intensity || 2,
            },
          ];

    const primaryEmotion = emotionsList[0];
    const quadId: QuadrantId =
      primaryEmotion?.quadrantId || checkin.quadrantId || 'low_pleasant';
    const quad = QUADRANTS[quadId];
    const quadName = quad?.translations?.ru || quadId;
    const emotionRu =
      primaryEmotion?.name || checkin.emotionName || checkin.emotionId;

    const cleanNote =
      checkin.note &&
      checkin.note.trim() &&
      !checkin.note.trim().toLowerCase().startsWith('отметил')
        ? checkin.note.trim()
        : '';

    const checkinData: ChatCheckinData = {
      checkin_id: checkin.id,
      emotion_id: checkin.emotionId,
      emotionNameRu: emotionRu,
      quadrant: quadId,
      quadrantNameRu: quadName,
      energy: quad?.energy || 'low',
      pleasantness: quad?.pleasantness || 'pleasant',
      intensity: checkin.intensity || 2,
      emotions: emotionsList,
      context_people: checkin.context?.people || [],
      context_place: checkin.context?.location || [],
      context_activity: checkin.context?.activity || [],
      note: cleanNote,
      created_at: checkin.timestamp,
    };

    setIsShareModalOpen(false);

    const titleStr = emotionsList.map((e) => e.name).join(', ') || emotionRu;
    setLastSentBanner(`💛 Вы отправили настроение «${titleStr}»`);
    setTimeout(() => setLastSentBanner(null), 3000);

    await sendChatMessage(
      selectedPartner.id,
      cleanNote,
      'checkin',
      checkinData
    );

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Helper to check if partner is currently online
  const isPartnerOnline = (p?: PartnerProfile | null) => {
    if (!p) return false;
    if (p.isOnline === true) return true;
    const inList = partners.find((item) => item.id === p.id);
    if (inList?.isOnline === true) return true;
    const inConv = conversations.find((c) => c.partner?.id === p.id);
    if ((inConv?.partner as any)?.is_online === true || inConv?.partner?.isOnline === true) return true;
    return false;
  };

  // Telegram-style message delivery/read status indicator
  const renderMessageStatus = (msg: ChatMessage) => {
    if (msg.id.startsWith('opt_')) {
      return (
        <Ionicons
          name="time-outline"
          size={12}
          color="#718096"
          style={{ marginLeft: 4 }}
        />
      );
    }
    if (msg.is_read) {
      return (
        <Ionicons
          name="checkmark-done"
          size={14}
          color="#4FD1C5"
          style={{ marginLeft: 4 }}
        />
      );
    }
    return (
      <Ionicons
        name="checkmark"
        size={13}
        color="#94A3B8"
        style={{ marginLeft: 4 }}
      />
    );
  };

  // Care Ping: «Спросить: Как ты?»
  const handleSendPing = async () => {
    if (!selectedPartner) return;
    triggerHaptic('medium');
    setLastSentBanner('💭 Вы спросили: «Как ты?»');
    setTimeout(() => setLastSentBanner(null), 3000);

    await sendCarePing(selectedPartner.id);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Care Reaction (Обнять, Я рядом, Горжусь, Хочешь поговорить?)
  const handleSendCareReaction = async (reactionType: string, reactionLabel: string) => {
    if (!selectedPartner) return;
    triggerHaptic('success');
    setLastSentBanner(reactionLabel);
    setTimeout(() => setLastSentBanner(null), 3000);

    await sendCareReaction(selectedPartner.id, reactionType, reactionLabel);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Helpers
  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'только что';
    if (diff < 60) return `${diff} мин назад`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} ч назад`;
    return new Date(dateStr).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const hours = d.getHours().toString().padStart(2, '0');
      const mins = d.getMinutes().toString().padStart(2, '0');
      return `${hours}:${mins}`;
    } catch (e) {
      return '';
    }
  };

  const getQuadrantColor = (quadrant?: string) => {
    if (!quadrant) return '#4FD1C5';
    if (quadrant === 'high_pleasant' || quadrant.includes('yellow')) return '#ECC94B';
    if (quadrant === 'low_pleasant' || quadrant.includes('green')) return '#48BB78';
    if (quadrant === 'low_unpleasant' || quadrant.includes('blue')) return '#4299E1';
    if (quadrant === 'high_unpleasant' || quadrant.includes('red')) return '#F56565';
    const quad = QUADRANTS[quadrant as QuadrantId];
    return quad?.color_hex || '#4FD1C5';
  };

  const getQuadrantEmoji = (quadrant?: string) => {
    if (!quadrant) return '💛';
    if (quadrant === 'high_pleasant' || quadrant.includes('yellow')) return '💛';
    if (quadrant === 'low_pleasant' || quadrant.includes('green')) return '💚';
    if (quadrant === 'low_unpleasant' || quadrant.includes('blue')) return '💙';
    if (quadrant === 'high_unpleasant' || quadrant.includes('red')) return '❤️';
    return '💛';
  };

  // Build the list of conversation items (using conversations from API or partners as fallback)
  const conversationList: ConversationItem[] =
    conversations && conversations.length > 0
      ? conversations
      : partners.map((p) => {
          const feedItem = partnerFeed.find((f) => f.user_id === p.id);
          return {
            partner: p,
            conversationId: [user?.id || '', p.id].sort().join('_'),
            lastMessage: null,
            latestCheckin: feedItem || null,
          };
        });

  const totalUnreadSum = conversationList.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  // Partner's latest check-in for the active chat room
  const activePartnerCheckin = selectedPartner
    ? conversationList.find((c) => c.partner.id === selectedPartner.id)?.latestCheckin ||
      partnerFeed.find((f) => f.user_id === selectedPartner.id) ||
      null
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* 1. STATE A: NOT AUTHENTICATED */}
      {!isAuthenticated && (
        <ScrollView contentContainerStyle={styles.authScrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Близкие</Text>
              <Text style={styles.headerSubtitle}>Эмоциональный пульс пары</Text>
            </View>
          </View>

          <View style={styles.welcomeCard}>
            <View style={styles.welcomeGlowBackdrop} />
            <View style={styles.welcomeIconRow}>
              <View style={styles.welcomeIconCircle}>
                <Ionicons name="chatbubbles" size={32} color="#4FD1C5" />
              </View>
              <View style={[styles.welcomeIconCircle, { marginLeft: -16 }]}>
                <Ionicons name="heart" size={28} color="#ED64A6" />
              </View>
            </View>

            <Text style={styles.welcomeTitle}>Чаты с близкими{'\n'}и карточки настроения</Text>
            <Text style={styles.welcomeDesc}>
              Узнавайте, как дела у любимого человека без лишних слов. Делитесь чекинами настроения,
              отправляйте знаки заботы и общайтесь в защищенных личных чатах.
            </Text>

            <View style={styles.featurePillList}>
              <View style={styles.featurePill}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#4FD1C5" />
                <Text style={styles.featurePillText}>Чаты как в мессенджерах</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="pulse-outline" size={16} color="#FBBF24" />
                <Text style={styles.featurePillText}>Карточки с чекинами</Text>
              </View>
              <View style={styles.featurePill}>
                <Ionicons name="cafe-outline" size={16} color="#ED64A6" />
                <Text style={styles.featurePillText}>Забота в 1 клик</Text>
              </View>
            </View>

            {/* 1. Apple Sign-In */}
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleLoginPress}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
              <Text style={styles.appleButtonText}>Войти с Apple</Text>
            </TouchableOpacity>

            {/* 2. Telegram Sign-In */}
            <TouchableOpacity
              style={styles.telegramButton}
              onPress={handleTelegramLoginPress}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              <Text style={styles.telegramButtonText}>Войти через Telegram</Text>
            </TouchableOpacity>

            {/* 3. Google Sign-In */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={signInWithGoogle}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={18} color="#0A0D12" />
              <Text style={styles.googleButtonText}>Войти через Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* 2. STATE B: AUTHENTICATED, BUT ZERO PARTNERS CONNECTED */}
      {isAuthenticated && partners.length === 0 && (
        <ScrollView contentContainerStyle={styles.authScrollContent}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Близкие</Text>
              <Text style={styles.headerSubtitle}>Пригласите партнёра для начала общения</Text>
            </View>
          </View>

          {/* Active User Account Strip */}
          <View style={styles.friendsAccountBar}>
            <View style={styles.friendsAccountLeft}>
              <View style={styles.friendsAvatarSmall}>
                <Text style={styles.friendsAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendsAccountName} numberOfLines={1}>{user?.name}</Text>
                <Text style={styles.friendsAccountSub} numberOfLines={1}>
                  {user?.telegramUsername ? `@${user.telegramUsername}` : (user?.email && !user.email.endsWith('@telegram.user') ? user.email : (user?.name ? `@${user.name}` : ''))}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.friendsSwitchAccountBtn}
              onPress={() => signOut()}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={14} color="#FC8181" />
              <Text style={styles.friendsSwitchAccountText}>Сменить</Text>
            </TouchableOpacity>
          </View>

          {/* Incoming Invite Banner if user opened through invite link */}
          {pendingInvite && (
            <View style={styles.incomingInviteCard}>
              <View style={styles.incomingInviteRow}>
                <View style={styles.incomingHeartCircle}>
                  <Ionicons name="heart" size={24} color="#ED64A6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.incomingInviteTitle}>
                    {pendingInvite.fromName
                      ? `${pendingInvite.fromName} приглашает вас!`
                      : 'Приглашение в близкий круг'}
                  </Text>
                  <Text style={styles.incomingInviteSub}>
                    Подключитесь, чтобы открыть чат и видеть чекины настроения друг друга.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryActionButton}
                onPress={handleAcceptPendingInvite}
                disabled={isConnecting}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#0A0D12" />
                <Text style={styles.primaryActionButtonText}>
                  {isConnecting ? 'Связываем...' : 'Принять приглашение и связаться'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.invitePartnerCard}>
            <View style={styles.inviteGraphicBox}>
              <View style={styles.avatarRingsOuter}>
                <View style={styles.avatarRingLeft}>
                  <Text style={styles.avatarRingLetter}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                  </Text>
                </View>
                <View style={styles.avatarRingRight}>
                  <Ionicons name="heart" size={22} color="#ED64A6" />
                </View>
              </View>
            </View>

            <Text style={styles.inviteCardTitle}>Создайте ваш первый чат</Text>
            <Text style={styles.inviteCardSubtitle}>
              Отправьте персональную ссылку в Telegram или WhatsApp. Ваш партнёр нажмёт на неё и мгновенно откроет ваш общий чат настроения.
            </Text>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleShareInviteLink}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={20} color="#0A0D12" />
              <Text style={styles.primaryActionButtonText}>Отправить ссылку партнёру</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyCodePill}
              onPress={handleCopyCodeOnly}
              activeOpacity={0.7}
            >
              <Text style={styles.copyCodePillText}>
                Ваш инвайт-код: <Text style={styles.copyCodeBold}>{user?.inviteCode}</Text>
              </Text>
              <Ionicons name="copy-outline" size={14} color="#A0AEC0" />
            </TouchableOpacity>

            <View style={styles.manualCodeContainer}>
              {!showCodeInput ? (
                <TouchableOpacity
                  onPress={() => setShowCodeInput(true)}
                  style={styles.toggleCodeInputBtn}
                >
                  <Text style={styles.toggleCodeInputText}>
                    Партнёр уже прислал код? Ввести вручную
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.codeEntryBox}>
                  <TextInput
                    style={styles.codeEntryInput}
                    placeholder="Вставьте 6-значный код..."
                    placeholderTextColor="#718096"
                    value={partnerCodeInput}
                    onChangeText={setPartnerCodeInput}
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                  <TouchableOpacity
                    style={styles.codeEntryBtn}
                    onPress={handleConnectPartnerByCode}
                    disabled={isConnecting}
                  >
                    <Text style={styles.codeEntryBtnText}>
                      {isConnecting ? '...' : 'Связать'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      {/* 3. STATE C1: CHATS LIST VIEW (TELEGRAM / WHATSAPP STYLE) */}
      {isAuthenticated && partners.length > 0 && selectedPartner === null && (
        <ScrollView style={styles.chatsListWrapper} contentContainerStyle={styles.chatsListContent}>
          {/* Top Bar of Chats List */}
          <View style={styles.chatsListHeader}>
            <View>
              <Text style={styles.chatsListHeaderTitle}>Близкие</Text>
              <Text style={styles.chatsListHeaderSub}>Чаты и настроение</Text>
            </View>

            <View style={styles.chatsListHeaderActions}>
              <TouchableOpacity
                style={styles.inviteChatHeaderBtn}
                onPress={handleShareInviteLink}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={16} color="#0A0D12" />
                <Text style={styles.inviteChatHeaderBtnText}>Пригласить</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Active User Account Strip */}
          <View style={styles.friendsAccountBar}>
            <View style={styles.friendsAccountLeft}>
              <View style={styles.friendsAvatarSmall}>
                <Text style={styles.friendsAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.friendsAccountName} numberOfLines={1}>{user?.name}</Text>
                <Text style={styles.friendsAccountSub} numberOfLines={1}>
                  {user?.email || (user?.name ? `@${user.name}` : '')}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.friendsSwitchAccountBtn}
              onPress={() => signOut()}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={14} color="#FC8181" />
              <Text style={styles.friendsSwitchAccountText}>Сменить</Text>
            </TouchableOpacity>
          </View>

          {/* Section Heading */}
          <View style={styles.chatsSectionHeaderRow}>
            <Text style={styles.chatsSectionHeading}>ВАШИ ЧАТЫ</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {totalUnreadSum > 0 && (
                <View style={styles.chatsUnreadPill}>
                  <Text style={styles.chatsUnreadPillText}>+{totalUnreadSum} новых</Text>
                </View>
              )}
              <Text style={styles.chatsCountBadge}>{conversationList.length}</Text>
            </View>
          </View>

          {/* Chats / Partners List Items (Telegram/WhatsApp style) */}
          <View style={styles.chatsItemsContainer}>
            {conversationList.map((conv) => {
              const partner = conv.partner;
              const checkin = conv.latestCheckin;
              const quadColor = getQuadrantColor(checkin?.quadrant);
              const quadEmoji = getQuadrantEmoji(checkin?.quadrant);
              const hasUnread = Boolean(conv.unreadCount && conv.unreadCount > 0);

              // Snippet for last message
              let lastMsgSnippet = 'Нажмите, чтобы открыть чат';
              let lastMsgTime = '';

              if (conv.lastMessage) {
                const msg = conv.lastMessage;
                const isMe = msg.from_user_id === user?.id;
                const prefix = isMe ? 'Вы: ' : '';
                lastMsgTime = formatMessageTime(msg.created_at);

                if (msg.type === 'checkin') {
                  const emotions = msg.checkin_data?.emotions;
                  const emotionTitle =
                    emotions && emotions.length > 0
                      ? emotions.map((e) => e.name).join(', ')
                      : msg.checkin_data?.emotionNameRu ||
                        msg.checkin_data?.emotion_id ||
                        'настроением';
                  lastMsgSnippet = `${prefix}⚡ Чекин: ${emotionTitle}`;
                } else if (msg.type === 'reaction') {
                  lastMsgSnippet = `${prefix}${msg.content || 'Знак заботы'}`;
                } else if (msg.type === 'ping') {
                  lastMsgSnippet = `${prefix}💭 «Как ты?»`;
                } else {
                  lastMsgSnippet = `${prefix}${msg.content || ''}`;
                }
              } else if (checkin) {
                lastMsgTime = formatTimeAgo(checkin.created_at);
                const emName = getLocalizedEmotionName(
                  checkin.emotion_id,
                  checkin.emotion_id,
                  language
                );
                const hasValidNote =
                  checkin.note &&
                  checkin.note.trim() &&
                  !checkin.note.trim().toLowerCase().startsWith('отметил');
                lastMsgSnippet = `⚡ ${emName}${hasValidNote ? ` — «${checkin.note}»` : ''}`;
              }

              return (
                <TouchableOpacity
                  key={partner.id}
                  style={[
                    styles.chatRowItem,
                    hasUnread ? styles.chatRowItemUnread : null,
                  ]}
                  onPress={() => handleOpenChat(partner)}
                  activeOpacity={0.7}
                >
                  {/* Left Avatar with Mood Ring & Online Pulse */}
                  <View style={styles.chatRowAvatarBox}>
                    <View
                      style={[
                        styles.chatRowAvatar,
                        { borderColor: checkin ? quadColor : 'rgba(255, 255, 255, 0.15)' },
                      ]}
                    >
                      <Text style={styles.chatRowAvatarLetter}>
                        {partner.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    {isPartnerOnline(partner) && <View style={styles.chatRowOnlineDot} />}
                    {hasUnread && <View style={styles.chatRowAvatarUnreadDot} />}
                  </View>

                  {/* Middle: Partner Name, Mood Capsule, Last Message */}
                  <View style={styles.chatRowContent}>
                    <View style={styles.chatRowTopRow}>
                      <Text
                        style={[
                          styles.chatRowPartnerName,
                          hasUnread ? styles.chatRowPartnerNameUnread : null,
                        ]}
                        numberOfLines={1}
                      >
                        {partner.name}
                      </Text>
                    </View>

                    {/* Mood capsule pill */}
                    <View style={styles.chatRowMoodPillRow}>
                      {checkin ? (
                        <View
                          style={[
                            styles.chatRowMoodPill,
                            { backgroundColor: `${quadColor}22`, borderColor: `${quadColor}55` },
                          ]}
                        >
                          <Text style={styles.chatRowMoodPillText}>
                            {quadEmoji}{' '}
                            {getLocalizedEmotionName(
                              checkin.emotion_id,
                              checkin.emotion_id,
                              language
                            )}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.chatRowMoodPillEmpty}>
                          <Text style={styles.chatRowMoodPillEmptyText}>
                            💬 На связи
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Last Message Snippet */}
                    <Text
                      style={[
                        styles.chatRowLastMsg,
                        hasUnread ? styles.chatRowLastMsgUnread : null,
                      ]}
                      numberOfLines={1}
                    >
                      {lastMsgSnippet}
                    </Text>
                  </View>

                  {/* Right Column: Time & Unread Badge & Chevron */}
                  <View style={styles.chatRowRightColumn}>
                    {lastMsgTime ? (
                      <Text
                        style={[
                          styles.chatRowTime,
                          hasUnread ? styles.chatRowTimeUnread : null,
                        ]}
                      >
                        {lastMsgTime}
                      </Text>
                    ) : null}
                    <View style={styles.chatRowActionRow}>
                      {hasUnread && (
                        <View style={styles.chatRowUnreadBadge}>
                          <Text style={styles.chatRowUnreadBadgeText}>
                            {conv.unreadCount! > 99 ? '99+' : conv.unreadCount}
                          </Text>
                        </View>
                      )}
                      <Ionicons name="chevron-forward" size={16} color={hasUnread ? '#4FD1C5' : '#718096'} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* 4. STATE C2: DEDICATED CHAT ROOM WITH SELECTED PARTNER */}
      {isAuthenticated && selectedPartner && (
        <View style={styles.chatWrapper}>
          {/* A. CHAT HEADER WITH BACK BUTTON */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderLeft}>
              {/* Back to Chats List Button */}
              <TouchableOpacity
                style={styles.chatBackButton}
                onPress={handleBackToList}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={24} color="#4FD1C5" />
                <Text style={styles.chatBackButtonText}>Чаты</Text>
              </TouchableOpacity>

              {/* Partner Avatar with Mood Ring */}
              <View
                style={[
                  styles.partnerAvatar,
                  {
                    borderColor: getQuadrantColor(activePartnerCheckin?.quadrant),
                  },
                ]}
              >
                <Text style={styles.partnerAvatarText}>
                  {selectedPartner.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.partnerHeaderMeta}>
                <View style={styles.partnerHeaderNameRow}>
                  <Text style={styles.partnerHeaderName} numberOfLines={1}>
                    {selectedPartner.name}
                  </Text>
                  {isPartnerOnline(selectedPartner) && <View style={styles.livePulseDot} />}
                </View>

                {/* Partner Latest Mood Capsule */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    if (activePartnerCheckin?.note) {
                      Alert.alert(
                        `${selectedPartner.name}`,
                        `Чувствует: ${getLocalizedEmotionName(
                          activePartnerCheckin.emotion_id,
                          activePartnerCheckin.emotion_id,
                          language
                        )}\n\n«${activePartnerCheckin.note}»\n\n${formatTimeAgo(
                          activePartnerCheckin.created_at
                        )}`
                      );
                    }
                  }}
                  style={styles.partnerMoodCapsule}
                >
                  {activePartnerCheckin ? (
                    <Text style={styles.partnerMoodCapsuleText} numberOfLines={1}>
                      {getQuadrantEmoji(activePartnerCheckin.quadrant)}{' '}
                      <Text style={{ fontWeight: '700', color: '#E2E8F0' }}>
                        {getLocalizedEmotionName(
                          activePartnerCheckin.emotion_id,
                          activePartnerCheckin.emotion_id,
                          language
                        )}
                      </Text>{' '}
                      • {formatTimeAgo(activePartnerCheckin.created_at)}
                    </Text>
                  ) : (
                    <Text style={styles.partnerMoodCapsuleText}>
                      💬 На связи • пока без чекина
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Right Action Buttons */}
            <View style={styles.chatHeaderActions}>
              <TouchableOpacity
                style={styles.chatHeaderIconBtn}
                onPress={() => {
                  triggerHaptic('light');
                  refreshFeed();
                  fetchChatMessages(selectedPartner.id);
                }}
              >
                <Ionicons name="refresh" size={18} color="#A0AEC0" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chatHeaderIconBtn}
                onPress={() => {
                  triggerHaptic('light');
                  Alert.alert(
                    selectedPartner.name,
                    `${selectedPartner.email ? `Почта: ${selectedPartner.email}\n` : ''}Статус: ${isPartnerOnline(selectedPartner) ? '🟢 В сети' : 'Был(а) недавно'}`
                  );
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color="#A0AEC0" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Feedback Banner for sent reaction/ping */}
          {lastSentBanner && (
            <View style={styles.floatingBanner}>
              <Ionicons name="sparkles" size={14} color="#4FD1C5" />
              <Text style={styles.floatingBannerText}>{lastSentBanner}</Text>
            </View>
          )}

          {/* B. CHAT MESSAGES STREAM */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {/* Friendly Greeting / Intimate Intro */}
            <View style={styles.chatWelcomeNotice}>
              <Ionicons name="heart" size={20} color="#ED64A6" />
              <Text style={styles.chatWelcomeNoticeText}>
                Личный чат с {selectedPartner.name}.{'\n'}
                Делитесь чувствами, чекинами и согревайте заботой.
              </Text>
            </View>

            {/* Empty state if no messages */}
            {chatMessages.length === 0 && (
              <View style={styles.emptyChatBox}>
                <Text style={styles.emptyChatEmoji}>💌</Text>
                <Text style={styles.emptyChatTitle}>Чат пока пуст</Text>
                <Text style={styles.emptyChatSubtitle}>
                  Отправьте первое сообщение, поделитесь карточкой настроения или пошлите знак заботы!
                </Text>
              </View>
            )}

            {/* Render Each Chat Message */}
            {chatMessages.map((msg, index) => {
              const isMe = msg.from_user_id === user?.id;

              // 1. CHECK-IN CARD MESSAGE
              if (msg.type === 'checkin' && msg.checkin_data) {
                const data = msg.checkin_data;
                const quadColor = getQuadrantColor(data.quadrant);
                const quadEmoji = getQuadrantEmoji(data.quadrant);
                const emotionTitle = data.emotionNameRu || data.emotion_id;

                const emotionsList =
                  data.emotions && data.emotions.length > 0
                    ? data.emotions
                    : [
                        {
                          id: data.emotion_id,
                          name: data.emotionNameRu || data.emotion_id,
                          quadrantId: data.quadrant,
                          intensity: data.intensity || 2,
                        },
                      ];

                const rawNote = (data.note || msg.content || '').trim();
                const showNote =
                  rawNote.length > 0 && !rawNote.toLowerCase().startsWith('отметил');

                return (
                  <View
                    key={msg.id || `chk_${index}`}
                    style={[
                      styles.checkinCardOuter,
                      isMe ? styles.checkinCardRight : styles.checkinCardLeft,
                    ]}
                  >
                    <View style={[styles.checkinCardInner, { borderColor: `${quadColor}66` }]}>
                      {/* Top Header of Check-in Card */}
                      <View style={styles.checkinCardHeader}>
                        <View style={styles.checkinCardSenderRow}>
                          <View
                            style={[
                              styles.checkinSenderAvatar,
                              { backgroundColor: isMe ? '#4FD1C5' : '#ED64A6' },
                            ]}
                          >
                            <Text style={styles.checkinSenderAvatarText}>
                              {isMe
                                ? user?.name?.charAt(0).toUpperCase() || 'Я'
                                : selectedPartner.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.checkinCardSenderName}>
                              {isMe ? 'Вы отметили настроение' : `${selectedPartner.name} отметил(а) настроение`}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={styles.checkinCardTime}>
                                {formatMessageTime(msg.created_at)}
                              </Text>
                              {isMe && renderMessageStatus(msg)}
                            </View>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                          {emotionsList.map((em, i) => (
                            <QuadrantIcon key={`q_${i}`} quadrantId={em.quadrantId || data.quadrant} size={18} />
                          ))}
                        </View>
                      </View>

                      {/* Emotions Badges (supports 1, 2, or 3 emotions) */}
                      <View style={styles.checkinEmotionsWrap}>
                        {emotionsList.map((em, emIdx) => {
                          const emColor = getQuadrantColor(em.quadrantId || data.quadrant);
                          return (
                            <View
                              key={`em_${emIdx}_${em.id}`}
                              style={[styles.checkinMoodPill, { backgroundColor: emColor, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                            >
                              <QuadrantIcon quadrantId={em.quadrantId || data.quadrant} size={14} color="#FFFFFF" />
                              <Text style={styles.checkinMoodPillText}>
                                {em.name.toUpperCase()}
                              </Text>
                            </View>
                          );
                        })}
                      </View>

                      {/* Note / Thought (only shown if a real personal note was entered) */}
                      {showNote ? (
                        <View style={styles.checkinNoteBox}>
                          <Text style={styles.checkinNoteText}>
                            «{rawNote}»
                          </Text>
                        </View>
                      ) : null}

                      {/* Context Pills (People, Place, Activity) */}
                      {((data.context_people?.length || 0) > 0 ||
                        (data.context_place?.length || 0) > 0 ||
                        (data.context_activity?.length || 0) > 0) && (
                        <View style={styles.checkinContextRow}>
                          {data.context_people?.map((p, i) => (
                            <View key={`cp-${i}`} style={styles.checkinContextChip}>
                              <Text style={styles.checkinContextChipText}>
                                👥 {getLocalizedContextTag(p, language)}
                              </Text>
                            </View>
                          ))}
                          {data.context_place?.map((p, i) => (
                            <View key={`cpl-${i}`} style={styles.checkinContextChip}>
                              <Text style={styles.checkinContextChipText}>
                                📍 {getLocalizedContextTag(p, language)}
                              </Text>
                            </View>
                          ))}
                          {data.context_activity?.map((p, i) => (
                            <View key={`ca-${i}`} style={styles.checkinContextChip}>
                              <Text style={styles.checkinContextChipText}>
                                ⚡ {getLocalizedContextTag(p, language)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Psychological Emotion Insight & Educational Breakdown */}
                      {(() => {
                        const insight = getEmotionsInsight(emotionsList, language);
                        const isCardExpanded = !!expandedCheckinIds[msg.id];
                        return (
                          <View style={styles.insightSection}>
                            <TouchableOpacity
                              style={styles.insightToggleBtn}
                              onPress={() => {
                                triggerHaptic('light');
                                setExpandedCheckinIds((prev) => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id],
                                }));
                              }}
                              activeOpacity={0.7}
                            >
                              <Ionicons
                                name={isCardExpanded ? 'book' : 'book-outline'}
                                size={14}
                                color="#4FD1C5"
                              />
                              <Text style={styles.insightToggleBtnText}>
                                {isCardExpanded ? 'Скрыть разбор чувств' : 'О чём эти чувства?'}
                              </Text>
                              <Ionicons
                                name={isCardExpanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="#4FD1C5"
                              />
                            </TouchableOpacity>

                            {isCardExpanded && (
                              <View style={styles.insightExpandedBox}>
                                {/* Coherent synthesis narrative (only when 2+ emotions) */}
                                {Boolean(insight.narrative) && (
                                  <Text style={styles.insightNarrativeText}>
                                    {insight.narrative}
                                  </Text>
                                )}

                                {/* Detailed breakdowns for each emotion */}
                                <View style={styles.insightItemsList}>
                                  {insight.items.map((item, idx) => (
                                    <View key={`ins_${idx}_${item.id}`} style={styles.insightItemCard}>
                                      <View style={styles.insightItemHeader}>
                                        <View
                                          style={[
                                            styles.insightItemDot,
                                            { backgroundColor: item.color },
                                          ]}
                                        />
                                        <Text style={styles.insightItemTitle}>
                                          {item.name}
                                        </Text>
                                        <Text style={styles.insightItemQuadName}>
                                          {item.quadrantName}
                                        </Text>
                                      </View>
                                      <Text style={styles.insightItemDefText}>
                                        {item.definition}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })()}

                      {/* Interactive Care Actions Directly on Partner's Check-in Card */}
                      {!isMe && (
                        <View style={styles.checkinCardActionsRow}>
                          <TouchableOpacity
                            style={styles.cardMicroActionBtn}
                            onPress={() =>
                              handleSendCareReaction('hug', '🤗 Теплые объятия для тебя!')
                            }
                          >
                            <Text style={styles.cardMicroActionEmoji}>🤗</Text>
                            <Text style={styles.cardMicroActionText}>Обнять</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cardMicroActionBtn}
                            onPress={() =>
                              handleSendCareReaction('with_you', '🤍 Я рядом, помни об этом!')
                            }
                          >
                            <Text style={styles.cardMicroActionEmoji}>🤍</Text>
                            <Text style={styles.cardMicroActionText}>Я рядом</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cardMicroActionBtn}
                            onPress={() =>
                              handleSendCareReaction('proud', '🌟 Горжусь тобой!')
                            }
                          >
                            <Text style={styles.cardMicroActionEmoji}>🌟</Text>
                            <Text style={styles.cardMicroActionText}>Горжусь</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.cardMicroActionBtn, styles.cardMicroActionTalk]}
                            onPress={() =>
                              handleSendCareReaction(
                                'talk',
                                '☕ Если захочешь поговорить — я на связи.'
                              )
                            }
                          >
                            <Text style={styles.cardMicroActionEmoji}>☕</Text>
                            <Text style={styles.cardMicroActionText}>Поговорить</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              }

              // 2. CARE SIGN REACTION CARD
              if (msg.type === 'reaction') {
                return (
                  <View
                    key={msg.id || `rx_${index}`}
                    style={[
                      styles.reactionMessageRow,
                      isMe ? styles.reactionRowRight : styles.reactionRowLeft,
                    ]}
                  >
                    <View style={styles.reactionMessageCard}>
                      <View style={styles.reactionMessageContent}>
                        <Text style={styles.reactionMessageSender}>
                          {isMe ? 'Вы отправили:' : `${msg.from_name || selectedPartner.name}:`}
                        </Text>
                        <Text style={styles.reactionMessageText}>{msg.content}</Text>
                        <Text style={styles.messageTimestamp}>
                          {formatMessageTime(msg.created_at)}
                        </Text>
                      </View>

                      {!isMe && (
                        <TouchableOpacity
                          style={styles.reactionReplyBtn}
                          onPress={() =>
                            handleSendCareReaction('hug', '🤗 Крепко обнимаю в ответ!')
                          }
                        >
                          <Text style={styles.reactionReplyBtnText}>🤗 Ответить</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              }

              // 3. CARE PING CARD («Как ты?»)
              if (msg.type === 'ping') {
                return (
                  <View
                    key={msg.id || `pg_${index}`}
                    style={[
                      styles.pingMessageRow,
                      isMe ? styles.pingRowRight : styles.pingRowLeft,
                    ]}
                  >
                    <View style={styles.pingMessageCard}>
                      <View style={styles.pingMessageHeader}>
                        <Ionicons name="chatbubble-ellipses" size={16} color="#4FD1C5" />
                        <Text style={styles.pingMessageTitle}>
                          {isMe
                            ? 'Вы поинтересовались: «Как ты?»'
                            : `${msg.from_name || selectedPartner.name} интересуется: «Как ты?»`}
                        </Text>
                      </View>

                      {!isMe && onOpenCheckIn && (
                        <TouchableOpacity
                          style={styles.pingReplyBtn}
                          onPress={() => {
                            triggerHaptic('medium');
                            onOpenCheckIn();
                          }}
                          activeOpacity={0.85}
                        >
                          <Ionicons name="sparkles" size={14} color="#0A0D12" />
                          <Text style={styles.pingReplyBtnText}>Отметить состояние</Text>
                          <Ionicons name="arrow-forward" size={13} color="#0A0D12" />
                        </TouchableOpacity>
                      )}

                      <Text style={styles.messageTimestamp}>
                        {formatMessageTime(msg.created_at)}
                      </Text>
                    </View>
                  </View>
                );
              }

              // 4. REGULAR TEXT MESSAGE
              return (
                <View
                  key={msg.id || `msg_${index}`}
                  style={[
                    styles.textMessageContainer,
                    isMe ? styles.textMsgRight : styles.textMsgLeft,
                  ]}
                >
                  <View style={[styles.textBubble, isMe ? styles.textBubbleMe : styles.textBubblePartner]}>
                    {!isMe && (
                      <Text style={styles.partnerBubbleAuthor}>
                        {msg.from_name || selectedPartner.name}
                      </Text>
                    )}
                    <Text style={styles.textMessageContent}>{msg.content}</Text>
                    <View style={styles.textMetaRow}>
                      <Text style={styles.textMessageTime}>
                        {formatMessageTime(msg.created_at)}
                      </Text>
                      {isMe && renderMessageStatus(msg)}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* C. TACTILE CHECK-IN BUTTON IN CHAT */}
          <View style={styles.shareMoodBar}>
            <TouchableOpacity
              style={styles.wideShareButton}
              onPress={handleOpenShareModal}
              activeOpacity={0.85}
            >
              <View style={styles.wideShareIconRing}>
                <Ionicons name="sparkles" size={17} color="#4FD1C5" />
              </View>
              <View style={styles.wideShareTextWrap}>
                <Text style={styles.wideShareButtonText}>Отметить состояние</Text>
                <Text style={styles.wideShareSubText}>
                  {selectedPartner ? `Поделиться с ${selectedPartner.name.split(' ')[0]}` : 'Поделиться в диалоге'}
                </Text>
              </View>
              <View style={styles.wideShareRightCluster}>
                <View style={styles.wideShareDotsRow}>
                  <View style={[styles.wideShareDot, { backgroundColor: '#F56565' }]} />
                  <View style={[styles.wideShareDot, { backgroundColor: '#ECC94B' }]} />
                  <View style={[styles.wideShareDot, { backgroundColor: '#4299E1' }]} />
                  <View style={[styles.wideShareDot, { backgroundColor: '#48BB78' }]} />
                </View>
                <View style={styles.wideShareChevronCircle}>
                  <Ionicons name="chevron-up" size={14} color="#4FD1C5" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* D. CHAT INPUT BAR */}
          <View style={styles.inputBar}>
            {/* Text Input Field */}
            <TextInput
              style={styles.textInputField}
              placeholder={`Сообщение для ${selectedPartner.name.split(' ')[0]}...`}
              placeholderTextColor="#718096"
              value={inputText}
              onChangeText={setInputText}
              multiline={false}
              numberOfLines={1}
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={handleSendTextMessage}
            />

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                inputText.trim() ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={handleSendTextMessage}
              disabled={!inputText.trim() || isSending}
              activeOpacity={0.8}
            >
              <Ionicons
                name="arrow-up"
                size={20}
                color={inputText.trim() ? '#0A0D12' : '#718096'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 5. MODAL: ПОДЕЛИТЬСЯ СОСТОЯНИЕМ (ОТМЕТИТЬ НОВОЕ + 3 ПОСЛЕДНИХ ЧЕКИНА) */}
      <Modal
        visible={isShareModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsShareModalOpen(false)}
      >
        <View style={styles.shareModalOverlay}>
          <TouchableOpacity
            style={styles.shareModalBackdrop}
            activeOpacity={1}
            onPress={() => setIsShareModalOpen(false)}
          />

          <View style={styles.shareModalSheet}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Header */}
            <View style={styles.shareModalHeader}>
              <View>
                <Text style={styles.shareModalTitle}>Поделиться состоянием</Text>
                <Text style={styles.shareModalSubtitle}>
                  {selectedPartner ? `Для ${selectedPartner.name}` : 'В диалог с близким'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.shareModalCloseBtn}
                onPress={() => setIsShareModalOpen(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#CBD5E0" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.shareModalScroll}
              contentContainerStyle={styles.shareModalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* TOP: ZEN ACTION CARD «ОТМЕТИТЬ СОСТОЯНИЕ» */}
              <View style={styles.shareZenCard}>
                <View style={styles.shareZenHeaderRow}>
                  <View style={styles.shareZenBadge}>
                    <Ionicons name="sparkles" size={20} color="#4FD1C5" />
                  </View>
                  <View style={styles.shareZenHeaderTexts}>
                    <Text style={styles.shareZenTitle}>Отметить состояние прямо сейчас</Text>
                    <Text style={styles.shareZenSub}>
                      {selectedPartner
                        ? `Определите эмоции на карте чувств для ${selectedPartner.name.split(' ')[0]}`
                        : 'Выберите чувства на карте и отправьте в диалог'}
                    </Text>
                  </View>
                </View>

                {/* 4 Quadrants Visual Grid Chips */}
                <View style={styles.shareZenQuadrantsRow}>
                  <View style={[styles.shareZenQuadPill, { backgroundColor: 'rgba(245, 101, 101, 0.15)', borderColor: 'rgba(245, 101, 101, 0.4)' }]}>
                    <View style={[styles.shareZenDot, { backgroundColor: '#F56565' }]} />
                    <Text style={[styles.shareZenQuadText, { color: '#FEB2B2' }]}>Красный</Text>
                  </View>
                  <View style={[styles.shareZenQuadPill, { backgroundColor: 'rgba(236, 201, 75, 0.15)', borderColor: 'rgba(236, 201, 75, 0.4)' }]}>
                    <View style={[styles.shareZenDot, { backgroundColor: '#ECC94B' }]} />
                    <Text style={[styles.shareZenQuadText, { color: '#FAF089' }]}>Жёлтый</Text>
                  </View>
                  <View style={[styles.shareZenQuadPill, { backgroundColor: 'rgba(66, 153, 225, 0.15)', borderColor: 'rgba(66, 153, 225, 0.4)' }]}>
                    <View style={[styles.shareZenDot, { backgroundColor: '#4299E1' }]} />
                    <Text style={[styles.shareZenQuadText, { color: '#90CDF4' }]}>Синий</Text>
                  </View>
                  <View style={[styles.shareZenQuadPill, { backgroundColor: 'rgba(72, 187, 120, 0.15)', borderColor: 'rgba(72, 187, 120, 0.4)' }]}>
                    <View style={[styles.shareZenDot, { backgroundColor: '#48BB78' }]} />
                    <Text style={[styles.shareZenQuadText, { color: '#9AE6B4' }]}>Зелёный</Text>
                  </View>
                </View>

                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => {
                    setIsShareModalOpen(false);
                    handleOpenRealCheckIn();
                  }}
                  style={styles.shareZenActionButton}
                >
                  <Ionicons name="sparkles" size={17} color="#0A0D12" />
                  <Text style={styles.shareZenActionBtnText}>Открыть карту 144 чувств</Text>
                  <Ionicons name="arrow-forward" size={17} color="#0A0D12" />
                </TouchableOpacity>
              </View>

              {/* BOTTOM: 3 ПОСЛЕДНИХ ЧЕКИНА */}
              <View style={styles.shareRecentSection}>
                <View style={styles.shareRecentHeaderRow}>
                  <Text style={styles.shareRecentSectionTitle}>Недавние чекины</Text>
                  <Text style={styles.shareRecentSectionSub}>Выберите, чтобы отправить в чат</Text>
                </View>

                {recentCheckIns.length === 0 ? (
                  <View style={styles.emptyRecentBox}>
                    <Text style={styles.emptyRecentText}>
                      У вас пока нет сохранённых чекинов.{'\n'}Нажмите на кнопку выше, чтобы отметить состояние!
                    </Text>
                  </View>
                ) : (
                  <View style={styles.recentCardsList}>
                    {recentCheckIns.map((item) => {
                      const quadId: QuadrantId = item.quadrantId || 'low_pleasant';
                      const qColor = getQuadrantColor(quadId);
                      const qEmoji = getQuadrantEmoji(quadId);

                      const titleStr =
                        item.emotions && item.emotions.length > 0
                          ? item.emotions.map((e) => e.name).join(', ')
                          : item.emotionName || item.emotionId;

                      const timeStr = formatTimeAgo(item.timestamp);
                      const noteText =
                        item.note &&
                        item.note.trim() &&
                        !item.note.trim().toLowerCase().startsWith('отметил')
                          ? item.note.trim()
                          : '';

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.recentShareCard,
                            { borderLeftColor: qColor, borderColor: `${qColor}40` },
                          ]}
                          onPress={() => handleShareSpecificCheckIn(item)}
                          activeOpacity={0.75}
                        >
                          <View style={styles.recentShareCardContent}>
                            <View style={styles.recentShareCardTop}>
                              <View style={[styles.recentShareEmotionsPill, { backgroundColor: `${qColor}20` }]}>
                                <QuadrantIcon quadrantId={quadId} size={15} color={qColor} />
                                <Text style={[styles.recentShareEmotionTitle, { color: '#FFFFFF' }]} numberOfLines={1}>
                                  {titleStr}
                                </Text>
                              </View>
                              <Text style={styles.recentShareTime}>{timeStr}</Text>
                            </View>

                            {noteText ? (
                              <Text style={styles.recentShareNote} numberOfLines={1}>
                                «{noteText}»
                              </Text>
                            ) : null}
                          </View>

                          <View style={styles.recentShareActionBox}>
                            <View style={[styles.sendMiniCircle, { backgroundColor: qColor }]}>
                              <Ionicons name="arrow-up" size={16} color="#0A0D12" />
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 5. MODAL: INVITE NEW PARTNER MODAL */}
      <Modal
        visible={isInviteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInviteModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Пригласить близкого</Text>
              <TouchableOpacity onPress={() => setIsInviteModalOpen(false)}>
                <Ionicons name="close" size={22} color="#A0AEC0" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Отправьте ссылку-приглашение близкому человеку или введите код, который он вам прислал:
            </Text>

            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleShareInviteLink}
            >
              <Ionicons name="paper-plane" size={18} color="#0A0D12" />
              <Text style={styles.primaryActionButtonText}>Отправить ссылку в мессенджер</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyCodePill}
              onPress={handleCopyCodeOnly}
            >
              <Text style={styles.copyCodePillText}>
                Ваш инвайт-код: <Text style={styles.copyCodeBold}>{user?.inviteCode}</Text>
              </Text>
              <Ionicons name="copy-outline" size={14} color="#A0AEC0" />
            </TouchableOpacity>

            <View style={{ marginTop: 12, width: '100%' }}>
              <Text style={styles.modalUserLabel}>Ввести код от партнёра:</Text>
              <View style={styles.codeEntryBox}>
                <TextInput
                  style={styles.codeEntryInput}
                  placeholder="6-значный код..."
                  placeholderTextColor="#718096"
                  value={partnerCodeInput}
                  onChangeText={setPartnerCodeInput}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={styles.codeEntryBtn}
                  onPress={handleConnectPartnerByCode}
                  disabled={isConnecting}
                >
                  <Text style={styles.codeEntryBtnText}>
                    {isConnecting ? '...' : 'Связать'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>



      {/* Telegram Login Modal */}
      <Modal
        visible={isTelegramModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTelegramModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="paper-plane" size={20} color="#2AABEE" />
                <Text style={styles.modalTitle}>Вход через Telegram</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTelegramModalOpen(false)}>
                <Ionicons name="close" size={22} color="#718096" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Укажите ваш Telegram @username для мгновенного входа:
            </Text>

            <TextInput
              style={styles.codeEntryInput}
              placeholder="@username (например: @durov)"
              placeholderTextColor="#718096"
              value={telegramInput}
              onChangeText={setTelegramInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleTelegramSubmit}
            />

            <TouchableOpacity
              style={[styles.telegramButton, { marginTop: 12 }, telegramSubmitting && { opacity: 0.6 }]}
              onPress={handleTelegramSubmit}
              disabled={telegramSubmitting}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
              <Text style={styles.telegramButtonText}>
                {telegramSubmitting ? 'Вход...' : 'Войти по никнейму Telegram'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Apple Login Modal */}
      <Modal
        visible={isAppleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAppleModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.modalTitle}>Вход через Apple ID</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAppleModalOpen(false)}>
                <Ionicons name="close" size={22} color="#718096" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Укажите ваш Apple ID email для входа и синхронизации:
            </Text>

            <TextInput
              style={styles.codeEntryInput}
              placeholder="ваш_email@icloud.com"
              placeholderTextColor="#718096"
              value={appleEmailInput}
              onChangeText={setAppleEmailInput}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleAppleSubmit}
            />

            <TouchableOpacity
              style={[styles.appleButton, { marginTop: 12 }, appleSubmitting && { opacity: 0.6 }]}
              onPress={handleAppleSubmit}
              disabled={appleSubmitting}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
              <Text style={styles.appleButtonText}>
                {appleSubmitting ? 'Вход...' : 'Войти с этим Apple ID'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.appleHintText}>
              💡 Если вы входили через Google с этим же email, данные свяжутся автоматически.
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  authScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },

  // Header for auth / onboarding
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F7FAFC',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 160,
    gap: 6,
  },
  profileAvatarMini: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4FD1C5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarMiniText: {
    color: '#0A0D12',
    fontSize: 12,
    fontWeight: '700',
  },
  profilePillName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },

  // Welcome Screen
  welcomeCard: {
    backgroundColor: '#12161F',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    marginTop: 8,
  },
  welcomeGlowBackdrop: {
    position: 'absolute',
    top: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
  },
  welcomeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#12161F',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  welcomeDesc: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featurePillList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  featurePillText: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '500',
  },
  appleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    gap: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  telegramButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2AABEE',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 10,
    marginBottom: 10,
    shadowColor: '#2AABEE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  telegramButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  googleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 10,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  googleButtonText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '700',
  },
  demoLink: {
    marginTop: 14,
    paddingVertical: 6,
  },
  demoLinkText: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  friendsAccountBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12161F',
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 16,
  },
  friendsAccountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  friendsAvatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4FD1C5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendsAvatarText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '800',
  },
  friendsAccountName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  friendsAccountSub: {
    color: '#718096',
    fontSize: 12,
  },
  friendsSwitchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252, 129, 129, 0.25)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  friendsSwitchAccountText: {
    color: '#FC8181',
    fontSize: 12,
    fontWeight: '600',
  },
  appleHintText: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
  },

  // Invite Partner Card
  invitePartnerCard: {
    backgroundColor: '#12161F',
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
  },
  inviteGraphicBox: {
    marginBottom: 16,
  },
  avatarRingsOuter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarRingLeft: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4FD1C5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#12161F',
    zIndex: 2,
  },
  avatarRingLetter: {
    color: '#0A0D12',
    fontSize: 24,
    fontWeight: '800',
  },
  avatarRingRight: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(237, 100, 166, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#12161F',
    marginLeft: -18,
    zIndex: 1,
  },
  inviteCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  inviteCardSubtitle: {
    fontSize: 14,
    color: '#A0AEC0',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  primaryActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4FD1C5',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 8,
    marginBottom: 12,
  },
  primaryActionButtonText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '700',
  },
  copyCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
    marginBottom: 16,
  },
  copyCodePillText: {
    color: '#A0AEC0',
    fontSize: 13,
  },
  copyCodeBold: {
    color: '#4FD1C5',
    fontWeight: '700',
    letterSpacing: 1,
  },
  manualCodeContainer: {
    width: '100%',
    alignItems: 'center',
  },
  toggleCodeInputBtn: {
    paddingVertical: 6,
  },
  toggleCodeInputText: {
    color: '#718096',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  codeEntryBox: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  codeEntryInput: {
    flex: 1,
    backgroundColor: '#1A202C',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  codeEntryBtn: {
    backgroundColor: '#2D3748',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 14,
  },
  codeEntryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  incomingInviteCard: {
    backgroundColor: 'rgba(237, 100, 166, 0.12)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(237, 100, 166, 0.35)',
  },
  incomingInviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  incomingHeartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(237, 100, 166, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incomingInviteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  incomingInviteSub: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 2,
    lineHeight: 18,
  },

  // ============================================
  // 1. CHATS LIST VIEW (TELEGRAM/WHATSAPP STYLE)
  // ============================================
  chatsListWrapper: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  chatsListContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  chatsListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  chatsListHeaderTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  chatsListHeaderSub: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
    fontWeight: '500',
  },
  chatsListHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteChatHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4FD1C5',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  inviteChatHeaderBtnText: {
    color: '#0A0D12',
    fontSize: 13,
    fontWeight: '800',
  },
  addChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  addChatBtnText: {
    color: '#4FD1C5',
    fontSize: 13,
    fontWeight: '700',
  },
  profileAvatarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E2433',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Quick Invite Banner
  quickInviteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121620',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.25)',
    marginBottom: 20,
    gap: 10,
  },
  quickInviteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  quickInviteTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  quickInviteDesc: {
    color: '#A0AEC0',
    fontSize: 12,
    marginTop: 2,
  },
  quickInviteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4FD1C5',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 4,
  },
  quickInviteActionText: {
    color: '#0A0D12',
    fontSize: 12,
    fontWeight: '800',
  },

  // Chats Section Header
  chatsSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  chatsSectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#718096',
    letterSpacing: 0.8,
  },
  chatsCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  chatsUnreadPill: {
    backgroundColor: '#FF5252',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chatsUnreadPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  // Chat Row Items
  chatsItemsContainer: {
    gap: 8,
  },
  chatRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12161F',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 12,
  },
  chatRowItemUnread: {
    borderColor: 'rgba(255, 82, 82, 0.45)',
    backgroundColor: '#161B26',
  },
  chatRowAvatarBox: {
    position: 'relative',
  },
  chatRowAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A202C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  chatRowAvatarLetter: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  chatRowOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: '#48BB78',
    borderWidth: 2,
    borderColor: '#12161F',
  },
  chatRowAvatarUnreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF5252',
    borderWidth: 2,
    borderColor: '#12161F',
  },
  chatRowContent: {
    flex: 1,
    gap: 3,
  },
  chatRowTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatRowPartnerName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  chatRowPartnerNameUnread: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  chatRowTime: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '500',
  },
  chatRowTimeUnread: {
    color: '#FF5252',
    fontWeight: '700',
  },
  chatRowMoodPillRow: {
    flexDirection: 'row',
    marginVertical: 1,
  },
  chatRowMoodPill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chatRowMoodPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  chatRowMoodPillEmpty: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  chatRowMoodPillEmptyText: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '500',
  },
  chatRowLastMsg: {
    color: '#A0AEC0',
    fontSize: 13,
    lineHeight: 17,
  },
  chatRowLastMsgUnread: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatRowRightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    minWidth: 44,
  },
  chatRowActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatRowUnreadBadge: {
    backgroundColor: '#FF5252',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  chatRowUnreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  // ============================================
  // 2. DEDICATED CHAT ROOM WITH SELECTED PARTNER
  // ============================================
  chatWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0A0D12',
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#11151C',
    borderBottomWidth: 1,
    borderBottomColor: '#1A202C',
    zIndex: 10,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  chatBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 4,
  },
  chatBackButtonText: {
    color: '#4FD1C5',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: -4,
  },
  partnerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2433',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  partnerAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  partnerHeaderMeta: {
    flex: 1,
    marginLeft: 4,
  },
  partnerHeaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  partnerHeaderName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#48BB78',
  },
  partnerMoodCapsule: {
    marginTop: 1,
  },
  partnerMoodCapsuleText: {
    color: '#A0AEC0',
    fontSize: 11,
    fontWeight: '500',
  },
  chatHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatHeaderIconBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },

  // Floating Banner
  floatingBanner: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(26, 32, 44, 0.95)',
    borderWidth: 1,
    borderColor: '#4FD1C5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingBannerText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },

  // Messages Area
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
  },
  chatWelcomeNotice: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(237, 100, 166, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(237, 100, 166, 0.15)',
    gap: 6,
    marginBottom: 8,
  },
  chatWelcomeNoticeText: {
    color: '#CBD5E0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  emptyChatBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyChatEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyChatTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyChatSubtitle: {
    color: '#718096',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Text Messages
  textMessageContainer: {
    flexDirection: 'row',
    width: '100%',
  },
  textMsgRight: {
    justifyContent: 'flex-end',
  },
  textMsgLeft: {
    justifyContent: 'flex-start',
  },
  textBubble: {
    maxWidth: '82%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  textBubbleMe: {
    backgroundColor: '#1E3A3A',
    borderTopRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
  },
  textBubblePartner: {
    backgroundColor: '#181E29',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  partnerBubbleAuthor: {
    color: '#4FD1C5',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  textMessageContent: {
    color: '#F7FAFC',
    fontSize: 15,
    lineHeight: 21,
  },
  textMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  textMessageTime: {
    color: '#718096',
    fontSize: 10,
    fontWeight: '500',
  },

  // Checkin Card in Chat
  checkinCardOuter: {
    width: '100%',
    marginVertical: 4,
  },
  checkinCardRight: {
    alignItems: 'flex-end',
  },
  checkinCardLeft: {
    alignItems: 'flex-start',
  },
  checkinCardInner: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#141A24',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  checkinCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkinCardSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkinSenderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkinSenderAvatarText: {
    color: '#0A0D12',
    fontSize: 13,
    fontWeight: '800',
  },
  checkinCardSenderName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  checkinCardTime: {
    color: '#718096',
    fontSize: 11,
  },
  checkinEmotionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  checkinMoodPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  checkinMoodPillText: {
    color: '#0A0D12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  checkinNoteBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4FD1C5',
  },
  checkinNoteText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  checkinContextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  checkinContextChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  checkinContextChipText: {
    color: '#A0AEC0',
    fontSize: 11,
  },
  checkinCardActionsRow: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 10,
    marginTop: 4,
  },
  cardMicroActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMicroActionTalk: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  cardMicroActionEmoji: {
    fontSize: 15,
  },
  cardMicroActionText: {
    color: '#CBD5E0',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },

  // Reaction Message
  reactionMessageRow: {
    width: '100%',
    marginVertical: 3,
  },
  reactionRowRight: {
    alignItems: 'flex-end',
  },
  reactionRowLeft: {
    alignItems: 'flex-start',
  },
  reactionMessageCard: {
    maxWidth: '85%',
    backgroundColor: 'rgba(237, 100, 166, 0.1)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(237, 100, 166, 0.35)',
  },
  reactionMessageContent: {
    marginBottom: 4,
  },
  reactionMessageSender: {
    color: '#ED64A6',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  reactionMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reactionReplyBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(237, 100, 166, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  reactionReplyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Ping Message («Как ты?»)
  pingMessageRow: {
    width: '100%',
    marginVertical: 3,
  },
  pingRowRight: {
    alignItems: 'flex-end',
  },
  pingRowLeft: {
    alignItems: 'flex-start',
  },
  pingMessageCard: {
    maxWidth: '85%',
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.35)',
  },
  pingMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  pingMessageTitle: {
    color: '#4FD1C5',
    fontSize: 13,
    fontWeight: '700',
  },
  pingReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4FD1C5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    marginTop: 4,
  },
  pingReplyBtnText: {
    color: '#0A0D12',
    fontSize: 12,
    fontWeight: '700',
  },
  messageTimestamp: {
    color: '#718096',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },

  // Share Mood Bar & Wide Button
  shareMoodBar: {
    backgroundColor: '#0F131A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  wideShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#151B26',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(79, 209, 197, 0.35)',
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  wideShareIconRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideShareTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  wideShareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  wideShareSubText: {
    color: '#8E9BAE',
    fontSize: 11,
    marginTop: 1,
    fontWeight: '500',
  },
  wideShareRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wideShareDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  wideShareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  wideShareChevronCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chat Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#11151C',
    gap: 8,
  },
  textInputField: {
    flex: 1,
    backgroundColor: '#1A202C',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 14,
    height: 38,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#4FD1C5',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  // Share Modal & Bottom Sheet
  shareModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  shareModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  shareModalSheet: {
    backgroundColor: '#0F131A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A5568',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202C',
  },
  shareModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  shareModalSubtitle: {
    color: '#718096',
    fontSize: 12,
    marginTop: 2,
  },
  shareModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareModalScroll: {
    maxHeight: 520,
  },
  shareModalContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 20,
  },

  // Radiant Orb Button in Share Modal (Wave effect like on Home screen)
  shareHeroWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    position: 'relative',
  },
  radiantWaveOuter: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(79, 209, 197, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.12)',
  },
  radiantWaveMid: {
    position: 'absolute',
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.18)',
  },
  radiantWaveInner: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: 'rgba(244, 63, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.22)',
  },
  radiantOrbButton: {
    width: 96,
    height: 96,
    borderRadius: 48,
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  radiantOrbMesh: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0F141C',
  },
  orbGlowQuarter: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    opacity: 0.65,
  },
  radiantOrbCore: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  radiantOrbTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 15,
  },
  radiantOrbSub: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
  },
  shareZenCard: {
    backgroundColor: '#141A24',
    borderWidth: 1.5,
    borderColor: 'rgba(79, 209, 197, 0.4)',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 5,
  },
  shareZenHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  shareZenBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(79, 209, 197, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareZenHeaderTexts: {
    flex: 1,
  },
  shareZenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  shareZenSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },
  shareZenQuadrantsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  shareZenQuadPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  shareZenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  shareZenQuadText: {
    fontSize: 10,
    fontWeight: '700',
  },
  shareZenActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4FD1C5',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareZenActionBtnText: {
    color: '#0A0D12',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Recent Checkins in Share Modal
  shareRecentSection: {
    marginTop: 14,
  },
  shareRecentHeaderRow: {
    marginBottom: 10,
  },
  shareRecentSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  shareRecentSectionSub: {
    color: '#718096',
    fontSize: 12,
    marginTop: 2,
  },
  emptyRecentBox: {
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyRecentText: {
    color: '#8E9BAE',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  recentCardsList: {
    gap: 8,
  },
  recentShareCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141822',
    borderRadius: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#242D3D',
  },
  recentShareCardContent: {
    flex: 1,
    marginRight: 10,
  },
  recentShareCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recentShareEmotionsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  recentShareEmoji: {
    fontSize: 16,
  },
  recentShareEmotionTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  recentShareTime: {
    color: '#718096',
    fontSize: 11,
  },
  recentShareNote: {
    color: '#CBD5E0',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  recentShareActionBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendMiniCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },

  // Insight Section in Check-in Cards
  insightSection: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 8,
  },
  insightToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
  },
  insightToggleBtnText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  insightExpandedBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    gap: 8,
  },
  insightNarrativeText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  insightItemsList: {
    gap: 6,
    marginTop: 4,
  },
  insightItemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  insightItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  insightItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  insightItemTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  insightItemQuadName: {
    color: '#718096',
    fontSize: 10,
    fontWeight: '600',
  },
  insightItemDefText: {
    color: '#A0AEC0',
    fontSize: 12,
    lineHeight: 16,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1A202C',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#A0AEC0',
    marginBottom: 16,
    lineHeight: 18,
  },
  modalUserBox: {
    backgroundColor: '#12161F',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modalUserLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  modalUserName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalUserEmail: {
    color: '#A0AEC0',
    fontSize: 12,
    marginBottom: 10,
  },
  modalCopyInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    marginBottom: 6,
  },
  modalCopyInviteBtnText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  modalCopyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  modalCopyCodeBtnText: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  modalSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(252, 129, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(252, 129, 129, 0.25)',
    gap: 8,
  },
  modalSignOutBtnText: {
    color: '#FC8181',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBtn: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalCancelBtn: {
    marginTop: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#718096',
    fontSize: 14,
    fontWeight: '600',
  },
});
