import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { SupportedLanguage, CheckInRecord } from '../types';
import { clearAllCheckIns } from '../storage/checkInStorage';
import { triggerHaptic } from '../utils/haptics';

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
        titleRu: 'Д-р Марк Брэккетт: лаборатория и книга «Permission to Feel»',
        titleEn: 'Dr. Marc Brackett: Research Lab & "Permission to Feel"',
        url: 'https://www.marcbrackett.com/',
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
        titleRu: 'Йельская методология RULER и доказательная база',
        titleEn: 'Yale RULER Approach & Evidence Base',
        url: 'https://www.ycei.org/ruler',
      },
      {
        titleRu: 'Научное исследование: циркумплексная модель аффекта (Russell & Barrett)',
        titleEn: 'Circumplex Model of Affect (Russell & Barrett, PubMed)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/11142416/',
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
        titleRu: 'ФМРТ-исследование в Science: «Putting Feelings into Words» (Lieberman et al.)',
        titleEn: 'Brain Imaging in Science: "Putting Feelings into Words" (Lieberman et al.)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/17576282/',
      },
      {
        titleRu: 'Исследования гранулярности и здоровья: Лиза Фельдман Барретт',
        titleEn: 'Emotional Granularity & Mental Health: Dr. Lisa Feldman Barrett',
        url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4663189/',
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
        titleRu: 'Научные публикации YCEI об эмоциональной грамотности',
        titleEn: 'YCEI Research Publications on Emotional Intelligence',
        url: 'https://www.ycei.org/research',
      },
    ],
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onCheckInsUpdated }) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAuthenticated, signInWithGoogle, signInDemo, signOut } = useAuth();

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
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

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
      ? `Привет! Я делюсь настроением в приложении «Как я?». Давай свяжемся: ${url}`
      : `Hi! I'm sharing my mood in the "How Am I?" app. Connect with me: ${url}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        await (navigator as any).share({
          title: 'Как я? — Близкий круг',
          text: shareText,
          url,
        });
        return;
      } catch (e) {
        // Fallback to clipboard
      }
    }

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setIsCopiedToast(true);
      setTimeout(() => setIsCopiedToast(false), 2500);
    } else {
      Alert.alert(isRu ? 'Ссылка скопирована' : 'Link copied', url);
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

  // Clear local checkins
  const handleClearData = () => {
    const executeClear = async () => {
      triggerHaptic('medium');
      await clearAllCheckIns();
      onCheckInsUpdated([]);
      if (Platform.OS === 'web') {
        alert(t('settings.clearDataSuccess'));
      } else {
        Alert.alert(t('settings.title'), t('settings.clearDataSuccess'));
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('settings.clearDataConfirm'))) {
        executeClear();
      }
    } else {
      Alert.alert(
        t('settings.clearData'),
        t('settings.clearDataConfirm'),
        [
          { text: t('journal.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: executeClear },
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
                <Text style={styles.profileEmail}>{user.email || 'Google Account'}</Text>
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

            <TouchableOpacity
              style={styles.demoLinkBtn}
              onPress={() => setIsDemoModalOpen(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.demoLinkBtnText}>
                {isRu ? '⚡ Быстрый вход (Демо-аккаунт)' : '⚡ Quick Demo Login'}
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

      {/* 4. DATA MANAGEMENT (CLEANED UP: LOAD DEMO PERMANENTLY REMOVED) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.dataManagement')}</Text>
        <Text style={styles.sectionSubtitle}>
          {isRu ? 'Управление сохранёнными данными' : 'Manage your stored data'}
        </Text>

        <TouchableOpacity
          style={[styles.actionButton, styles.dangerButton]}
          onPress={handleClearData}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={18} color="#FC8181" />
          <Text style={styles.dangerButtonText}>
            {isRu ? 'Очистить локальный кэш записей' : 'Clear local records cache'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>{t('settings.version')} • Yale Mood Meter Framework</Text>
      </View>

      {/* Demo Sign-in Modal */}
      <Modal
        visible={isDemoModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDemoModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{isRu ? 'Быстрый демо-вход' : 'Quick Demo Sign In'}</Text>
              <TouchableOpacity onPress={() => setIsDemoModalOpen(false)}>
                <Ionicons name="close" size={22} color="#A0AEC0" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {isRu
                ? 'Выберите профиль для проверки синхронизации:'
                : 'Choose a demo profile to test sync:'}
            </Text>

            <TouchableOpacity
              style={[styles.modalProfileBtn, { borderColor: '#4299E1' }]}
              onPress={async () => {
                setIsDemoModalOpen(false);
                await signInDemo('Вася', 'vasya@example.com');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalProfileBtnText}>⚡ Войти как Вася (vasya@example.com)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalProfileBtn, { borderColor: '#ED64A6', marginTop: 10 }]}
              onPress={async () => {
                setIsDemoModalOpen(false);
                await signInDemo('Лиана', 'liana@example.com');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.modalProfileBtnText}>⚡ Войти как Лиана (liana@example.com)</Text>
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
    padding: 20,
    paddingTop: 16,
    paddingBottom: 60,
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
});
