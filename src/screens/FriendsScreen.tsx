import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FriendRecord, CheckInRecord } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';
import { getFriends, addFriend, deleteFriend, recordFriendReaction } from '../storage/friendsStorage';
import { shareCheckIn } from '../utils/shareHelper';
import { getLocalizedEmotionName } from '../utils/localizationHelper';
import { triggerHaptic } from '../utils/haptics';

interface FriendsScreenProps {
  latestCheckIn?: CheckInRecord;
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({ latestCheckIn }) => {
  const { language, t } = useLanguage();
  const {
    user,
    isAuthenticated,
    partners,
    partnerFeed,
    pendingInvite,
    clearPendingInvite,
    signInWithGoogle,
    signInDemo,
    signOut,
    connectPartner,
    refreshFeed,
    sendCarePing,
    sendCareReaction,
  } = useAuth();

  const [friends, setFriends] = useState<FriendRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newRel, setNewRel] = useState<'partner' | 'friend' | 'family' | 'other'>('friend');

  // Partner connect code input
  const [partnerCodeInput, setPartnerCodeInput] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [lastSentReaction, setLastSentReaction] = useState<string | null>(null);

  // Custom demo login input modal
  const [isCustomLoginOpen, setIsCustomLoginOpen] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customEmail, setCustomEmail] = useState<string>('');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    const list = await getFriends();
    setFriends(list);
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
    const text = `Привет! Я делюсь своим настроением в приложении «Как я?». Давай свяжемся, чтобы чувствовать друг друга и поддерживать: ${url}`;

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
      alert(`Ссылка-приглашение скопирована в буфер обмена!\n\nОтправьте её в Telegram, WhatsApp или iMessage:\n${url}`);
    } else {
      Alert.alert(
        'Ссылка-приглашение готова!',
        `Отправьте её вашему партнёру в мессенджере:\n\n${url}`,
        [{ text: 'Понятно', style: 'default' }]
      );
    }
  };

  // Connect via pending invite link
  const handleAcceptPendingInvite = async () => {
    if (!pendingInvite) return;
    setIsConnecting(true);
    triggerHaptic('medium');
    const result = await connectPartner(pendingInvite.code);
    setIsConnecting(false);

    if (result.success) {
      triggerHaptic('success');
      Alert.alert(
        'Успешно связано! ❤️',
        `Вы теперь на связи с ${pendingInvite.fromName || result.partner?.name || 'партнёром'}. Настроение и чекины будут обновляться в реальном времени!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось подключить', result.error || 'Проверьте ссылку');
    }
  };

  const handleConnectPartnerByCode = async () => {
    if (!partnerCodeInput.trim()) {
      Alert.alert('Ошибка', 'Введите 6-значный код партнёра');
      return;
    }
    setIsConnecting(true);
    triggerHaptic('medium');
    const result = await connectPartner(partnerCodeInput.trim());
    setIsConnecting(false);

    if (result.success) {
      triggerHaptic('success');
      setPartnerCodeInput('');
      Alert.alert(
        'Успешно связано! ❤️',
        `Вы успешно подключились к пользователю ${result.partner?.name}. Теперь вы будете видеть настроение друг друга в реальном времени!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось подключить', result.error || 'Проверьте правильность кода');
    }
  };

  // Care Ping: «Спросить: Как ты?»
  const handleSendPing = async (partnerId?: string) => {
    triggerHaptic('medium');
    const res = await sendCarePing(partnerId);
    if (res.success) {
      triggerHaptic('success');
      Alert.alert('Пинг заботы отправлен! 💭', 'Партнёру на телефон придёт мягкое уведомление: «Интересуется, как ты?»');
    } else {
      Alert.alert('Не удалось отправить', res.message);
    }
  };

  // Care Reaction (Обнять, Я рядом, Горжусь, Хочешь поговорить?)
  const handleSendCareReaction = async (
    partnerId: string,
    reactionType: string,
    reactionLabel: string
  ) => {
    triggerHaptic('success');
    setLastSentReaction(reactionLabel);
    const res = await sendCareReaction(partnerId, reactionType, reactionLabel);
    if (res.success) {
      setTimeout(() => setLastSentReaction(null), 3500);
    }
  };

  const handleShareMyMood = async () => {
    triggerHaptic('medium');
    if (latestCheckIn) {
      await shareCheckIn(latestCheckIn, language);
    } else {
      if (Platform.OS === 'web') {
        alert(t('friends.emptySubtitle'));
      } else {
        Alert.alert(t('friends.title'), t('friends.emptySubtitle'));
      }
    }
  };

  const handleAddFriend = async () => {
    if (!newName.trim()) return;
    triggerHaptic('medium');

    const colors = ['#E63946', '#F4A261', '#457B9D', '#2A9D8F', '#9B5DE5', '#F15BB5'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newRecord: FriendRecord = {
      id: `f-${Date.now()}`,
      name: newName.trim(),
      relationship: newRel,
      avatarColor: randomColor,
      lastCheckIn: {
        quadrantId: 'low_pleasant',
        emotionId: 'calm',
        emotionName: language === 'ru' ? 'Спокойствие' : 'Calm',
        timeAgo: language === 'ru' ? 'Только что' : 'Just now',
        note: language === 'ru' ? 'На связи с близкими!' : 'Connected with loved ones!',
      },
    };

    const updated = await addFriend(newRecord);
    setFriends(updated);
    setNewName('');
    setIsAddModalOpen(false);
  };

  const handleDeleteFriend = (id: string) => {
    const confirmAction = async () => {
      triggerHaptic('light');
      const updated = await deleteFriend(id);
      setFriends(updated);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('journal.deleteConfirm'))) {
        confirmAction();
      }
    } else {
      Alert.alert(
        t('friends.title'),
        t('journal.deleteConfirm'),
        [
          { text: t('friends.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: confirmAction },
        ]
      );
    }
  };

  const getRelLabel = (rel: string) => {
    if (rel === 'partner') return t('friends.relPartner');
    if (rel === 'family') return t('friends.relFamily');
    if (rel === 'friend') return t('friends.relFriend');
    return t('friends.relOther');
  };

  // Primary partner (if connected) & their latest check-in
  const primaryPartner = partners.length > 0 ? partners[0] : null;
  const partnerLatestCheckIn = partnerFeed.length > 0 ? partnerFeed[0] : null;
  const partnerQuad = partnerLatestCheckIn
    ? QUADRANTS[partnerLatestCheckIn.quadrant as keyof typeof QUADRANTS]
    : null;
  const partnerColor = partnerQuad?.color_hex || '#4FD1C5';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{t('friends.title')}</Text>
          <Text style={styles.subtitle}>{t('friends.subtitle')}</Text>
        </View>

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            triggerHaptic('light');
            setIsAddModalOpen(true);
          }}
        >
          <Ionicons name="person-add" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>{t('friends.addFriend')}</Text>
        </TouchableOpacity>
      </View>

      {/* 1. INCOMING INVITE BANNER (When someone opened by ?invite=CODE link) */}
      {pendingInvite && (
        <View style={styles.incomingInviteCard}>
          <View style={styles.incomingInviteHeader}>
            <View style={styles.incomingHeartCircle}>
              <Ionicons name="heart" size={24} color="#ED64A6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.incomingInviteTitle}>
                {pendingInvite.fromName
                  ? `${pendingInvite.fromName} приглашает вас!`
                  : 'Приглашение в Близкий Круг!'}
              </Text>
              <Text style={styles.incomingInviteSub}>
                Свяжитесь в приложении, чтобы видеть настроение друг друга в реальном времени.
              </Text>
            </View>
          </View>

          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.acceptInviteBtn}
              onPress={handleAcceptPendingInvite}
              disabled={isConnecting}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.acceptInviteBtnText}>
                {isConnecting ? 'Подключение...' : 'Принять приглашение и связаться'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.incomingLoginPrompt}>
              <Text style={styles.incomingLoginPromptText}>
                Войдите за 1 клик, чтобы автоматически стать парой:
              </Text>
              <View style={styles.demoButtonsRow}>
                <TouchableOpacity
                  style={[styles.demoBtn, { borderColor: '#ED64A6' }]}
                  onPress={async () => {
                    await signInDemo('Аня (Жена)', 'anya@example.com');
                  }}
                >
                  <Text style={styles.demoBtnText}>🌸 Войти как Жена</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoBtn, { borderColor: '#4299E1' }]}
                  onPress={async () => {
                    await signInDemo('Вася', 'vasya@example.com');
                  }}
                >
                  <Text style={styles.demoBtnText}>⚡ Войти как Вася</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.demoBtn, { borderColor: '#718096' }]}
                  onPress={() => setIsCustomLoginOpen(true)}
                >
                  <Text style={styles.demoBtnText}>✏️ Своё имя</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 2. AUTH / PROFILE & SMART SHARE CARD */}
      {!isAuthenticated ? (
        <View style={styles.authCard}>
          <View style={styles.authHeader}>
            <View style={styles.authBadge}>
              <Ionicons name="cloud-outline" size={18} color="#4FD1C5" />
              <Text style={styles.authBadgeText}>Облако & Связь с близкими</Text>
            </View>
          </View>
          <Text style={styles.authTitle}>Синхронизация и поддержка</Text>
          <Text style={styles.authDesc}>
            Войдите, чтобы делиться чувствами со своей второй половинкой, получать push-уведомления и обмениваться знаками заботы.
          </Text>

          {/* Login Buttons */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={signInWithGoogle}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={20} color="#FFFFFF" />
            <Text style={styles.googleButtonText}>Войти через Google</Text>
          </TouchableOpacity>

          {/* Quick Demo Fast-Login */}
          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#4299E1' }]}
              onPress={() => signInDemo('Вася', 'vasya@example.com')}
            >
              <Text style={styles.demoBtnText}>⚡ Вход: Вася</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#ED64A6' }]}
              onPress={() => signInDemo('Аня (Жена)', 'anya@example.com')}
            >
              <Text style={styles.demoBtnText}>🌸 Вход: Жена Васи</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.demoBtn, { borderColor: '#718096' }]}
              onPress={() => setIsCustomLoginOpen(true)}
            >
              <Text style={styles.demoBtnText}>✏️ Свой аккаунт</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileUser}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.profileName}>{user?.name}</Text>
                <Text style={styles.profileEmail}>{user?.email}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={20} color="#E53E3E" />
            </TouchableOpacity>
          </View>

          {/* SMART INVITE LINK BUTTON (Golden Flow via Messengers) */}
          <TouchableOpacity
            style={styles.smartShareButton}
            onPress={handleShareInviteLink}
            activeOpacity={0.85}
          >
            <View style={styles.smartShareIconCircle}>
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smartShareTitle}>Пригласить близкого (ссылка)</Text>
              <Text style={styles.smartShareDesc}>
                Отправьте ссылку в Telegram или WhatsApp — партнёр свяжется в 1 клик
              </Text>
            </View>
            <Ionicons name="share-outline" size={20} color="#4FD1C5" />
          </TouchableOpacity>

          {/* Alternative manual code */}
          <View style={styles.inviteCodeRow}>
            <Text style={styles.inviteCodeText}>
              Или код для ручного ввода: <Text style={styles.inviteCodeHighlight}>{user?.inviteCode}</Text>
            </Text>
          </View>

          {/* Connect by Code (if partner sent their code) */}
          {partners.length === 0 && (
            <View style={styles.connectPartnerSection}>
              <Text style={styles.connectTitle}>Или введите полученный код партнёра:</Text>
              <View style={styles.connectInputRow}>
                <TextInput
                  style={styles.connectInput}
                  placeholder="Вставьте 6-значный код..."
                  placeholderTextColor="#718096"
                  value={partnerCodeInput}
                  onChangeText={setPartnerCodeInput}
                  autoCapitalize="characters"
                  maxLength={8}
                />
                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleConnectPartnerByCode}
                  disabled={isConnecting}
                >
                  <Text style={styles.connectBtnText}>
                    {isConnecting ? '...' : 'Связать'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* 3. HERO: «ПУЛЬС ПАРТНЁРА» (LIVE MOOD HERO WIDGET) */}
      {isAuthenticated && primaryPartner && (
        <View style={[styles.heroPartnerCard, { borderColor: partnerColor }]}>
          <View style={styles.heroPartnerTop}>
            <View style={styles.heroPartnerLeft}>
              <View style={[styles.heroAvatarCircle, { backgroundColor: partnerColor }]}>
                <Text style={styles.heroAvatarText}>
                  {primaryPartner.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <View style={styles.heroNameRow}>
                  <Text style={styles.heroPartnerName}>{primaryPartner.name}</Text>
                  <View style={styles.heroPartnerBadge}>
                    <Text style={styles.heroPartnerBadgeText}>❤️ На связи</Text>
                  </View>
                </View>
                <Text style={styles.heroPartnerStatusSub}>
                  {partnerLatestCheckIn
                    ? 'Текущее эмоциональное состояние:'
                    : 'Партнёр ещё не отмечал настроение'}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={refreshFeed} style={styles.refreshFeedBtn}>
              <Ionicons name="refresh" size={18} color="#4FD1C5" />
            </TouchableOpacity>
          </View>

          {partnerLatestCheckIn ? (
            <View style={styles.partnerStateBox}>
              <View style={styles.partnerEmotionRow}>
                <View style={[styles.emotionPillBig, { backgroundColor: partnerColor }]}>
                  <Text style={styles.emotionPillBigText}>
                    {partnerLatestCheckIn.emotion_id.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.partnerTimeBox}>
                  <Ionicons name="time-outline" size={14} color="#A0AEC0" />
                  <Text style={styles.partnerTimeText}>
                    {new Date(partnerLatestCheckIn.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>

              {partnerLatestCheckIn.note && (
                <Text style={styles.heroPartnerNote}>
                  "{partnerLatestCheckIn.note}"
                </Text>
              )}

              {/* Context tags */}
              <View style={styles.heroTagsRow}>
                {partnerLatestCheckIn.context_people?.map((p, i) => (
                  <View key={i} style={styles.heroTag}>
                    <Text style={styles.heroTagText}>👤 {p}</Text>
                  </View>
                ))}
                {partnerLatestCheckIn.context_place?.map((p, i) => (
                  <View key={i} style={styles.heroTag}>
                    <Text style={styles.heroTagText}>📍 {p}</Text>
                  </View>
                ))}
                {partnerLatestCheckIn.context_activity?.map((p, i) => (
                  <View key={i} style={styles.heroTag}>
                    <Text style={styles.heroTagText}>⚡ {p}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.noCheckinNotice}>
              <Text style={styles.noCheckinNoticeText}>
                Партнёр ещё не делал чекинов. Отправьте «Пинг заботы», чтобы спросить, как дела!
              </Text>
            </View>
          )}

          {/* Feedback banner when reaction is sent */}
          {lastSentReaction && (
            <View style={styles.reactionSentBanner}>
              <Ionicons name="checkmark-circle" size={16} color="#48BB78" />
              <Text style={styles.reactionSentBannerText}>
                Отправлено: {lastSentReaction}
              </Text>
            </View>
          )}

          {/* CARE MICRO-ACTIONS & PING */}
          <View style={styles.careActionsSection}>
            <View style={styles.careSectionHeader}>
              <Text style={styles.careSectionTitle}>Знаки заботы и поддержка:</Text>
              <TouchableOpacity
                style={styles.pingCareBtn}
                onPress={() => handleSendPing(primaryPartner.id)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color="#4FD1C5" />
                <Text style={styles.pingCareBtnText}>Спросить «Как ты?»</Text>
              </TouchableOpacity>
            </View>

            {/* Quick care buttons with «Хочешь поговорить?» PLACED LAST */}
            <View style={styles.careButtonsGrid}>
              <TouchableOpacity
                style={styles.careBtn}
                onPress={() =>
                  handleSendCareReaction(primaryPartner.id, 'hug', '🤗 Теплые объятия для тебя!')
                }
              >
                <Text style={styles.careBtnEmoji}>🤗</Text>
                <Text style={styles.careBtnLabel}>Обнять</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.careBtn}
                onPress={() =>
                  handleSendCareReaction(primaryPartner.id, 'with_you', '🤍 Я рядом, помни об этом!')
                }
              >
                <Text style={styles.careBtnEmoji}>🤍</Text>
                <Text style={styles.careBtnLabel}>Я рядом</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.careBtn}
                onPress={() =>
                  handleSendCareReaction(primaryPartner.id, 'proud', '🌟 Горжусь тобой и твоими успехами!')
                }
              >
                <Text style={styles.careBtnEmoji}>🌟</Text>
                <Text style={styles.careBtnLabel}>Горжусь</Text>
              </TouchableOpacity>

              {/* «Хочешь поговорить?» is placed LAST as requested */}
              <TouchableOpacity
                style={[styles.careBtn, styles.careBtnTalk]}
                onPress={() =>
                  handleSendCareReaction(primaryPartner.id, 'talk', '☕ Если захочешь поговорить — я всегда на связи.')
                }
              >
                <Text style={styles.careBtnEmoji}>☕</Text>
                <Text style={styles.careBtnLabel}>Хочешь поговорить?</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* 4. PARTNER CHECK-IN HISTORY TIMELINE */}
      {isAuthenticated && partnerFeed.length > 1 && (
        <View style={styles.historySection}>
          <Text style={styles.historySectionTitle}>История чекинов партнёра</Text>
          <View style={styles.feedList}>
            {partnerFeed.slice(1).map((item) => {
              const quad = QUADRANTS[item.quadrant as keyof typeof QUADRANTS];
              const color = quad?.color_hex || '#4FD1C5';
              const date = new Date(item.created_at);
              const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const dateStr = date.toLocaleDateString([], { day: 'numeric', month: 'short' });

              return (
                <View key={item.id} style={[styles.feedCard, { borderLeftColor: color }]}>
                  <View style={styles.feedCardTop}>
                    <Text style={[styles.feedEmotionTitle, { color }]}>
                      {item.emotion_id.toUpperCase()}
                    </Text>
                    <Text style={styles.feedTime}>{dateStr}, {timeStr}</Text>
                  </View>

                  {item.note && <Text style={styles.feedNote}>"{item.note}"</Text>}

                  <View style={styles.feedTagsRow}>
                    {item.context_people?.map((p, i) => (
                      <View key={i} style={styles.feedTag}>
                        <Text style={styles.feedTagText}>👤 {p}</Text>
                      </View>
                    ))}
                    {item.context_place?.map((p, i) => (
                      <View key={i} style={styles.feedTag}>
                        <Text style={styles.feedTagText}>📍 {p}</Text>
                      </View>
                    ))}
                    {item.context_activity?.map((p, i) => (
                      <View key={i} style={styles.feedTag}>
                        <Text style={styles.feedTagText}>⚡ {p}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* 5. SHARE MY CURRENT MOOD BANNER */}
      <TouchableOpacity
        style={styles.shareBanner}
        activeOpacity={0.85}
        onPress={handleShareMyMood}
      >
        <View style={styles.shareBannerLeft}>
          <View style={styles.shareIconCircle}>
            <Ionicons name="share-social" size={20} color="#4FD1C5" />
          </View>
          <View>
            <Text style={styles.shareBannerTitle}>{t('friends.shareMyMood')}</Text>
            <Text style={styles.shareBannerSub}>
              {latestCheckIn
                ? `${t('friends.recentFeeling')}: ${getLocalizedEmotionName(
                    latestCheckIn.emotionId,
                    latestCheckIn.emotionName,
                    language
                  )}`
                : t('home.noRecent')}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#718096" />
      </TouchableOpacity>

      {/* 6. LOCAL FRIENDS LIST */}
      <View style={styles.localFriendsHeader}>
        <Text style={styles.localFriendsTitle}>Дополнительные контакты</Text>
      </View>

      {friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyTitle}>{t('friends.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('friends.emptySubtitle')}</Text>
        </View>
      ) : (
        <View style={styles.friendsList}>
          {friends.map((friend) => {
            const checkIn = friend.lastCheckIn;
            const quadrant = checkIn ? QUADRANTS[checkIn.quadrantId] : null;
            const emotionTitle = checkIn
              ? getLocalizedEmotionName(checkIn.emotionId, checkIn.emotionName, language)
              : '';

            return (
              <View key={friend.id} style={styles.friendCard}>
                <View style={styles.friendHeader}>
                  <View style={styles.friendInfoLeft}>
                    <View style={[styles.avatar, { backgroundColor: friend.avatarColor }]}>
                      <Text style={styles.avatarInitial}>{friend.name.charAt(0)}</Text>
                    </View>
                    <View>
                      <Text style={styles.friendName}>{friend.name}</Text>
                      <Text style={styles.friendRel}>{getRelLabel(friend.relationship)}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => handleDeleteFriend(friend.id)}
                    style={styles.deleteButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#718096" />
                  </TouchableOpacity>
                </View>

                {checkIn && quadrant && (
                  <View style={[styles.checkInBox, { borderLeftColor: quadrant.color_hex }]}>
                    <View style={styles.checkInTop}>
                      <View style={styles.emotionPill}>
                        <View style={[styles.quadrantDot, { backgroundColor: quadrant.color_hex }]} />
                        <Text style={styles.emotionName}>{emotionTitle}</Text>
                      </View>
                      <Text style={styles.timeAgo}>{checkIn.timeAgo}</Text>
                    </View>

                    {checkIn.note && (
                      <Text style={styles.friendNote} numberOfLines={2}>
                        "{checkIn.note}"
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Modal: Custom Demo Login */}
      <Modal
        visible={isCustomLoginOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsCustomLoginOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Вход в профиль</Text>
            <Text style={styles.modalSub}>Введите имя и email для создания аккаунта</Text>

            <TextInput
              style={styles.input}
              placeholder="Ваше имя (например, Иван)"
              placeholderTextColor="#718096"
              value={customName}
              onChangeText={setCustomName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email (например, ivan@example.com)"
              placeholderTextColor="#718096"
              value={customEmail}
              onChangeText={setCustomEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCustomLoginOpen(false)}
              >
                <Text style={styles.modalCancelText}>Отмена</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={async () => {
                  if (!customName.trim() || !customEmail.trim()) {
                    Alert.alert('Ошибка', 'Заполните имя и email');
                    return;
                  }
                  await signInDemo(customName.trim(), customEmail.trim());
                  setIsCustomLoginOpen(false);
                  setCustomName('');
                  setCustomEmail('');
                }}
              >
                <Text style={styles.modalSubmitText}>Войти</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Add Local Friend */}
      <Modal
        visible={isAddModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('friends.addFriend')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('friends.friendNamePlaceholder')}
              placeholderTextColor="#718096"
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.relTitle}>{t('friends.relationship')}</Text>
            <View style={styles.relChipsRow}>
              {(['partner', 'friend', 'family', 'other'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.relChip, newRel === r && styles.relChipActive]}
                  onPress={() => setNewRel(r)}
                >
                  <Text style={[styles.relChipText, newRel === r && styles.relChipTextActive]}>
                    {getRelLabel(r)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>{t('friends.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleAddFriend}
              >
                <Text style={styles.modalSubmitText}>{t('friends.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F7FAFC',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#A0AEC0',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D3748',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Incoming Invite Banner
  incomingInviteCard: {
    backgroundColor: 'rgba(237, 100, 166, 0.12)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ED64A6',
    padding: 16,
    marginBottom: 20,
  },
  incomingInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  incomingHeartCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(237, 100, 166, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingInviteTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  incomingInviteSub: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  acceptInviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ED64A6',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  acceptInviteBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  incomingLoginPrompt: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(237, 100, 166, 0.3)',
    paddingTop: 10,
  },
  incomingLoginPromptText: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },

  // Auth Card
  authCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  authBadgeText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  authTitle: {
    color: '#F7FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  authDesc: {
    color: '#A0AEC0',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EA4335',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  googleButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  demoBtn: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  demoBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },

  // Profile Card & Smart Share
  profileCard: {
    backgroundColor: '#11151C',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  profileUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#0A0D12',
    fontSize: 18,
    fontWeight: '800',
  },
  profileName: {
    color: '#F7FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  logoutBtn: {
    padding: 8,
  },
  smartShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#319795',
    marginBottom: 10,
  },
  smartShareIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#319795',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smartShareTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  smartShareDesc: {
    color: '#A0AEC0',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  inviteCodeRow: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  inviteCodeText: {
    color: '#718096',
    fontSize: 12,
  },
  inviteCodeHighlight: {
    color: '#4FD1C5',
    fontWeight: '800',
    letterSpacing: 1,
  },
  connectPartnerSection: {
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    paddingTop: 12,
  },
  connectTitle: {
    color: '#CBD5E0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  connectInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  connectInput: {
    flex: 1,
    backgroundColor: '#1A202C',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  connectBtn: {
    backgroundColor: '#319795',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // HERO PARTNER CARD (Пульс партнёра)
  heroPartnerCard: {
    backgroundColor: '#11151C',
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1.5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  heroPartnerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  heroPartnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarText: {
    color: '#0A0D12',
    fontSize: 20,
    fontWeight: '800',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroPartnerName: {
    color: '#F7FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  heroPartnerBadge: {
    backgroundColor: 'rgba(237, 100, 166, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  heroPartnerBadgeText: {
    color: '#ED64A6',
    fontSize: 11,
    fontWeight: '700',
  },
  heroPartnerStatusSub: {
    color: '#A0AEC0',
    fontSize: 12,
    marginTop: 2,
  },
  refreshFeedBtn: {
    padding: 6,
  },
  partnerStateBox: {
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  partnerEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emotionPillBig: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  emotionPillBigText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  partnerTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  partnerTimeText: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '600',
  },
  heroPartnerNote: {
    color: '#E2E8F0',
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 10,
  },
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heroTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  heroTagText: {
    color: '#CBD5E0',
    fontSize: 11,
  },
  noCheckinNotice: {
    backgroundColor: '#1A202C',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  noCheckinNoticeText: {
    color: '#A0AEC0',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  reactionSentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(72, 187, 120, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  reactionSentBannerText: {
    color: '#48BB78',
    fontSize: 12,
    fontWeight: '700',
  },

  // Care Actions & Ping
  careActionsSection: {
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    paddingTop: 12,
  },
  careSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  careSectionTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
  },
  pingCareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pingCareBtnText: {
    color: '#4FD1C5',
    fontSize: 11,
    fontWeight: '700',
  },
  careButtonsGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  careBtn: {
    flex: 1,
    minWidth: 70,
    backgroundColor: '#1A202C',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  careBtnTalk: {
    minWidth: 130,
    borderColor: 'rgba(79, 209, 197, 0.3)',
  },
  careBtnEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  careBtnLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // History timeline
  historySection: {
    marginBottom: 20,
  },
  historySectionTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  feedList: {
    gap: 10,
  },
  feedCard: {
    backgroundColor: '#11151C',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  feedCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  feedEmotionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  feedTime: {
    color: '#718096',
    fontSize: 11,
  },
  feedNote: {
    color: '#E2E8F0',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
    marginBottom: 6,
  },
  feedTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  feedTag: {
    backgroundColor: '#1A202C',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  feedTagText: {
    color: '#CBD5E0',
    fontSize: 10,
  },

  // Share Banner
  shareBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  shareBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  shareBannerSub: {
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 2,
  },

  // Local Friends
  localFriendsHeader: {
    marginBottom: 10,
  },
  localFriendsTitle: {
    color: '#A0AEC0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: '#11151C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A202C',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
    lineHeight: 16,
  },
  friendsList: {
    gap: 10,
  },
  friendCard: {
    backgroundColor: '#11151C',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A202C',
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  friendRel: {
    fontSize: 11,
    color: '#718096',
  },
  deleteButton: {
    padding: 4,
  },
  checkInBox: {
    backgroundColor: '#1A202C',
    borderRadius: 10,
    borderLeftWidth: 4,
    padding: 10,
    marginTop: 8,
  },
  checkInTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quadrantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emotionName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  timeAgo: {
    fontSize: 11,
    color: '#718096',
  },
  friendNote: {
    fontSize: 12,
    color: '#CBD5E0',
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1A202C',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F7FAFC',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    color: '#A0AEC0',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#11151C',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 12,
  },
  relTitle: {
    fontSize: 12,
    color: '#A0AEC0',
    marginBottom: 8,
  },
  relChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  relChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#11151C',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  relChipActive: {
    backgroundColor: '#2B6CB0',
    borderColor: '#4299E1',
  },
  relChipText: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  relChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalCancelText: {
    color: '#A0AEC0',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: '#319795',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
