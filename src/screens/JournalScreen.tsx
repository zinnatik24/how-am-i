import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord } from '../types';
import { QUADRANTS } from '../data/emotionsData';
import { useLanguage } from '../i18n/LanguageContext';
import { deleteCheckIn } from '../storage/checkInStorage';
import { softDeleteCheckInApi } from '../services/api';
import { triggerHaptic } from '../utils/haptics';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';
import { shareCheckIn } from '../utils/shareHelper';

interface JournalScreenProps {
  checkIns: CheckInRecord[];
  onCheckInsUpdated: (updated: CheckInRecord[]) => void;
}

export const JournalScreen: React.FC<JournalScreenProps> = ({
  checkIns,
  onCheckInsUpdated,
}) => {
  const { language, t } = useLanguage();

  const handleDelete = (id: string) => {
    const confirmDelete = async () => {
      triggerHaptic('medium');
      // Soft-delete on cloud so data is never permanently lost
      softDeleteCheckInApi(id).catch(() => {});
      const updated = await deleteCheckIn(id);
      onCheckInsUpdated(updated);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('journal.deleteConfirm'))) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        t('journal.delete'),
        t('journal.deleteConfirm'),
        [
          { text: t('journal.cancel'), style: 'cancel' },
          { text: t('journal.delete'), style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const renderItem = ({ item }: { item: CheckInRecord }) => {
    const quadrant = QUADRANTS[item.quadrantId];
    const dateObj = new Date(item.timestamp);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = dateObj.toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US', {
      month: 'short',
      day: 'numeric',
    });
    const emotionTitle = getLocalizedEmotionName(item.emotionId, item.emotionName, language);

    return (
      <View style={[styles.card, { borderLeftColor: quadrant.color_hex }]}>
        <View style={styles.cardHeader}>
          {item.emotions && item.emotions.length > 1 ? (
            <View style={styles.headerLeft}>
              <View style={[styles.quadrantDot, { backgroundColor: quadrant.color_hex }]} />
              <Text style={styles.emotionTitle}>
                {language === 'ru'
                  ? `${item.emotions.length} чувства`
                  : `${item.emotions.length} feelings`}
              </Text>
            </View>
          ) : (
            <View style={styles.headerLeft}>
              <View style={[styles.quadrantDot, { backgroundColor: quadrant.color_hex }]} />
              <Text style={styles.emotionTitle}>{emotionTitle}</Text>
            </View>
          )}

          <View style={styles.headerRight}>
            <Text style={styles.timeLabel}>{dateStr}, {timeStr}</Text>
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                shareCheckIn(item, language);
              }}
              style={styles.actionIconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="share-outline" size={16} color="#4FD1C5" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.actionIconButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="trash-outline" size={16} color="#718096" />
            </TouchableOpacity>
          </View>
        </View>

        {/* If multiple emotions were recorded in this check-in */}
        {item.emotions && item.emotions.length > 1 && (
          <View style={styles.multiEmotionsRow}>
            {item.emotions.map((e) => {
              const q = QUADRANTS[e.quadrantId] || quadrant;
              return (
                <View
                  key={e.id}
                  style={[
                    styles.multiEmotionChip,
                    { backgroundColor: q.color_hex + '22', borderColor: q.color_hex },
                  ]}
                >
                  <View style={[styles.miniDot, { backgroundColor: q.color_hex }]} />
                  <Text style={styles.multiEmotionText}>
                    {getLocalizedEmotionName(e.id, e.name, language)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {item.note ? (
          <Text style={styles.noteText}>"{item.note}"</Text>
        ) : null}

        {/* Context tags */}
        <View style={styles.contextRow}>
          {item.context.people.map((p) => (
            <View key={p} style={styles.tag}>
              <Ionicons name="person-outline" size={12} color="#8E9BAE" />
              <Text style={styles.tagText}>{getLocalizedContextTag(p, language)}</Text>
            </View>
          ))}
          {item.context.location.map((l) => (
            <View key={l} style={styles.tag}>
              <Ionicons name="location-outline" size={12} color="#8E9BAE" />
              <Text style={styles.tagText}>{getLocalizedContextTag(l, language)}</Text>
            </View>
          ))}
          {item.context.activity.map((a) => (
            <View key={a} style={styles.tag}>
              <Ionicons name="flash-outline" size={12} color="#8E9BAE" />
              <Text style={styles.tagText}>{getLocalizedContextTag(a, language)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('journal.title')}</Text>
        <Text style={styles.subtitle}>{t('journal.subtitle')}</Text>
      </View>

      {checkIns.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="book-outline" size={48} color="#4A5568" />
          <Text style={styles.emptyTitle}>{t('journal.empty')}</Text>
          <Text style={styles.emptySubtitle}>{t('journal.emptySubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={checkIns}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0D12',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
  listContent: {
    padding: 20,
    paddingTop: 8,
    gap: 14,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#141A22',
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: '#222B36',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quadrantDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emotionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  intensityRow: {
    flexDirection: 'row',
    gap: 3,
  },
  intensityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  timeLabel: {
    color: '#718096',
    fontSize: 12,
  },
  actionIconButton: {
    padding: 6,
  },
  noteText: {
    color: '#CBD5E0',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 10,
  },
  multiEmotionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  multiEmotionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  multiEmotionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E252E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  tagText: {
    color: '#8E9BAE',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 10,
  },
  emptyTitle: {
    color: '#E2E8F0',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  emptySubtitle: {
    color: '#718096',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
});
