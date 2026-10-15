import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';

interface HomeScreenProps {
  checkIns: CheckInRecord[];
  onOpenCheckIn: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ checkIns, onOpenCheckIn }) => {
  const { language, t } = useLanguage();

  const handleStartCheckIn = () => {
    triggerHaptic('medium');
    onOpenCheckIn();
  };

  // Today's checkins count
  const todayDateStr = new Date().toDateString();
  const todayCheckIns = checkIns.filter(
    (c) => new Date(c.timestamp).toDateString() === todayDateStr
  );

  // Latest checkin
  const latestCheckIn = checkIns[0];
  const latestQuadrant = latestCheckIn ? QUADRANTS[latestCheckIn.quadrantId] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Hero Header */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>{t('home.greeting')}</Text>
        <Text style={styles.heroSubtitle}>{t('home.subtitle')}</Text>
      </View>

      {/* Mega Hero Check-In Button */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handleStartCheckIn}
        style={styles.heroCheckInCard}
      >
        <View style={styles.heroCheckInContent}>
          {/* Glowing 4-quadrant mood orb on left */}
          <View style={styles.heroMoodOrbWrap}>
            <View style={styles.heroMoodOrb}>
              <View style={styles.orbRow}>
                <View style={[styles.orbQuarter, styles.orbTL, { backgroundColor: '#FB7185' }]} />
                <View style={[styles.orbQuarter, styles.orbTR, { backgroundColor: '#FBBF24' }]} />
              </View>
              <View style={styles.orbRow}>
                <View style={[styles.orbQuarter, styles.orbBL, { backgroundColor: '#38BDF8' }]} />
                <View style={[styles.orbQuarter, styles.orbBR, { backgroundColor: '#4ADE80' }]} />
              </View>
              <View style={styles.orbCenterGleam}>
                <Text style={styles.orbGleamIcon}>✨</Text>
              </View>
            </View>
          </View>

          {/* Central Titles */}
          <View style={styles.heroCtaTexts}>
            <View style={styles.heroTagBadge}>
              <Text style={styles.heroTagBadgeText}>
                {language === 'ru' ? 'КАК Я СЕЙЧАС?' : 'HOW AM I NOW?'}
              </Text>
            </View>
            <Text style={styles.heroCtaTitle}>
              {language === 'ru' ? 'Отметить состояние' : 'Check In Now'}
            </Text>
            <Text style={styles.heroCtaSubtitle}>
              {language === 'ru'
                ? 'Прислушайтесь к себе • 4 квадранта'
                : 'Check in with yourself • 4 quadrants'}
            </Text>
          </View>

          {/* Action circular icon badge on right */}
          <View style={styles.heroActionBadge}>
            <Ionicons name="arrow-forward" size={24} color="#0A0D12" />
          </View>
        </View>

        {/* Bottom subtle quadrant indicators */}
        <View style={styles.heroBottomRow}>
          <View style={styles.heroMiniQuadRow}>
            <View style={[styles.heroMiniDot, { backgroundColor: '#FB7185' }]} />
            <Text style={styles.heroMiniQuadText}>{language === 'ru' ? 'Тревога/Гнев' : 'High / Unpleasant'}</Text>
            <View style={[styles.heroMiniDot, { backgroundColor: '#FBBF24', marginLeft: 8 }]} />
            <Text style={styles.heroMiniQuadText}>{language === 'ru' ? 'Радость' : 'High / Pleasant'}</Text>
            <View style={[styles.heroMiniDot, { backgroundColor: '#38BDF8', marginLeft: 8 }]} />
            <Text style={styles.heroMiniQuadText}>{language === 'ru' ? 'Грусть' : 'Low / Unpleasant'}</Text>
            <View style={[styles.heroMiniDot, { backgroundColor: '#4ADE80', marginLeft: 8 }]} />
            <Text style={styles.heroMiniQuadText}>{language === 'ru' ? 'Покой' : 'Low / Pleasant'}</Text>
          </View>
        </View>
      </TouchableOpacity>

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

      {/* Latest Check-In Section */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeader}>{t('home.recentCheckIn')}</Text>
        {latestCheckIn && latestQuadrant ? (
          <View
            style={[
              styles.recentCard,
              { borderLeftColor: latestQuadrant.color_hex },
            ]}
          >
            {/* If check-in has multiple emotions */}
            {latestCheckIn.emotions && latestCheckIn.emotions.length > 1 ? (
              <View style={styles.multiCheckInContent}>
                {/* Top header row: count badge + timestamp */}
                <View style={styles.recentTop}>
                  <View style={styles.multiCountBadge}>
                    <Ionicons name="sparkles" size={13} color="#4FD1C5" />
                    <Text style={styles.multiCountBadgeText}>
                      {language === 'ru'
                        ? `${latestCheckIn.emotions.length} чувства`
                        : `${latestCheckIn.emotions.length} feelings`}
                    </Text>
                  </View>
                  <Text style={styles.recentTime}>
                    {new Date(latestCheckIn.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                {/* All emotions presented equally */}
                <View style={styles.multiEmotionsGrid}>
                  {latestCheckIn.emotions.map((e) => {
                    const q = QUADRANTS[e.quadrantId] || latestQuadrant;
                    return (
                      <View
                        key={e.id}
                        style={[
                          styles.multiEmotionPill,
                          {
                            backgroundColor: q.color_hex + '20',
                            borderColor: q.color_hex,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.quadrantDotMini,
                            { backgroundColor: q.color_hex },
                          ]}
                        />
                        <Text style={styles.multiEmotionPillText}>
                          {getLocalizedEmotionName(e.id, e.name, language)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              /* Single emotion check-in */
              <View style={styles.singleCheckInContent}>
                <View style={styles.recentTop}>
                  <View style={styles.recentEmotionWrap}>
                    <View
                      style={[
                        styles.quadrantTag,
                        { backgroundColor: latestQuadrant.color_hex },
                      ]}
                    />
                    <Text style={styles.recentEmotionName}>
                      {getLocalizedEmotionName(
                        latestCheckIn.emotionId,
                        latestCheckIn.emotionName,
                        language
                      )}
                    </Text>
                  </View>
                  <Text style={styles.recentTime}>
                    {new Date(latestCheckIn.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            )}

            {/* Note if present */}
            {latestCheckIn.note && (
              <Text style={styles.recentNote} numberOfLines={3}>
                "{latestCheckIn.note}"
              </Text>
            )}

            {/* Context tags if present */}
            <View style={styles.recentContextRow}>
              {latestCheckIn.context.people.map((p) => (
                <Text key={p} style={styles.contextPill}>
                  @{getLocalizedContextTag(p, language)}
                </Text>
              ))}
              {latestCheckIn.context.location.map((l) => (
                <Text key={l} style={styles.contextPill}>
                  📍{getLocalizedContextTag(l, language)}
                </Text>
              ))}
              {latestCheckIn.context.activity.map((a) => (
                <Text key={a} style={styles.contextPill}>
                  ⚡{getLocalizedContextTag(a, language)}
                </Text>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyRecentCard}>
            <Ionicons name="sparkles-outline" size={28} color="#718096" />
            <Text style={styles.emptyRecentText}>{t('home.noRecent')}</Text>
          </View>
        )}
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
    paddingTop: 10,
    paddingBottom: 40,
  },
  heroSection: {
    marginBottom: 20,
  },
  heroPretitle: {
    color: '#718096',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginBottom: 6,
  },
  heroSubtitle: {
    color: '#A0AEC0',
    fontSize: 15,
    lineHeight: 22,
  },
  heroCheckInCard: {
    backgroundColor: '#131922',
    borderWidth: 1.5,
    borderColor: '#263342',
    borderRadius: 24,
    padding: 18,
    marginBottom: 24,
    shadowColor: '#4FD1C5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  heroCheckInContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroMoodOrbWrap: {
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroMoodOrb: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#0F131A',
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    position: 'relative',
  },
  orbRow: {
    flexDirection: 'row',
    gap: 3,
  },
  orbQuarter: {
    width: 27,
    height: 27,
  },
  orbTL: {
    borderTopLeftRadius: 16,
    borderBottomRightRadius: 4,
  },
  orbTR: {
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
  },
  orbBL: {
    borderBottomLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  orbBR: {
    borderBottomRightRadius: 16,
    borderTopLeftRadius: 4,
  },
  orbCenterGleam: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(10, 13, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbGleamIcon: {
    fontSize: 10,
  },
  heroCtaTexts: {
    flex: 1,
  },
  heroTagBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(79, 209, 197, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 5,
  },
  heroTagBadgeText: {
    color: '#4FD1C5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroCtaTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  heroCtaSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  heroActionBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  heroBottomRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroMiniQuadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  heroMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  heroMiniQuadText: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#141A22',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  statNumber: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8C9BAE',
    fontSize: 13,
    fontWeight: '500',
  },
  sectionBlock: {
    marginBottom: 28,
  },
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSub: {
    color: '#718096',
    fontSize: 13,
    marginBottom: 14,
  },
  recentCard: {
    backgroundColor: '#141A22',
    borderRadius: 18,
    padding: 18,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  recentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentEmotionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quadrantTag: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recentEmotionName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  recentTime: {
    color: '#718096',
    fontSize: 13,
    fontWeight: '600',
  },
  recentNote: {
    color: '#CBD5E0',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  multiEmotionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  multiEmotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  multiEmotionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  recentContextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  contextPill: {
    color: '#8C9BAE',
    fontSize: 12,
    backgroundColor: '#1E252E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  emptyRecentCard: {
    backgroundColor: '#141A22',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2D3748',
  },
  emptyRecentText: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
  },
  multiCheckInContent: {
    marginBottom: 8,
  },
  multiCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  multiCountBadgeText: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  multiEmotionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  multiEmotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  quadrantDotMini: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  multiEmotionPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  singleCheckInContent: {
    marginBottom: 6,
  },
});
