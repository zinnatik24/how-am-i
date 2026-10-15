import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord, QuadrantId } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';

interface TrendsScreenProps {
  checkIns: CheckInRecord[];
}

export const TrendsScreen: React.FC<TrendsScreenProps> = ({ checkIns }) => {
  const { language, t } = useLanguage();

  const total = checkIns.length;

  // Calculate quadrant breakdown
  const quadrantCounts: Record<QuadrantId, number> = {
    high_unpleasant: 0,
    high_pleasant: 0,
    low_unpleasant: 0,
    low_pleasant: 0,
  };

  const emotionFrequency: Record<
    string,
    { count: number; id: string; name: string; quadrantId: QuadrantId }
  > = {};
  const contextFrequency: Record<string, number> = {};

  checkIns.forEach((item) => {
    if (quadrantCounts[item.quadrantId] !== undefined) {
      quadrantCounts[item.quadrantId]++;
    }

    // Emotion counts
    if (!emotionFrequency[item.emotionId]) {
      emotionFrequency[item.emotionId] = {
        count: 0,
        id: item.emotionId,
        name: item.emotionName,
        quadrantId: item.quadrantId,
      };
    }
    emotionFrequency[item.emotionId].count++;

    // Context counts
    [...item.context.people, ...item.context.location, ...item.context.activity].forEach((tag) => {
      contextFrequency[tag] = (contextFrequency[tag] || 0) + 1;
    });
  });

  const sortedEmotions = Object.values(emotionFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const sortedContexts = Object.entries(contextFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('trends.title')}</Text>
          <Text style={styles.subtitle}>{t('trends.subtitle')}</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyText}>{t('trends.noData')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('trends.title')}</Text>
        <Text style={styles.subtitle}>{t('trends.subtitle')}</Text>
      </View>

      {/* Total Stat Box */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryNumber}>{total}</Text>
        <Text style={styles.summaryLabel}>{t('trends.totalCheckIns')}</Text>
      </View>

      {/* Quadrant Distribution */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('trends.quadrantDistribution')}</Text>

        {(
          ['high_unpleasant', 'high_pleasant', 'low_unpleasant', 'low_pleasant'] as QuadrantId[]
        ).map((qId) => {
          const q = QUADRANTS[qId];
          const count = quadrantCounts[qId];
          const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
          const name = q.translations[language] || q.translations.en;

          return (
            <View key={qId} style={styles.distRow}>
              <View style={styles.distLabelRow}>
                <View style={[styles.colorDot, { backgroundColor: q.color_hex }]} />
                <Text style={styles.distName}>{name}</Text>
                <Text style={styles.distPercent}>{percentage}% ({count})</Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: q.color_hex,
                      width: `${Math.max(percentage, 2)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>

      {/* Top Feelings */}
      {sortedEmotions.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('trends.topEmotions')}</Text>
          <View style={styles.emotionsList}>
            {sortedEmotions.map((item, idx) => {
              const q = QUADRANTS[item.quadrantId];
              const emotionTitle = getLocalizedEmotionName(item.id, item.name, language);
              return (
                <View key={idx} style={styles.topEmotionRow}>
                  <View style={styles.topEmotionLeft}>
                    <View style={[styles.colorDot, { backgroundColor: q.color_hex }]} />
                    <Text style={styles.topEmotionName}>{emotionTitle}</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{item.count}x</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Frequent Contexts */}
      {sortedContexts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('trends.contextInfluence')}</Text>
          <View style={styles.contextGrid}>
            {sortedContexts.map(([tag, count]) => (
              <View key={tag} style={styles.contextStatPill}>
                <Text style={styles.contextStatTag}>{getLocalizedContextTag(tag, language)}</Text>
                <Text style={styles.contextStatCount}>{count}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#8C9BAE',
    fontSize: 14,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#8C9BAE',
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#141A22',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 16,
  },
  distRow: {
    marginBottom: 14,
  },
  distLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  distName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  distPercent: {
    color: '#A0AEC0',
    fontSize: 13,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#1E252E',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  emotionsList: {
    gap: 10,
  },
  topEmotionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E252E',
    padding: 12,
    borderRadius: 14,
  },
  topEmotionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topEmotionName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: '#2D3748',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  contextGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E252E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  contextStatTag: {
    color: '#CBD5E0',
    fontSize: 13,
    fontWeight: '500',
  },
  contextStatCount: {
    color: '#4FD1C5',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyText: {
    color: '#718096',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
