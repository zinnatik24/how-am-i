import React, { useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';
import { shareCheckIn } from '../utils/shareHelper';
import { CheckInCard } from '../components/CheckInCard';
import { getRandomQuote, PsychologicalQuote } from '../data/quotesData';

interface HomeScreenProps {
  checkIns: CheckInRecord[];
  onOpenCheckIn: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ checkIns, onOpenCheckIn }) => {
  const { language, t } = useLanguage();
  const isRu = language === 'ru';

  // Tactile press animation for the main check-in button
  const [btnScale] = useState(new Animated.Value(1));

  // Daily random psychological quote (50+ curated quotes)
  const [currentQuote, setCurrentQuote] = useState<PsychologicalQuote>(() => getRandomQuote());

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.94,
      useNativeDriver: true,
      friction: 8,
      tension: 100,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 40,
    }).start();
  };

  const handleStartCheckIn = () => {
    triggerHaptic('medium');
    onOpenCheckIn();
  };

  const handleNextQuote = () => {
    triggerHaptic('light');
    setCurrentQuote((prev) => getRandomQuote(prev.id));
  };

  // Today's checkins count
  const todayDateStr = new Date().toDateString();
  const todayCheckIns = checkIns.filter(
    (c) => new Date(c.timestamp).toDateString() === todayDateStr
  );

  // Latest checkin
  const latestCheckIn = checkIns[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Header (Greeting only, removed "спокойный вдох") */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{t('home.greeting')}</Text>
      </View>

      {/* Lone Tactile Check-In Button (Pure Zen Minimalism, No Surrounding Box, No Extra Texts) */}
      <View style={styles.loneCheckInContainer}>
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <TouchableOpacity
            style={styles.zenSquircleButton}
            onPress={handleStartCheckIn}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.88}
          >
            <View style={styles.squircleIconBadge}>
              <Ionicons name="sparkles" size={32} color="#4FD1C5" />
            </View>
            <Text style={styles.zenSquircleBtnTitle}>
              {isRu ? 'Отметить\nсостояние' : 'Check In\nNow'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{todayCheckIns.length}</Text>
          <Text style={styles.statLabel}>{t('home.todayCount')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {checkIns.length > 0 ? '1' : '0'}
          </Text>
          <Text style={styles.statLabel}>{t('home.streak')}</Text>
        </View>
      </View>

      {/* Latest Check-In Section (Unified with message check-in cards) */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>{t('home.recentCheckIn')}</Text>
        {latestCheckIn ? (
          <CheckInCard
            record={latestCheckIn}
            language={language}
            onShare={(rec) => shareCheckIn(rec, language)}
            defaultExpanded={false}
          />
        ) : (
          <View style={styles.emptyRecentCard}>
            <Ionicons name="sparkles-outline" size={28} color="#718096" />
            <Text style={styles.emptyRecentText}>{t('home.noRecent')}</Text>
          </View>
        )}
      </View>

      {/* Curated Psychological Quote of the Day (50+ Quotes) */}
      <View style={styles.quoteCard}>
        <View style={styles.quoteHeaderRow}>
          <View style={styles.quoteBadge}>
            <Ionicons name="bulb-outline" size={14} color="#FBBF24" />
            <Text style={styles.quoteBadgeText}>
              {isRu ? 'МЫСЛЬ ДНЯ' : 'THOUGHT OF THE DAY'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.quoteRefreshBtn}
            onPress={handleNextQuote}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="refresh" size={15} color="#A0AEC0" />
            <Text style={styles.quoteRefreshText}>{isRu ? 'Другая мысль' : 'Refresh'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.quoteText}>
          «{isRu ? currentQuote.textRu : currentQuote.textEn}»
        </Text>

        <View style={styles.quoteAuthorRow}>
          <View style={styles.quoteAuthorLine} />
          <Text style={styles.quoteAuthorText}>
            {isRu ? currentQuote.authorRu : currentQuote.authorEn}
          </Text>
        </View>
      </View>
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
    paddingTop: 12,
    paddingBottom: 50,
  },
  heroSection: {
    marginBottom: 14,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
  },
  loneCheckInContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  zenSquircleButton: {
    width: 170,
    height: 170,
    backgroundColor: '#141A24',
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(79, 209, 197, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  squircleIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  zenSquircleBtnTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#121620',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E2532',
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '800',
    color: '#4FD1C5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E9BAE',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#718096',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  emptyRecentCard: {
    backgroundColor: '#121620',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E2532',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyRecentText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  quoteCard: {
    backgroundColor: '#121620',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#242C3C',
    padding: 18,
    marginBottom: 24,
  },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quoteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
    letterSpacing: 0.6,
  },
  quoteRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quoteRefreshText: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#E2E8F0',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  quoteAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quoteAuthorLine: {
    width: 20,
    height: 1.5,
    backgroundColor: '#4FD1C5',
  },
  quoteAuthorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
