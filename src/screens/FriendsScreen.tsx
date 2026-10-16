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
import { QUADRANTS } from '../data/emotionsData';
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
import { triggerHaptic } from '../utils/haptics';

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

  // Settings / Partner Info Modal
  const [isInfoModalOpen, setIsInfoModalOpen] = useState<boolean>(false);

  // Add Partner / Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);

  // Demo Login modal for development/testing
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (chatMessages && chatMessages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [chatMessages.length]);

  // If active partner is selected, periodically refresh their messages
  useEffect(() => {
    if (selectedPartner) {
      fetchChatMessages(selectedPartner.id);
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
    const text = `Привет! Я делюсь своим настроением в «Как я?». Давай свяжемся, чтобы чувствовать друг друга и поддерживать: ${url}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Приглашение в «Как я?»',
          text,
          url,
        });
        return;
      } catch (err) {
        // Fallback to clipboard
      }
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 3000);
    } else {
      Alert.alert(
        'Ссылка-приглашение готова!',
        `Отправьте её вашему партнёру в мессенджере:\n\n${url}`,
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

  // Send Check-in Card into Chat
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

    const primaryEmotion = latestCheckIn.emotions && latestCheckIn.emotions[0];
    const quadId: QuadrantId = primaryEmotion?.quadrantId || latestCheckIn.quadrantId || 'low_pleasant';
    const quad = QUADRANTS[quadId];
    const quadName = quad?.translations?.ru || quadId;
    const emotionRu = primaryEmotion?.name || latestCheckIn.emotionName || latestCheckIn.emotionId;

    const checkinData: ChatCheckinData = {
      checkin_id: latestCheckIn.id,
      emotion_id: latestCheckIn.emotionId,
      emotionNameRu: emotionRu,
      quadrant: quadId,
      quadrantNameRu: quadName,
      energy: quad?.energy || 'low',
      pleasantness: quad?.pleasantness || 'pleasant',
      intensity: latestCheckIn.intensity || 2,
      context_people: latestCheckIn.context?.people || [],
      context_place: latestCheckIn.context?.location || [],
      context_activity: latestCheckIn.context?.activity || [],
      note: latestCheckIn.note || '',
      created_at: latestCheckIn.timestamp,
    };

    setLastSentBanner(`💛 Вы отправили настроение «${emotionRu}»`);
    setTimeout(() => setLastSentBanner(null), 3000);

    await sendChatMessage(
      selectedPartner.id,
      latestCheckIn.note || `Отметил(а) настроение: ${emotionRu}`,
      'checkin',
      checkinData
    );

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
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

            <TouchableOpacity
              style={styles.googleButton}
              onPress={signInWithGoogle}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={20} color="#0A0D12" />
              <Text style={styles.googleButtonText}>Войти через Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.demoLink}
              onPress={() => setIsDemoModalOpen(true)}
            >
              <Text style={styles.demoLinkText}>⚡ Быстрый тестовый вход (Демо)</Text>
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
            {user && (
              <TouchableOpacity
                style={styles.profilePill}
                onPress={() => setIsInfoModalOpen(true)}
              >
                <View style={styles.profileAvatarMini}>
                  <Text style={styles.profileAvatarMiniText}>
                    {user.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                  </Text>
                </View>
                <Text style={styles.profilePillName} numberOfLines={1}>
                  {user.name.split(' ')[0]}
                </Text>
              </TouchableOpacity>
            )}
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
                style={styles.addChatBtn}
                onPress={() => setIsInviteModalOpen(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="person-add-outline" size={18} color="#4FD1C5" />
                <Text style={styles.addChatBtnText}>Добавить</Text>
              </TouchableOpacity>

              {user && (
                <TouchableOpacity
                  style={styles.profileAvatarButton}
                  onPress={() => setIsInfoModalOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.profileAvatarButtonText}>
                    {user.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Quick Banner: Fast Invite Link */}
          <View style={styles.quickInviteBanner}>
            <View style={styles.quickInviteLeft}>
              <Ionicons name="link-outline" size={20} color="#4FD1C5" />
              <View style={{ flex: 1 }}>
                <Text style={styles.quickInviteTitle}>Пригласить в близкий круг</Text>
                <Text style={styles.quickInviteDesc}>
                  Код: <Text style={{ color: '#4FD1C5', fontWeight: '700' }}>{user?.inviteCode}</Text> • 1-клик в мессенджеры
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.quickInviteActionBtn}
              onPress={handleShareInviteLink}
            >
              <Ionicons name="share-outline" size={16} color="#0A0D12" />
              <Text style={styles.quickInviteActionText}>Поделиться</Text>
            </TouchableOpacity>
          </View>

          {/* Section Heading */}
          <View style={styles.chatsSectionHeaderRow}>
            <Text style={styles.chatsSectionHeading}>ВАШИ ЧАТЫ</Text>
            <Text style={styles.chatsCountBadge}>{conversationList.length}</Text>
          </View>

          {/* Chats / Partners List Items (Telegram/WhatsApp style) */}
          <View style={styles.chatsItemsContainer}>
            {conversationList.map((conv) => {
              const partner = conv.partner;
              const checkin = conv.latestCheckin;
              const quadColor = getQuadrantColor(checkin?.quadrant);
              const quadEmoji = getQuadrantEmoji(checkin?.quadrant);

              // Snippet for last message
              let lastMsgSnippet = 'Нажмите, чтобы открыть чат';
              let lastMsgTime = '';

              if (conv.lastMessage) {
                const msg = conv.lastMessage;
                const isMe = msg.from_user_id === user?.id;
                const prefix = isMe ? 'Вы: ' : '';
                lastMsgTime = formatMessageTime(msg.created_at);

                if (msg.type === 'checkin') {
                  const emotion =
                    msg.checkin_data?.emotionNameRu ||
                    msg.checkin_data?.emotion_id ||
                    'настроением';
                  lastMsgSnippet = `${prefix}⚡ Чекин: ${emotion}`;
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
                lastMsgSnippet = `⚡ ${emName}${checkin.note ? ` — «${checkin.note}»` : ''}`;
              }

              return (
                <TouchableOpacity
                  key={partner.id}
                  style={styles.chatRowItem}
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
                    <View style={styles.chatRowOnlineDot} />
                  </View>

                  {/* Middle: Partner Name, Mood Capsule, Last Message */}
                  <View style={styles.chatRowContent}>
                    <View style={styles.chatRowTopRow}>
                      <Text style={styles.chatRowPartnerName} numberOfLines={1}>
                        {partner.name}
                      </Text>
                      {lastMsgTime ? (
                        <Text style={styles.chatRowTime}>{lastMsgTime}</Text>
                      ) : null}
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
                    <Text style={styles.chatRowLastMsg} numberOfLines={1}>
                      {lastMsgSnippet}
                    </Text>
                  </View>

                  {/* Right Chevron */}
                  <View style={styles.chatRowChevronBox}>
                    <Ionicons name="chevron-forward" size={18} color="#718096" />
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
                  <View style={styles.livePulseDot} />
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
                onPress={() => setIsInfoModalOpen(true)}
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
                            <Text style={styles.checkinCardTime}>
                              {formatMessageTime(msg.created_at)}
                            </Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 20 }}>{quadEmoji}</Text>
                      </View>

                      {/* Main Glow Pill with Emotion Name */}
                      <View style={[styles.checkinMoodPill, { backgroundColor: quadColor }]}>
                        <Text style={styles.checkinMoodPillText}>
                          {emotionTitle.toUpperCase()}
                        </Text>
                      </View>

                      {/* Note / Thought (if exists) */}
                      {(data.note || msg.content) ? (
                        <View style={styles.checkinNoteBox}>
                          <Text style={styles.checkinNoteText}>
                            «{data.note || msg.content}»
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
                        >
                          <Ionicons name="create-outline" size={15} color="#0A0D12" />
                          <Text style={styles.pingReplyBtnText}>Ответить чекином настроения</Text>
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
                      {isMe && (
                        <Ionicons
                          name="checkmark-done"
                          size={13}
                          color="#4FD1C5"
                          style={{ marginLeft: 3 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* C. QUICK CARE CHIPS HORIZONTAL BAR */}
          <View style={styles.quickCareBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickCareScroll}
            >
              <TouchableOpacity
                style={styles.quickCareChip}
                onPress={handleSendPing}
                activeOpacity={0.7}
              >
                <Text style={styles.quickCareChipEmoji}>💭</Text>
                <Text style={styles.quickCareChipText}>«Как ты?»</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCareChip}
                onPress={() =>
                  handleSendCareReaction('hug', '🤗 Теплые объятия для тебя!')
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickCareChipEmoji}>🤗</Text>
                <Text style={styles.quickCareChipText}>Обнять</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCareChip}
                onPress={() =>
                  handleSendCareReaction('with_you', '🤍 Я рядом, помни об этом!')
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickCareChipEmoji}>🤍</Text>
                <Text style={styles.quickCareChipText}>Я рядом</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickCareChip}
                onPress={() =>
                  handleSendCareReaction('proud', '🌟 Горжусь тобой!')
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickCareChipEmoji}>🌟</Text>
                <Text style={styles.quickCareChipText}>Горжусь</Text>
              </TouchableOpacity>

              {/* «Хочешь поговорить?» PLACED STRICTLY LAST */}
              <TouchableOpacity
                style={[styles.quickCareChip, styles.quickCareChipTalk]}
                onPress={() =>
                  handleSendCareReaction(
                    'talk',
                    '☕ Если захочешь поговорить — я на связи.'
                  )
                }
                activeOpacity={0.7}
              >
                <Text style={styles.quickCareChipEmoji}>☕</Text>
                <Text style={styles.quickCareChipText}>Хочешь поговорить?</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* D. CHAT INPUT BAR WITH MOOD SHARE BUTTON */}
          <View style={styles.inputBar}>
            {/* 💖 Share Check-in Card Button */}
            <TouchableOpacity
              style={styles.shareCheckinBtn}
              onPress={handleShareCheckInCard}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={18} color="#FBBF24" />
              <Text style={styles.shareCheckinBtnText}>Чекин</Text>
            </TouchableOpacity>

            {/* Text Input Field */}
            <TextInput
              style={styles.textInputField}
              placeholder={`Сообщение для ${selectedPartner.name.split(' ')[0]}...`}
              placeholderTextColor="#718096"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
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

      {/* 6. MODAL: PROFILE & SETTINGS */}
      <Modal
        visible={isInfoModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsInfoModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Профиль и настройки</Text>
              <TouchableOpacity onPress={() => setIsInfoModalOpen(false)}>
                <Ionicons name="close" size={22} color="#A0AEC0" />
              </TouchableOpacity>
            </View>

            {user && (
              <View style={styles.modalUserBox}>
                <Text style={styles.modalUserLabel}>Вы вошли как:</Text>
                <Text style={styles.modalUserName}>{user.name}</Text>
                <Text style={styles.modalUserEmail}>{user.email}</Text>

                <TouchableOpacity
                  style={styles.modalCopyInviteBtn}
                  onPress={handleShareInviteLink}
                >
                  <Ionicons name="share-social-outline" size={16} color="#4FD1C5" />
                  <Text style={styles.modalCopyInviteBtnText}>Поделиться инвайт-ссылкой</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalCopyCodeBtn}
                  onPress={handleCopyCodeOnly}
                >
                  <Text style={styles.modalCopyCodeBtnText}>
                    Код: <Text style={{ color: '#4FD1C5', fontWeight: '800' }}>{user.inviteCode}</Text>
                  </Text>
                  <Ionicons name="copy-outline" size={14} color="#A0AEC0" />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalSignOutBtn}
              onPress={() => {
                setIsInfoModalOpen(false);
                setSelectedPartner(null);
                signOut();
              }}
            >
              <Ionicons name="log-out-outline" size={18} color="#FC8181" />
              <Text style={styles.modalSignOutBtnText}>Выйти из аккаунта</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. MODAL: DEMO LOGIN */}
      <Modal
        visible={isDemoModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDemoModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Быстрый вход для тестирования</Text>
            <Text style={styles.modalSubtitle}>
              Выберите профиль для проверки синхронизации чекинов и чата:
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: '#4299E1' }]}
              onPress={async () => {
                setIsDemoModalOpen(false);
                await signInDemo('Вася', 'vasya@example.com');
              }}
            >
              <Text style={styles.modalBtnText}>⚡ Войти как Вася</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { borderColor: '#ED64A6' }]}
              onPress={async () => {
                setIsDemoModalOpen(false);
                await signInDemo('Аня (Жена)', 'anya@example.com');
              }}
            >
              <Text style={styles.modalBtnText}>🌸 Войти как Аня (Жена)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsDemoModalOpen(false)}
            >
              <Text style={styles.modalCancelBtnText}>Отмена</Text>
            </TouchableOpacity>
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
    paddingBottom: 48,
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
  googleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 18,
    gap: 10,
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
    marginTop: 16,
    paddingVertical: 6,
  },
  demoLinkText: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
    paddingBottom: 40,
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
  chatRowTime: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '500',
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
  chatRowChevronBox: {
    paddingLeft: 4,
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
  checkinMoodPill: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
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

  // Quick Care Chips Bar
  quickCareBar: {
    backgroundColor: '#11151C',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
    paddingVertical: 8,
  },
  quickCareScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  quickCareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  quickCareChipTalk: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderColor: 'rgba(251, 191, 36, 0.25)',
  },
  quickCareChipEmoji: {
    fontSize: 14,
  },
  quickCareChipText: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '600',
  },

  // Chat Input Bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#11151C',
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
    gap: 8,
  },
  shareCheckinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    gap: 4,
    height: 42,
  },
  shareCheckinBtnText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '700',
  },
  textInputField: {
    flex: 1,
    backgroundColor: '#1A202C',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#FFFFFF',
    fontSize: 14,
    maxHeight: 100,
    minHeight: 42,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#4FD1C5',
  },
  sendBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
