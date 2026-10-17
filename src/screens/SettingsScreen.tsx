import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Linking,
  TextInput,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SupportedLanguage, CheckInRecord } from '../types';
import {
  clearAllCheckIns,
  getDefaultShareWithPartners,
  setDefaultShareWithPartners,
} from '../storage/checkInStorage';
import { triggerHaptic } from '../utils/haptics';
import {
  createTelegramAuthSessionApi,
  checkTelegramAuthSessionStatusApi,
} from '../services/api';

interface SettingsScreenProps {
  onCheckInsUpdated: (records: CheckInRecord[]) => void;
}

interface MethodologyLink {
  titleRu: string;
  titleEn: string;
  url: string;
}

interface MethodologySection {
  id: string;
  titleRu: string;
  titleEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  contentRu: string[];
  contentEn: string[];
  links?: MethodologyLink[];
}

const METHODOLOGY_DATA: MethodologySection[] = [
  {
    id: 'mood_meter',
    titleRu: 'Что такое измеритель настроения (Mood Meter)?',
    titleEn: 'What is the Mood Meter?',
    icon: 'compass-outline',
    color: '#4FD1C5',
    contentRu: [
      'Измеритель настроения (Mood Meter) — научно обоснованная методика Йельского центра эмоционального интеллекта, созданная профессором Марком Брэккеттом (Marc Brackett, Ph.D.).',
      'В основе лежит двухмерная модель аффекта: любое эмоциональное состояние человека раскладывается на две фундаментальные нейробиологические шкалы:',
      '• Энергия (физиологическая активация: от глубокого покоя до максимального возбуждения тела).',
      '• Приятность (субъективная валентность переживания: от крайне неприятного до вдохновляющего удовольствия).',
      'Пересечение этих осей образует 4 цветовых квадранта, вмещающих 144 тонких эмоциональных оттенка.',
    ],
    contentEn: [
      'The Mood Meter is an evidence-based tool developed at the Yale Center for Emotional Intelligence by Dr. Marc Brackett and colleagues.',
      'It maps emotions across two core neurobiological dimensions:',
      '• Energy (physiological arousal from low to high).',
      '• Pleasantness (subjective valence from unpleasant to pleasant).',
      'The intersection forms four color-coded quadrants containing 144 nuanced emotional states.',
    ],
    links: [
      {
        titleRu: 'Официальный сайт Йельского центра эмоционального интеллекта (YCEI)',
        titleEn: 'Official Yale Center for Emotional Intelligence (YCEI)',
        url: 'https://www.ycei.org/',
      },
      {
        titleRu: 'Профессор Марк Брэккетт: научный профиль в Йельском университете',
        titleEn: 'Prof. Marc Brackett: Yale Faculty Profile & Research',
        url: 'https://medicine.yale.edu/profile/marc-brackett/',
      },
    ],
  },
  {
    id: 'quadrants_meaning',
    titleRu: '4 квадранта: биологический смысл каждого состояния',
    titleEn: 'The 4 Quadrants: Biological purpose of each state',
    icon: 'grid-outline',
    color: '#FBBF24',
    contentRu: [
      '🔴 Красный (Высокая энергия, неприятно): Злость, тревога, страх, стресс, паника. Это режим мобилизации организма при угрозе или нарушении личных границ. Полезен для быстрой защиты, но требует своевременного снятия напряжения, чтобы не вызывать выгорание.',
      '🟡 Жёлтый (Высокая энергия, приятно): Радость, воодушевление, интерес, гордость, восторг. Состояние креативности, энтузиазма и открытости новому. Идеально для генерации идей, командной работы, преодоления вызовов и праздника.',
      '🔵 Синий (Низкая энергия, неприятно): Грусть, усталость, тоска, разочарование, апатия. Биологический сигнал о потере ресурса или потребности в замедлении. Помогает глубокому переосмыслению ценностей, аналитической работе и эмпатии.',
      '🟢 Зелёный (Низкая энергия, приятно): Спокойствие, умиротворение, благодарность, безмятежность. Активация парасимпатической нервной системы (восстановление, отдых). Укрепляет доверие в отношениях и глубокое обучение.',
    ],
    contentEn: [
      '🔴 Red (High energy, unpleasant): Anger, anxiety, stress. A survival mobilization state for handling acute threats. Effective short-term, but draining if prolonged.',
      '🟡 Yellow (High energy, pleasant): Joy, excitement, curiosity. High-creativity and social bonding zone. Optimal for problem-solving, collaboration, and learning.',
      '🔵 Blue (Low energy, unpleasant): Sadness, fatigue, disappointment. A signal to slow down, reflect, and repair emotional reserves. Good for analytical thinking and empathy.',
      '🟢 Green (Low energy, pleasant): Calm, gratitude, serenity. Rest and digest state (parasympathetic dominance). Essential for deep recovery and emotional restoration.',
    ],
    links: [
      {
        titleRu: 'Методология RULER Йельского университета (официальная страница)',
        titleEn: 'Yale RULER Methodology (Official Yale Page)',
        url: 'https://www.ycei.org/ruler-approach',
      },
      {
        titleRu: 'Циркумплексная 2D-модель аффекта: научный обзор и модель',
        titleEn: 'Circumplex Model of Affect (Scientific Overview)',
        url: 'https://en.wikipedia.org/wiki/Emotion_classification#Circumplex_model',
      },
    ],
  },
  {
    id: 'granularity',
    titleRu: 'Эмоциональная гранулярность (точность терминов)',
    titleEn: 'Emotional Granularity & Mental Health',
    icon: 'sparkles-outline',
    color: '#818CF8',
    contentRu: [
      'Эмоциональная гранулярность — способность различать и точно называть свои чувства (например, отличать досаду от зависти или тревогу от возбуждения).',
      'Исследования показывают, что переход от обобщённых «мне плохо» или «всё нормально» к точным понятиям снижает гиперактивность миндалевидного тела на 40% и мгновенно активирует зоны рационального контроля в префронтальной коре мозга («Назови, чтобы приручить»).',
      'Регулярные чекины расширяют словарь чувств, формируя гибкую психическую устойчивость.',
    ],
    contentEn: [
      'Emotional granularity is the skill of identifying and expressing nuanced emotional states rather than vague terms like "bad" or "fine".',
      'Neuroimaging demonstrates that putting precise feelings into words decreases amygdala reactivity and activates the prefrontal cortex ("Name it to tame it").',
      'Daily tracking broadens your emotional vocabulary, boosting resilience and interpersonal clarity.',
    ],
    links: [
      {
        titleRu: 'ФМРТ-исследование в Science: «Putting Feelings into Words» (Lieberman et al., 2007)',
        titleEn: 'Brain Imaging in Science: "Putting Feelings into Words" (Lieberman et al., 2007)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/17576282/',
      },
      {
        titleRu: 'Эмоциональная гранулярность: фундаментальные исследования Лизы Фельдман Барретт',
        titleEn: 'Emotional Granularity Research: Dr. Lisa Feldman Barrett',
        url: 'https://en.wikipedia.org/wiki/Emotional_granularity',
      },
    ],
  },
  {
    id: 'ruler_practice',
    titleRu: 'Система RULER: 5 шагов осознанности',
    titleEn: 'The RULER Framework: 5 steps of awareness',
    icon: 'bulb-outline',
    color: '#F472B6',
    contentRu: [
      'RULER — акроним Йельской системы эмоциональной грамотности:',
      '1. Recognize (Распознать): заметить телесные ощущения, пульс и дыхание.',
      '2. Understand (Понять): выявить глубинные причины и внешние триггеры текущего состояния.',
      '3. Label (Назвать): выбрать точное слово на карте чувств.',
      '4. Express (Выразить): бережно и экологично донести чувство до себя и близких.',
      '5. Regulate (Управлять): подобрать здоровые техники заботы (дыхание, пауза, прогулка, разговор).',
    ],
    contentEn: [
      'RULER stands for five essential emotional skills:',
      '1. Recognize physical cues and shifts in bodily energy.',
      '2. Understand the causes and triggers of the feeling.',
      '3. Label with precise emotional vocabulary.',
      '4. Express constructively in conversations and actions.',
      '5. Regulate using intentional strategies to support your well-being.',
    ],
    links: [
      {
        titleRu: 'Йельская медицинская школа: Child Study Center исследования',
        titleEn: 'Yale School of Medicine: Child Study Center Research',
        url: 'https://medicine.yale.edu/childstudy/',
      },
      {
        titleRu: 'Исследовательские программы Йельского центра (YCEI)',
        titleEn: 'Yale Center for Emotional Intelligence Initiatives',
        url: 'https://www.ycei.org/what-we-do',
      },
    ],
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onCheckInsUpdated }) => {
  const { language, setLanguage, t } = useLanguage();
  const {
    user,
    isAuthenticated,
    signInWithGoogle,
    signInWithTelegram,
    signInWithApple,
    applyAuthSession,
    signOut,
  } = useAuth();

  const isRu = language === 'ru';

  // Dropdown state for Language selection
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);

  // Accordion state for methodology items
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    mood_meter: false,
    quadrants_meaning: false,
    granularity: false,
    ruler_practice: false,
  });

  // Copied toast banner
  const [isCopiedToast, setIsCopiedToast] = useState(false);

  // Default sharing with partners setting
  const [defaultShareWithPartners, setDefaultShareWithPartnersState] = useState(true);

  useEffect(() => {
    getDefaultShareWithPartners().then((val) => {
      setDefaultShareWithPartnersState(val);
    });
  }, []);

  const handleToggleDefaultShare = async (val: boolean) => {
    triggerHaptic('light');
    setDefaultShareWithPartnersState(val);
    await setDefaultShareWithPartners(val);
  };

  // Telegram Login State
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramSubmitting, setTelegramSubmitting] = useState(false);
  const [isWaitingForBot, setIsWaitingForBot] = useState(false);
  const [botAuthCode, setBotAuthCode] = useState<string | null>(null);

  // Apple Login State (for Web fallback / email linking)
  const [isAppleModalOpen, setIsAppleModalOpen] = useState(false);
  const [appleEmailInput, setAppleEmailInput] = useState('');
  const [appleSubmitting, setAppleSubmitting] = useState(false);

  // Telegram Bot Deep Link Polling
  useEffect(() => {
    let timer: any = null;
    if (isWaitingForBot && botAuthCode) {
      timer = setInterval(async () => {
        try {
          const res = await checkTelegramAuthSessionStatusApi(botAuthCode);
          if (res.completed && res.token && res.user) {
            clearInterval(timer);
            setIsWaitingForBot(false);
            setBotAuthCode(null);
            setIsTelegramModalOpen(false);
            await applyAuthSession({ token: res.token, user: res.user });
            Alert.alert(
              isRu ? 'Успешный вход через Telegram!' : 'Telegram Sign In Successful!',
              isRu ? `Добро пожаловать, ${res.user.name}!` : `Welcome, ${res.user.name}!`
            );
          }
        } catch (e) {
          // ignore transient poll error
        }
      }, 2000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isWaitingForBot, botAuthCode]);

  const handleStartBotAuth = async () => {
    triggerHaptic('medium');
    setTelegramSubmitting(true);
    try {
      const session = await createTelegramAuthSessionApi();
      if (session.success && session.botUrl) {
        if (session.botUsername === 'HowAmI_App_Bot') {
          Alert.alert(
            isRu ? 'Бот еще не зарегистрирован' : 'Bot not registered',
            isRu
              ? 'Telegram-бот @HowAmI_App_Bot еще не создан в @BotFather.\n\nИспользуйте мгновенный вход по @username — он работает прямо сейчас без необходимости создавать бота!'
              : 'The bot @HowAmI_App_Bot is not yet registered in @BotFather. Please use direct @username login!',
            [
              { text: isRu ? 'Ввести @username' : 'Use username', style: 'default' },
              {
                text: isRu ? 'Всё равно открыть' : 'Open anyway',
                style: 'destructive',
                onPress: () => {
                  setBotAuthCode(session.authCode);
                  setIsWaitingForBot(true);
                  Linking.openURL(session.botUrl);
                },
              },
            ]
          );
          return;
        }
        setBotAuthCode(session.authCode);
        setIsWaitingForBot(true);
        await Linking.openURL(session.botUrl);
      }
    } catch (e: any) {
      Alert.alert(isRu ? 'Ошибка' : 'Error', e.message || 'Не удалось запустить авторизацию через бота');
    } finally {
      setTelegramSubmitting(false);
    }
  };

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
      Alert.alert(
        isRu ? 'Введите email' : 'Enter email',
        isRu ? 'Укажите ваш Apple ID или email' : 'Please enter your Apple ID or email'
      );
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
      Alert.alert(isRu ? 'Ошибка' : 'Error', e.message || 'Не удалось войти');
    } finally {
      setAppleSubmitting(false);
    }
  };

  const handleTelegramLoginPress = () => {
    triggerHaptic('medium');
    setIsWaitingForBot(false);
    setBotAuthCode(null);
    // Check if inside Telegram WebApp
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
      Alert.alert(
        isRu ? 'Введите никнейм' : 'Enter username',
        isRu ? 'Пожалуйста, укажите ваш Telegram @username или имя' : 'Please enter your Telegram @username or name'
      );
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
      Alert.alert(isRu ? 'Ошибка' : 'Error', e.message || 'Не удалось войти');
    } finally {
      setTelegramSubmitting(false);
    }
  };

  const toggleSection = (id: string) => {
    triggerHaptic('light');
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleSelectLanguage = async (newLang: SupportedLanguage) => {
    triggerHaptic('light');
    await setLanguage(newLang);
    setIsLangDropdownOpen(false);
  };

  // Copy Invite Code
  const handleCopyInviteCode = async () => {
    if (!user) return;
    triggerHaptic('medium');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(user.inviteCode);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 2500);
    } else {
      Alert.alert(isRu ? 'Код скопирован' : 'Code copied', user.inviteCode);
    }
  };

  // Share Smart Invite Link
  const handleShareInviteLink = async () => {
    if (!user) return;
    triggerHaptic('medium');
    const origin =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin
        : 'https://how-am-i.famehub.ru';
    const fromName = encodeURIComponent(user.name || 'Близкий человек');
    const url = `${origin}/?invite=${user.inviteCode}&from=${fromName}#friends`;
    const shareText = isRu
      ? `Привет! Я отмечаю своё состояние в приложении «Как Я?». Давай будем на связи, чтобы бережно делиться тем, как мы себя чувствуем:\n${url}`
      : `Hi! I'm tracking how I feel in the "How Am I?" app. Let's connect so we can stay close and gently share how we're doing:\n${url}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Как Я?',
          text: shareText,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 2500);
    } else {
      Alert.alert(isRu ? 'Приглашение скопировано' : 'Invite copied', shareText);
    }
  };

  // Sign out confirmation
  const handleSignOutConfirm = () => {
    triggerHaptic('medium');
    if (Platform.OS === 'web') {
      if (window.confirm(isRu ? 'Вы уверены, что хотите выйти из профиля?' : 'Are you sure you want to sign out?')) {
        signOut();
      }
    } else {
      Alert.alert(
        isRu ? 'Выход из профиля' : 'Sign Out',
        isRu ? 'Вы уверены, что хотите выйти?' : 'Are you sure you want to sign out?',
        [
          { text: isRu ? 'Отмена' : 'Cancel', style: 'cancel' },
          { text: isRu ? 'Выйти' : 'Sign Out', style: 'destructive', onPress: signOut },
        ]
      );
    }
  };



  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Toast Notification */}
      {isCopiedToast && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#4FD1C5" />
          <Text style={styles.toastText}>
            {isRu ? 'Скопировано в буфер обмена!' : 'Copied to clipboard!'}
          </Text>
        </View>
      )}

      {/* Screen Title */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
        <Text style={styles.subtitle}>
          {isRu ? 'Профиль, язык и психология методики' : 'Profile, language & psychological methodology'}
        </Text>
      </View>

      {/* 1. USER PROFILE SECTION */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{isRu ? 'Профиль и аккаунт' : 'Profile & Account'}</Text>

        {isAuthenticated && user ? (
          <View style={styles.profileCard}>
            <View style={styles.profileHeaderRow}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user.name ? user.name.charAt(0).toUpperCase() : 'Я'}
                </Text>
              </View>
              <View style={styles.profileInfoText}>
                <Text style={styles.profileName}>{user.name}</Text>
                <Text style={styles.profileEmail}>
                  {user.email || (user.name ? `@${user.name}` : 'Личный аккаунт')}
                </Text>
                <View style={styles.authBadgePill}>
                  <Ionicons
                    name={
                      Boolean(user.appleId || user.email?.includes('apple'))
                        ? 'logo-apple'
                        : Boolean(user.telegramId || user.telegramUsername || user.email?.includes('telegram') || (user as any).google_id?.startsWith('tg:'))
                        ? 'paper-plane'
                        : 'logo-google'
                    }
                    size={11}
                    color="#4FD1C5"
                  />
                  <Text style={styles.authBadgeText}>
                    {Boolean(user.appleId || user.email?.includes('apple'))
                      ? 'Apple ID'
                      : Boolean(user.telegramId || user.telegramUsername || user.email?.includes('telegram') || (user as any).google_id?.startsWith('tg:'))
                      ? (user.telegramUsername ? `@${user.telegramUsername}` : 'Telegram')
                      : 'Google Account'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Invite Code Box */}
            <View style={styles.inviteBox}>
              <View style={styles.inviteInfoRow}>
                <View>
                  <Text style={styles.inviteLabel}>{isRu ? 'Ваш личный инвайт-код' : 'Your invite code'}</Text>
                  <Text style={styles.inviteCodeText}>{user.inviteCode}</Text>
                </View>
                <TouchableOpacity
                  style={styles.copyCodeBtn}
                  onPress={handleCopyInviteCode}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={15} color="#0A0D12" />
                  <Text style={styles.copyCodeBtnText}>{isRu ? 'Код' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.shareLinkBtn}
                onPress={handleShareInviteLink}
                activeOpacity={0.85}
              >
                <Ionicons name="paper-plane-outline" size={17} color="#4FD1C5" />
                <Text style={styles.shareLinkBtnText}>
                  {isRu ? 'Поделиться ссылкой-приглашением' : 'Share invite link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Out Button */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOutConfirm}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={17} color="#FC8181" />
              <Text style={styles.signOutBtnText}>{isRu ? 'Выйти из аккаунта' : 'Sign Out'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.guestCard}>
            <View style={styles.guestBadgeRow}>
              <View style={styles.guestBadge}>
                <Text style={styles.guestBadgeText}>{isRu ? 'Гостевой режим' : 'Guest Mode'}</Text>
              </View>
            </View>
            <Text style={styles.guestTitle}>
              {isRu ? 'Сохраняйте чекины в облаке' : 'Save your check-ins to cloud'}
            </Text>
            <Text style={styles.guestDesc}>
              {isRu
                ? 'Войдите, чтобы защитить историю записей, синхронизировать данные и общаться в чатах с близкими.'
                : 'Sign in to protect your history, synchronize across devices and connect with your partner.'}
            </Text>

            {/* 1. Apple Sign-In (App Store Guideline 4.8 compliant) */}
            <TouchableOpacity
              style={styles.appleBtn}
              onPress={handleAppleLoginPress}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
              <Text style={styles.appleBtnText}>
                {isRu ? 'Войти с Apple' : 'Sign in with Apple'}
              </Text>
            </TouchableOpacity>

            {/* 2. Telegram Sign-In */}
            <TouchableOpacity
              style={styles.telegramBtn}
              onPress={handleTelegramLoginPress}
              activeOpacity={0.85}
            >
              <Ionicons name="paper-plane" size={18} color="#FFFFFF" />
              <Text style={styles.telegramBtnText}>
                {isRu ? 'Войти через Telegram' : 'Sign in with Telegram'}
              </Text>
            </TouchableOpacity>

            {/* 3. Google Sign-In */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={signInWithGoogle}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-google" size={18} color="#0A0D12" />
              <Text style={styles.googleBtnText}>
                {isRu ? 'Войти через Google' : 'Sign in with Google'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. LANGUAGE DROPDOWN SELECTOR */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <Text style={styles.sectionSubtitle}>{t('settings.languageSelect')}</Text>

        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownHeader}
            onPress={() => {
              triggerHaptic('light');
              setIsLangDropdownOpen(!isLangDropdownOpen);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.dropdownHeaderLeft}>
              <Text style={styles.dropdownFlag}>{language === 'ru' ? '🇷🇺' : '🇬🇧'}</Text>
              <Text style={styles.dropdownSelectedText}>
                {language === 'ru' ? 'Русский (Russian)' : 'English (English)'}
              </Text>
            </View>
            <Ionicons
              name={isLangDropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#A0AEC0"
            />
          </TouchableOpacity>

          {isLangDropdownOpen && (
            <View style={styles.dropdownMenu}>
              <TouchableOpacity
                style={[styles.dropdownItem, language === 'ru' && styles.dropdownItemActive]}
                onPress={() => handleSelectLanguage('ru')}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemRow}>
                  <Text style={styles.dropdownFlag}>🇷🇺</Text>
                  <View>
                    <Text style={[styles.dropdownItemTitle, language === 'ru' && styles.dropdownItemTitleActive]}>
                      Русский
                    </Text>
                    <Text style={styles.dropdownItemSub}>Russian</Text>
                  </View>
                </View>
                {language === 'ru' && (
                  <Ionicons name="checkmark" size={18} color="#4FD1C5" />
                )}
              </TouchableOpacity>

              <View style={styles.dropdownDivider} />

              <TouchableOpacity
                style={[styles.dropdownItem, language === 'en' && styles.dropdownItemActive]}
                onPress={() => handleSelectLanguage('en')}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownItemRow}>
                  <Text style={styles.dropdownFlag}>🇬🇧</Text>
                  <View>
                    <Text style={[styles.dropdownItemTitle, language === 'en' && styles.dropdownItemTitleActive]}>
                      English
                    </Text>
                    <Text style={styles.dropdownItemSub}>English</Text>
                  </View>
                </View>
                {language === 'en' && (
                  <Ionicons name="checkmark" size={18} color="#4FD1C5" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* 2b. DEFAULT SHARING WITH PARTNERS SETTING */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {isRu ? 'Приватность и близкие' : 'Privacy & Partners'}
        </Text>
        <Text style={styles.sectionSubtitle}>
          {isRu
            ? 'Настройте отправку чекинов вашим партнерам по умолчанию'
            : 'Configure default check-in sharing behavior for your inner circle'}
        </Text>

        <TouchableOpacity
          style={styles.shareSettingCard}
          activeOpacity={0.85}
          onPress={() => handleToggleDefaultShare(!defaultShareWithPartners)}
        >
          <View style={styles.shareSettingLeft}>
            <View
              style={[
                styles.shareSettingIconCircle,
                !defaultShareWithPartners && styles.shareSettingIconCircleOff,
              ]}
            >
              <Ionicons
                name={defaultShareWithPartners ? 'people' : 'lock-closed'}
                size={20}
                color={defaultShareWithPartners ? '#4FD1C5' : '#A0AEC0'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={styles.shareSettingTitle}>
                  {isRu ? 'Отправлять чекины близким' : 'Share check-ins with partners'}
                </Text>
                <View
                  style={[
                    styles.shareSettingBadge,
                    !defaultShareWithPartners ? styles.shareSettingBadgeOff : styles.shareSettingBadgeOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.shareSettingBadgeText,
                      !defaultShareWithPartners ? styles.shareSettingBadgeTextOff : styles.shareSettingBadgeTextOn,
                    ]}
                  >
                    {defaultShareWithPartners
                      ? (isRu ? 'Да' : 'Yes')
                      : (isRu ? 'Нет' : 'No')}
                  </Text>
                </View>
              </View>
              <Text style={styles.shareSettingDesc}>
                {defaultShareWithPartners
                  ? (isRu
                      ? 'Включено по умолчанию: новые чекины сразу видны близким'
                      : 'Enabled by default: new check-ins are visible to your partners')
                  : (isRu
                      ? 'Выключено по умолчанию: чекины личные. В конце чекина нужно включить тумблер вручную'
                      : 'Disabled by default: check-ins are private. You pull the switch at the end')}
              </Text>
            </View>
          </View>
          <Switch
            value={defaultShareWithPartners}
            onValueChange={handleToggleDefaultShare}
            trackColor={{ false: '#4A5568', true: '#319795' }}
            thumbColor={defaultShareWithPartners ? '#4FD1C5' : '#CBD5E0'}
          />
        </TouchableOpacity>
      </View>

      {/* 3. EXPANDABLE YALE METHODOLOGY SECTION (СВЕРНУТЫЙ ТЕКСТ) */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name="school" size={20} color="#FBBF24" />
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>
            {isRu ? 'О методике Yale Mood Meter' : 'Yale Mood Meter Methodology'}
          </Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          {isRu
            ? 'Научный фундамент эмоционального интеллекта. Нажмите на раздел, чтобы узнать больше:'
            : 'Evidence-based emotional intelligence. Tap a section to expand details:'}
        </Text>

        <View style={styles.accordionContainer}>
          {METHODOLOGY_DATA.map((item) => {
            const isExpanded = !!expandedSections[item.id];
            const title = isRu ? item.titleRu : item.titleEn;
            const paragraphs = isRu ? item.contentRu : item.contentEn;

            return (
              <View key={item.id} style={styles.accordionCard}>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  onPress={() => toggleSection(item.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.accordionIconCircle, { backgroundColor: `${item.color}20` }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={styles.accordionTitle}>{title}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color="#A0AEC0"
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View style={styles.accordionBody}>
                    {paragraphs.map((p, idx) => (
                      <Text key={idx} style={styles.accordionParagraph}>
                        {p}
                      </Text>
                    ))}

                    {/* Scientific Research & Yale University Links */}
                    {item.links && item.links.length > 0 && (
                      <View style={styles.accordionLinksBox}>
                        <Text style={styles.accordionLinksTitle}>
                          {isRu
                            ? 'Официальные научные источники и Йельский университет:'
                            : 'Official Research & Yale University Resources:'}
                        </Text>
                        {item.links.map((link, lIdx) => (
                          <TouchableOpacity
                            key={lIdx}
                            style={styles.accordionLinkBtn}
                            onPress={() => {
                              triggerHaptic('light');
                              Linking.openURL(link.url);
                            }}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="link" size={14} color="#4FD1C5" />
                            <Text style={styles.accordionLinkText}>
                              {isRu ? link.titleRu : link.titleEn}
                            </Text>
                            <Ionicons
                              name="open-outline"
                              size={13}
                              color="#718096"
                              style={{ marginLeft: 'auto' }}
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </View>



      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>{t('settings.version')} • Yale Mood Meter Framework</Text>
      </View>

      {/* Telegram Login Modal */}
      <Modal
        visible={isTelegramModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsTelegramModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.telegramIconCircle}>
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.modalTitle}>
                  {isRu ? 'Вход через Telegram' : 'Sign in with Telegram'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsTelegramModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#718096" />
              </TouchableOpacity>
            </View>

            {isWaitingForBot ? (
              <View style={styles.botWaitingContainer}>
                <ActivityIndicator size="large" color="#2AABEE" style={{ marginBottom: 14 }} />
                <Text style={styles.botWaitingTitle}>
                  {isRu ? 'Ожидание подтверждения...' : 'Waiting for confirmation...'}
                </Text>
                <Text style={styles.botWaitingDesc}>
                  {isRu
                    ? 'Нажмите кнопку СТАРТ в открывшемся Telegram-боте. Приложение автоматически выполнит вход.'
                    : 'Tap START in the Telegram bot. The app will complete login automatically.'}
                </Text>
                <TouchableOpacity
                  style={styles.cancelBotWaitBtn}
                  onPress={() => {
                    setIsWaitingForBot(false);
                    setBotAuthCode(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBotWaitBtnText}>{isRu ? 'Назад к вводу никнейма' : 'Back to username input'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>
                  {isRu
                    ? 'Укажите ваш Telegram @username для мгновенного входа в аккаунт:'
                    : 'Enter your Telegram @username for instant sign-in:'}
                </Text>

                <TextInput
                  style={styles.telegramInput}
                  placeholder={isRu ? '@username (например: @durov)' : '@username (e.g. @durov)'}
                  placeholderTextColor="#718096"
                  value={telegramInput}
                  onChangeText={setTelegramInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleTelegramSubmit}
                />

                <TouchableOpacity
                  style={[styles.telegramSubmitBtn, telegramSubmitting && { opacity: 0.6 }]}
                  onPress={handleTelegramSubmit}
                  disabled={telegramSubmitting}
                  activeOpacity={0.85}
                >
                  <Ionicons name="paper-plane" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.telegramSubmitBtnText}>
                    {telegramSubmitting
                      ? (isRu ? 'Вход...' : 'Signing in...')
                      : (isRu ? 'Войти по никнейму Telegram' : 'Sign in by Telegram Username')}
                  </Text>
                </TouchableOpacity>

                <View style={styles.orDividerRow}>
                  <View style={styles.orDividerLine} />
                  <Text style={styles.orDividerText}>{isRu ? 'ИЛИ ЧЕРЕЗ БОТА' : 'OR VIA BOT'}</Text>
                  <View style={styles.orDividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.telegramDeepLinkBtn}
                  onPress={handleStartBotAuth}
                  disabled={telegramSubmitting}
                  activeOpacity={0.85}
                >
                  <Ionicons name="radio-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.telegramSubmitBtnText}>
                    {telegramSubmitting
                      ? (isRu ? 'Подготовка...' : 'Preparing...')
                      : (isRu ? 'Открыть бота в Telegram (Deep Link)' : 'Open Telegram Bot (Deep Link)')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Apple Login Modal (for Web / non-native fallback) */}
      <Modal
        visible={isAppleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAppleModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.telegramIconCircle, { backgroundColor: '#000000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.modalTitle}>
                  {isRu ? 'Вход через Apple ID' : 'Sign in with Apple ID'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAppleModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#718096" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {isRu
                ? 'На iPhone в приложении из App Store вход происходит нативно по Face ID. В веб-версии укажите ваш Apple ID (email) для входа и синхронизации с аккаунтом:'
                : 'In the iOS app, Apple Sign In uses Face ID. On the web, enter your Apple ID email to link or sign in:'}
            </Text>

            <TextInput
              style={styles.telegramInput}
              placeholder={isRu ? 'ваш_email@icloud.com' : 'your_email@icloud.com'}
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
              style={[styles.appleBtn, { width: '100%', marginBottom: 10 }, appleSubmitting && { opacity: 0.6 }]}
              onPress={handleAppleSubmit}
              disabled={appleSubmitting}
              activeOpacity={0.85}
            >
              <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
              <Text style={styles.appleBtnText}>
                {appleSubmitting
                  ? (isRu ? 'Вход...' : 'Signing in...')
                  : (isRu ? 'Войти с этим Apple ID' : 'Sign in with this Apple ID')}
              </Text>
            </TouchableOpacity>

            <Text style={styles.appleHintText}>
              {isRu
                ? '💡 Если вы ранее входили через Google с этим же email, аккаунты свяжутся автоматически.'
                : '💡 If you previously signed in with Google using this email, your account will be linked automatically.'}
            </Text>
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  toastBanner: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    zIndex: 99,
    backgroundColor: '#1E293B',
    borderColor: '#4FD1C5',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#718096',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#718096',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },

  // Profile Card Styles
  profileCard: {
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A365D',
    borderWidth: 2,
    borderColor: '#4FD1C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: {
    color: '#E2E8F0',
    fontSize: 20,
    fontWeight: '800',
  },
  profileInfoText: {
    flex: 1,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    color: '#718096',
    fontSize: 13,
    marginTop: 2,
  },
  inviteBox: {
    backgroundColor: '#0F151C',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 10,
  },
  inviteInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inviteLabel: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '500',
  },
  inviteCodeText: {
    color: '#4FD1C5',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4FD1C5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  copyCodeBtnText: {
    color: '#0A0D12',
    fontSize: 12,
    fontWeight: '700',
  },
  shareLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
    gap: 8,
  },
  shareLinkBtnText: {
    color: '#4FD1C5',
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(252, 129, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(252, 129, 129, 0.25)',
    gap: 8,
  },
  signOutBtnText: {
    color: '#FC8181',
    fontSize: 14,
    fontWeight: '600',
  },

  // Guest Card
  guestCard: {
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    borderRadius: 20,
    padding: 18,
  },
  guestBadgeRow: {
    marginBottom: 8,
  },
  guestBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  guestBadgeText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '700',
  },
  guestTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  guestDesc: {
    color: '#718096',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 10,
  },
  googleBtnText: {
    color: '#0A0D12',
    fontSize: 15,
    fontWeight: '700',
  },
  demoLinkBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  demoLinkBtnText: {
    color: '#4FD1C5',
    fontSize: 13,
    fontWeight: '600',
  },

  // Dropdown Styles
  dropdownContainer: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#222B36',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownFlag: {
    fontSize: 22,
  },
  dropdownSelectedText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dropdownMenu: {
    marginTop: 6,
    backgroundColor: '#141A22',
    borderWidth: 1.5,
    borderColor: '#2D3748',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(79, 209, 197, 0.08)',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownItemTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownItemTitleActive: {
    color: '#4FD1C5',
    fontWeight: '700',
  },
  dropdownItemSub: {
    color: '#718096',
    fontSize: 11,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#1F2937',
  },

  // Accordion Styles
  accordionContainer: {
    gap: 10,
  },
  accordionCard: {
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    borderRadius: 16,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  accordionIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accordionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1A232F',
    gap: 8,
  },
  accordionParagraph: {
    color: '#CBD5E0',
    fontSize: 13,
    lineHeight: 20,
  },
  accordionLinksBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E2636',
    gap: 8,
  },
  accordionLinksTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E9BAE',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  accordionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161C26',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#242E3E',
    gap: 8,
  },
  accordionLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4FD1C5',
    flex: 1,
    lineHeight: 16,
  },

  // Action Buttons
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    borderRadius: 14,
    paddingVertical: 14,
    gap: 10,
  },
  dangerButton: {
    borderColor: 'rgba(252, 129, 129, 0.25)',
    backgroundColor: 'rgba(252, 129, 129, 0.05)',
  },
  dangerButtonText: {
    color: '#FC8181',
    fontSize: 14,
    fontWeight: '600',
  },

  // Footer
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  versionText: {
    color: '#4A5568',
    fontSize: 12,
    fontWeight: '500',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#141A22',
    borderWidth: 1,
    borderColor: '#222B36',
    borderRadius: 20,
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#718096',
    fontSize: 13,
    marginBottom: 16,
  },
  modalProfileBtn: {
    backgroundColor: '#1A232F',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  modalProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  telegramBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2AABEE',
    borderRadius: 14,
    paddingVertical: 12,
    gap: 10,
    marginTop: 10,
  },
  telegramBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  telegramIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2AABEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telegramInput: {
    backgroundColor: '#0F151C',
    borderWidth: 1,
    borderColor: '#2D3748',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 16,
  },
  telegramSubmitBtn: {
    backgroundColor: '#2AABEE',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  telegramSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderRadius: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 10,
  },
  appleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  telegramDeepLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2AABEE',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginBottom: 14,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  orDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#222B36',
  },
  orDividerText: {
    color: '#718096',
    fontSize: 12,
    fontWeight: '700',
  },
  botWaitingContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  botWaitingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  botWaitingDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  cancelBotWaitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1E2634',
  },
  cancelBotWaitBtnText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  authBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    borderColor: 'rgba(79, 209, 197, 0.25)',
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  authBadgeText: {
    color: '#4FD1C5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  appleHintText: {
    color: '#718096',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 6,
  },
  shareSettingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161C24',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#263040',
  },
  shareSettingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10,
  },
  shareSettingIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareSettingIconCircleOff: {
    backgroundColor: '#232A36',
  },
  shareSettingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F7FAFC',
  },
  shareSettingDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  shareSettingBadge: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  shareSettingBadgeOn: {
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
  },
  shareSettingBadgeOff: {
    backgroundColor: '#2D3748',
  },
  shareSettingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  shareSettingBadgeTextOn: {
    color: '#4FD1C5',
  },
  shareSettingBadgeTextOff: {
    color: '#A0AEC0',
  },
});

