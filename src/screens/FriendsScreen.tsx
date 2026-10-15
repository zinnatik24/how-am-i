import React, { useState } from 'react';
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
import { CheckInRecord, QuadrantId } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';
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

  // Partner connect code input toggle & state
  const [showCodeInput, setShowCodeInput] = useState<boolean>(false);
  const [partnerCodeInput, setPartnerCodeInput] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [lastSentReaction, setLastSentReaction] = useState<string | null>(null);
  const [isCopiedToast, setIsCopiedToast] = useState<boolean>(false);

  // Demo Login modal for development/testing
  const [isDemoModalOpen, setIsDemoModalOpen] = useState<boolean>(false);

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

    if (result.success) {
      triggerHaptic('success');
      Alert.alert(
        'Вы связаны! ❤️',
        `Вы теперь на связи с ${pendingInvite.fromName || result.partner?.name || 'партнёром'}. Настроение и чекины будут обновляться в реальном времени!`
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

    if (result.success) {
      triggerHaptic('success');
      setPartnerCodeInput('');
      setShowCodeInput(false);
      Alert.alert(
        'Вы связаны! ❤️',
        `Вы успешно подключились к ${result.partner?.name}. Теперь вы будете видеть настроение друг друга в реальном времени!`
      );
    } else {
      triggerHaptic('light');
      Alert.alert('Не удалось связать', result.error || 'Проверьте правильность кода');
    }
  };

  // Care Ping: «Спросить: Как ты?»
  const handleSendPing = async (partnerId?: string) => {
    triggerHaptic('medium');
    const res = await sendCarePing(partnerId);
    if (res.success) {
      triggerHaptic('success');
      setLastSentReaction('💬 «Как ты?» (Пинг заботы отправлен)');
      setTimeout(() => setLastSentReaction(null), 3500);
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

  // Primary partner (if connected) & their latest check-in
  const primaryPartner = partners.length > 0 ? partners[0] : null;
  const partnerLatestCheckIn = partnerFeed.length > 0 ? partnerFeed[0] : null;
  const partnerQuad = partnerLatestCheckIn
    ? QUADRANTS[partnerLatestCheckIn.quadrant as QuadrantId]
    : null;
  const partnerColor = partnerQuad?.color_hex || '#4FD1C5';

  // Format time ago for partner
  const formatTimeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return 'Только что';
    if (diff < 60) return `${diff} мин назад`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours} ч назад`;
    return new Date(dateStr).toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. ELEGANT SCREEN HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Близкие</Text>
          <Text style={styles.headerSubtitle}>
            {isAuthenticated && primaryPartner
              ? `На связи с ${primaryPartner.name}`
              : 'Эмоциональный пульс пары'}
          </Text>
        </View>

        {isAuthenticated && user && (
          <TouchableOpacity
            style={styles.profilePill}
            onPress={() => {
              Alert.alert(
                user.name,
                `Email: ${user.email}\nВаш инвайт-код: ${user.inviteCode}`,
                [
                  { text: 'Закрыть', style: 'cancel' },
                  { text: 'Выйти из аккаунта', style: 'destructive', onPress: signOut },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <View style={styles.profileAvatarMini}>
              <Text style={styles.profileAvatarMiniText}>
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <Text style={styles.profilePillName} numberOfLines={1}>
              {user.name.split(' ')[0]}
            </Text>
            <Ionicons name="ellipsis-vertical" size={14} color="#718096" />
          </TouchableOpacity>
        )}
      </View>

      {/* TOAST: COPIED LINK */}
      {isCopiedToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={18} color="#48BB78" />
          <Text style={styles.toastText}>Ссылка скопирована в буфер обмена!</Text>
        </View>
      )}

      {/* 2. INCOMING INVITE BANNER (If opened via ?invite=CODE link) */}
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
                Подключитесь, чтобы чувствовать настроение друг друга в реальном времени.
              </Text>
            </View>
          </View>

          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={handleAcceptPendingInvite}
              disabled={isConnecting}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionButtonText}>
                {isConnecting ? 'Связываем...' : 'Принять приглашение и связаться'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.googleButton}
              onPress={signInWithGoogle}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={20} color="#0A0D12" />
              <Text style={styles.googleButtonText}>Войти через Google и связаться</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. STATE A: NOT AUTHENTICATED (BEAUTIFUL ONBOARDING) */}
      {!isAuthenticated && (
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeGlowBackdrop} />

          <View style={styles.welcomeIconRow}>
            <View style={styles.welcomeIconCircle}>
              <Ionicons name="heart-circle" size={36} color="#ED64A6" />
            </View>
            <View style={[styles.welcomeIconCircle, { marginLeft: -16 }]}>
              <Ionicons name="sparkles" size={26} color="#FBBF24" />
            </View>
          </View>

          <Text style={styles.welcomeTitle}>Быть ближе к тем,{'\n'}кто действительно дорог</Text>
          <Text style={styles.welcomeDesc}>
            Узнавайте, как дела у любимого человека без лишних слов. Делитесь чувствами,
            замечайте усталость или радость и согревайте знаками заботы.
          </Text>

          {/* Core Features Pillars */}
          <View style={styles.featurePillList}>
            <View style={styles.featurePill}>
              <Ionicons name="pulse-outline" size={16} color="#4FD1C5" />
              <Text style={styles.featurePillText}>Живой пульс настроения</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="cafe-outline" size={16} color="#FBBF24" />
              <Text style={styles.featurePillText}>Знаки заботы в 1 клик</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="lock-closed-outline" size={16} color="#ED64A6" />
              <Text style={styles.featurePillText}>Только для вас двоих</Text>
            </View>
          </View>

          {/* Primary CTA: Google Sign In */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={signInWithGoogle}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-google" size={20} color="#0A0D12" />
            <Text style={styles.googleButtonText}>Войти через Google</Text>
          </TouchableOpacity>

          {/* Subtle Demo Option for Quick Testing */}
          <TouchableOpacity
            style={styles.demoLink}
            onPress={() => setIsDemoModalOpen(true)}
          >
            <Text style={styles.demoLinkText}>⚡ Быстрый тестовый вход (Демо)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 4. STATE B: AUTHENTICATED, BUT NO PARTNER CONNECTED (FOCUSED INVITE) */}
      {isAuthenticated && !primaryPartner && (
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

          <Text style={styles.inviteCardTitle}>Пригласите партнёра</Text>
          <Text style={styles.inviteCardSubtitle}>
            Отправьте персональную ссылку в Telegram или WhatsApp. Ваш партнёр нажмёт на неё и мгновенно свяжется с вами.
          </Text>

          {/* Big Primary Share Button */}
          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={handleShareInviteLink}
            activeOpacity={0.85}
          >
            <Ionicons name="paper-plane" size={20} color="#0A0D12" />
            <Text style={styles.primaryActionButtonText}>Отправить ссылку партнёру</Text>
          </TouchableOpacity>

          {/* Quick Copy Code Button */}
          <TouchableOpacity
            style={styles.copyCodePill}
            onPress={handleCopyCodeOnly}
            activeOpacity={0.7}
          >
            <Text style={styles.copyCodePillText}>
              Ваш код: <Text style={styles.copyCodeBold}>{user?.inviteCode}</Text>
            </Text>
            <Ionicons name="copy-outline" size={14} color="#A0AEC0" />
          </TouchableOpacity>

          {/* Collapsible Manual Code Input */}
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
      )}

      {/* 5. STATE C: AUTHENTICATED WITH PARTNER (LIVE PARTNER PULSE HERO) */}
      {isAuthenticated && primaryPartner && (
        <>
          {/* A. Hero: Live Partner Status Card */}
          <View style={[styles.pulseCard, { borderColor: `${partnerColor}44` }]}>
            <View style={styles.pulseHeader}>
              <View style={styles.pulsePartnerInfo}>
                <View style={[styles.pulseAvatar, { backgroundColor: partnerColor }]}>
                  <Text style={styles.pulseAvatarText}>
                    {primaryPartner.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <View style={styles.pulseNameRow}>
                    <Text style={styles.pulsePartnerName}>{primaryPartner.name}</Text>
                    <View style={styles.pulseActiveBadge}>
                      <View style={styles.pulseDot} />
                      <Text style={styles.pulseActiveText}>На связи</Text>
                    </View>
                  </View>
                  <Text style={styles.pulseTimeAgo}>
                    {partnerLatestCheckIn
                      ? formatTimeAgo(partnerLatestCheckIn.created_at)
                      : 'Ещё не отмечал(а) настроение'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  refreshFeed();
                }}
                style={styles.refreshIconBtn}
              >
                <Ionicons name="refresh" size={18} color="#A0AEC0" />
              </TouchableOpacity>
            </View>

            {/* Partner Latest Emotion Display */}
            {partnerLatestCheckIn ? (
              <View style={styles.partnerEmotionContainer}>
                {/* Big Glow Mood Pill */}
                <View style={[styles.partnerMoodPill, { backgroundColor: partnerColor }]}>
                  <Text style={styles.partnerMoodPillText}>
                    {getLocalizedEmotionName(
                      partnerLatestCheckIn.emotion_id,
                      partnerLatestCheckIn.emotion_id,
                      language
                    ).toUpperCase()}
                  </Text>
                </View>

                {/* Partner note in quotes */}
                {partnerLatestCheckIn.note ? (
                  <Text style={styles.partnerNote}>
                    «{partnerLatestCheckIn.note}»
                  </Text>
                ) : null}

                {/* Context Pills (People, Place, Activity) */}
                <View style={styles.contextPillsRow}>
                  {partnerLatestCheckIn.context_people?.map((p, i) => (
                    <View key={`pe-${i}`} style={styles.contextPill}>
                      <Text style={styles.contextPillText}>
                        👤 {getLocalizedContextTag(p, language)}
                      </Text>
                    </View>
                  ))}
                  {partnerLatestCheckIn.context_place?.map((p, i) => (
                    <View key={`pl-${i}`} style={styles.contextPill}>
                      <Text style={styles.contextPillText}>
                        📍 {getLocalizedContextTag(p, language)}
                      </Text>
                    </View>
                  ))}
                  {partnerLatestCheckIn.context_activity?.map((p, i) => (
                    <View key={`ac-${i}`} style={styles.contextPill}>
                      <Text style={styles.contextPillText}>
                        ⚡ {getLocalizedContextTag(p, language)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyPartnerState}>
                <Ionicons name="leaf-outline" size={32} color="#718096" />
                <Text style={styles.emptyPartnerStateText}>
                  {primaryPartner.name} пока не делал(а) чекинов сегодня.{'\n'}
                  Спросите, как дела, одним касанием:
                </Text>
              </View>
            )}

            {/* Feedback banner when reaction is sent */}
            {lastSentReaction && (
              <View style={styles.reactionSentBanner}>
                <Ionicons name="heart" size={16} color="#ED64A6" />
                <Text style={styles.reactionSentBannerText}>{lastSentReaction}</Text>
              </View>
            )}

            {/* B. Care Micro-Reactions Bar */}
            <View style={styles.careSection}>
              <View style={styles.careSectionTop}>
                <Text style={styles.careSectionHeading}>Знаки заботы</Text>
                <TouchableOpacity
                  style={styles.carePingBtn}
                  onPress={() => handleSendPing(primaryPartner.id)}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color="#4FD1C5" />
                  <Text style={styles.carePingBtnText}>Спросить «Как ты?»</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.careButtonsGrid}>
                <TouchableOpacity
                  style={styles.careButton}
                  onPress={() =>
                    handleSendCareReaction(primaryPartner.id, 'hug', '🤗 Теплые объятия для тебя!')
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.careEmoji}>🤗</Text>
                  <Text style={styles.careLabel}>Обнять</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.careButton}
                  onPress={() =>
                    handleSendCareReaction(primaryPartner.id, 'with_you', '🤍 Я рядом, помни об этом!')
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.careEmoji}>🤍</Text>
                  <Text style={styles.careLabel}>Я рядом</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.careButton}
                  onPress={() =>
                    handleSendCareReaction(primaryPartner.id, 'proud', '🌟 Горжусь тобой!')
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.careEmoji}>🌟</Text>
                  <Text style={styles.careLabel}>Горжусь</Text>
                </TouchableOpacity>

                {/* «Хочешь поговорить?» PLACED STRICTLY LAST */}
                <TouchableOpacity
                  style={[styles.careButton, styles.careButtonTalk]}
                  onPress={() =>
                    handleSendCareReaction(
                      primaryPartner.id,
                      'talk',
                      '☕ Если захочешь поговорить — я на связи.'
                    )
                  }
                  activeOpacity={0.75}
                >
                  <Text style={styles.careEmoji}>☕</Text>
                  <Text style={styles.careLabel}>Хочешь поговорить?</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* C. Mutual Status Reflection Card ("Что партнёр видит про вас") */}
          <View style={styles.reflectionCard}>
            <View style={styles.reflectionHeader}>
              <Ionicons name="eye-outline" size={16} color="#A0AEC0" />
              <Text style={styles.reflectionHeading}>Что видит партнёр про вас:</Text>
            </View>
            <View style={styles.reflectionContent}>
              {latestCheckIn ? (
                <View style={styles.reflectionRow}>
                  <View style={styles.reflectionStateBox}>
                    <Text style={styles.reflectionMoodText}>
                      {getLocalizedEmotionName(
                        latestCheckIn.emotionId,
                        latestCheckIn.emotionName,
                        language
                      )}
                    </Text>
                    <Text style={styles.reflectionSub}>
                      {formatTimeAgo(latestCheckIn.timestamp)}
                    </Text>
                  </View>
                  {onOpenCheckIn && (
                    <TouchableOpacity
                      style={styles.updateCheckInBtn}
                      onPress={() => {
                        triggerHaptic('medium');
                        onOpenCheckIn();
                      }}
                    >
                      <Text style={styles.updateCheckInBtnText}>Обновить</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.reflectionRow}>
                  <Text style={styles.reflectionEmptyText}>
                    Вы ещё не отмечали настроение.
                  </Text>
                  {onOpenCheckIn && (
                    <TouchableOpacity
                      style={styles.updateCheckInBtn}
                      onPress={() => {
                        triggerHaptic('medium');
                        onOpenCheckIn();
                      }}
                    >
                      <Text style={styles.updateCheckInBtnText}>Отметиться</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* D. Recent History Timeline (if multiple checkins) */}
          {partnerFeed.length > 1 && (
            <View style={styles.timelineSection}>
              <Text style={styles.timelineHeading}>Недавние состояния {primaryPartner.name}</Text>
              <View style={styles.timelineList}>
                {partnerFeed.slice(1, 5).map((item) => {
                  const quad = QUADRANTS[item.quadrant as QuadrantId];
                  const color = quad?.color_hex || '#4FD1C5';
                  return (
                    <View key={item.id} style={styles.timelineItem}>
                      <View style={[styles.timelineDot, { backgroundColor: color }]} />
                      <View style={styles.timelineBody}>
                        <View style={styles.timelineRow}>
                          <Text style={[styles.timelineEmotion, { color }]}>
                            {getLocalizedEmotionName(item.emotion_id, item.emotion_id, language)}
                          </Text>
                          <Text style={styles.timelineTime}>
                            {formatTimeAgo(item.created_at)}
                          </Text>
                        </View>
                        {item.note ? (
                          <Text style={styles.timelineNote} numberOfLines={2}>
                            «{item.note}»
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </>
      )}

      {/* 6. MODAL: DEMO LOGIN MODAL (Discrete developer test) */}
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
              Выберите профиль для проверки синхронизации чекинов и реакций пары:
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 48,
  },

  // 1. Header
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

  // Toast
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A202C',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#48BB78',
    gap: 8,
  },
  toastText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },

  // 2. Incoming Invite Banner
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

  // 3. Welcome Onboarding Card
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
    filter: 'blur(40px)',
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

  // 4. Invite Partner Card (Empty partner state)
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

  // 5. LIVE PARTNER PULSE CARD
  pulseCard: {
    backgroundColor: '#12161F',
    borderRadius: 28,
    padding: 20,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  pulseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulsePartnerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pulseAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseAvatarText: {
    color: '#0A0D12',
    fontSize: 20,
    fontWeight: '800',
  },
  pulseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulsePartnerName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pulseActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(72, 187, 120, 0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 5,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#48BB78',
  },
  pulseActiveText: {
    color: '#48BB78',
    fontSize: 11,
    fontWeight: '700',
  },
  pulseTimeAgo: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  refreshIconBtn: {
    padding: 8,
  },

  // Partner Emotion Box
  partnerEmotionContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  partnerMoodPill: {
    paddingVertical: 8,
    paddingHorizontal: 22,
    borderRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  partnerMoodPillText: {
    color: '#0A0D12',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  partnerNote: {
    fontSize: 15,
    color: '#E2E8F0',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  contextPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  contextPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  contextPillText: {
    color: '#A0AEC0',
    fontSize: 12,
  },
  emptyPartnerState: {
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
    gap: 8,
  },
  emptyPartnerStateText: {
    color: '#A0AEC0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Reaction Sent Toast Banner
  reactionSentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(237, 100, 166, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    gap: 6,
  },
  reactionSentBannerText: {
    color: '#ED64A6',
    fontSize: 13,
    fontWeight: '700',
  },

  // Care Section
  careSection: {},
  careSectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  careSectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#CBD5E0',
    letterSpacing: 0.2,
  },
  carePingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    gap: 5,
  },
  carePingBtnText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  careButtonsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  careButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 74,
  },
  careButtonTalk: {
    borderColor: 'rgba(251, 191, 36, 0.25)',
    backgroundColor: 'rgba(251, 191, 36, 0.04)',
  },
  careEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  careLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 13,
  },

  // Reflection Card (What partner sees about me)
  reflectionCard: {
    backgroundColor: '#12161F',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 16,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  reflectionHeading: {
    fontSize: 13,
    color: '#718096',
    fontWeight: '600',
  },
  reflectionContent: {},
  reflectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reflectionStateBox: {
    gap: 2,
  },
  reflectionMoodText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reflectionSub: {
    fontSize: 12,
    color: '#718096',
  },
  reflectionEmptyText: {
    fontSize: 13,
    color: '#718096',
  },
  updateCheckInBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  updateCheckInBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },

  // Timeline Section
  timelineSection: {
    marginTop: 8,
  },
  timelineHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#718096',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  timelineList: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#12161F',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineBody: {
    flex: 1,
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  timelineEmotion: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineTime: {
    fontSize: 11,
    color: '#718096',
  },
  timelineNote: {
    fontSize: 13,
    color: '#A0AEC0',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1A202C',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#A0AEC0',
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 18,
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
