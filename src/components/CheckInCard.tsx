import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckInRecord, QuadrantId, SupportedLanguage } from '../types';
import { QUADRANTS, getEmotionColor } from '../data/emotionsData';
import { getLocalizedEmotionName, getLocalizedContextTag } from '../utils/localizationHelper';
import { getEmotionsInsight } from '../utils/emotionInsight';
import { triggerHaptic } from '../utils/haptics';
import { QuadrantIcon } from './QuadrantIcon';

interface CheckInCardProps {
  record: CheckInRecord;
  language: SupportedLanguage;
  senderName?: string;
  isSelf?: boolean;
  onShare?: (record: CheckInRecord) => void;
  onDelete?: (id: string) => void;
  defaultExpanded?: boolean;
}

export const CheckInCard: React.FC<CheckInCardProps> = ({
  record,
  language,
  senderName,
  isSelf = true,
  onShare,
  onDelete,
  defaultExpanded = false,
}) => {
  const isRu = language === 'ru';
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const quadrant = QUADRANTS[record.quadrantId] || QUADRANTS.low_pleasant;
  const quadColor = quadrant?.color_hex || '#4FD1C5';

  const dateObj = new Date(record.timestamp);
  const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = dateObj.toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
    month: 'short',
    day: 'numeric',
  });

  const getQuadrantColorById = (qId?: string) => {
    if (!qId) return quadColor;
    if (qId === 'high_pleasant' || qId.includes('yellow')) return '#ECC94B';
    if (qId === 'low_pleasant' || qId.includes('green')) return '#48BB78';
    if (qId === 'low_unpleasant' || qId.includes('blue')) return '#4299E1';
    if (qId === 'high_unpleasant' || qId.includes('red')) return '#F56565';
    return QUADRANTS[qId as QuadrantId]?.color_hex || quadColor;
  };

  const getQuadrantEmojiById = (qId?: string) => {
    if (!qId) return '💛';
    if (qId === 'high_pleasant' || qId.includes('yellow')) return '💛';
    if (qId === 'low_pleasant' || qId.includes('green')) return '💚';
    if (qId === 'low_unpleasant' || qId.includes('blue')) return '💙';
    if (qId === 'high_unpleasant' || qId.includes('red')) return '❤️';
    return '💛';
  };

  const emotionsList =
    record.emotions && record.emotions.length > 0
      ? record.emotions
      : [
          {
            id: record.emotionId,
            name: record.emotionName || record.emotionId,
            quadrantId: record.quadrantId,
            intensity: record.intensity || 2,
          },
        ];

  const rawNote = (record.note || '').trim();
  const showNote =
    rawNote.length > 0 && !rawNote.toLowerCase().startsWith('отметил');

  const insight = getEmotionsInsight(emotionsList, language);

  return (
    <View style={[styles.cardOuter, { borderColor: `${quadColor}40` }]}>
      {/* Top Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.avatarDot,
              { backgroundColor: `${quadColor}33`, borderColor: quadColor },
            ]}
          >
            <Ionicons name="sparkles" size={12} color={quadColor} />
          </View>
          <View>
            <Text style={styles.headerTitle}>
              {senderName
                ? senderName
                : isRu
                ? 'Отметка состояния'
                : 'Mood Check-in'}
            </Text>
            <Text style={styles.headerTime}>
              {dateStr}, {timeStr}
            </Text>
          </View>
        </View>

        {/* Actions (Share, Delete) */}
        <View style={styles.headerActions}>
          {onShare && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('light');
                onShare(record);
              }}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="share-outline" size={17} color="#4FD1C5" />
            </TouchableOpacity>
          )}

          {onDelete && (
            <TouchableOpacity
              onPress={() => {
                triggerHaptic('medium');
                onDelete(record.id);
              }}
              style={styles.actionBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={17} color="#718096" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Emotion Badges (1, 2, or 3 emotions) */}
      <View style={styles.emotionsWrap}>
        {emotionsList.map((em, idx) => {
          const emColor = getQuadrantColorById(em.quadrantId || record.quadrantId);
          const emEmoji = getQuadrantEmojiById(em.quadrantId || record.quadrantId);
          const localizedName = getLocalizedEmotionName(em.id, em.name, language);

          return (
            <View
              key={`em_${idx}_${em.id}`}
              style={[
                styles.emotionPill,
                {
                  backgroundColor: `${emColor}22`,
                  borderColor: `${emColor}66`,
                },
              ]}
            >
              <QuadrantIcon quadrantId={em.quadrantId || record.quadrantId} size={15} />
              <Text style={[styles.emotionPillText, { color: '#FFFFFF' }]}>
                {localizedName.toUpperCase()}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Note / Thought block */}
      {showNote ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteText}>«{rawNote}»</Text>
        </View>
      ) : null}

      {/* Context Tags Row (People, Location, Activity) */}
      {record.context &&
        ((record.context.people?.length || 0) > 0 ||
          (record.context.location?.length || 0) > 0 ||
          (record.context.activity?.length || 0) > 0) && (
          <View style={styles.contextRow}>
            {record.context.people?.map((p, i) => (
              <View key={`p-${i}`} style={styles.contextChip}>
                <Ionicons name="people-outline" size={12} color="#8E9BAE" style={{ marginRight: 4 }} />
                <Text style={styles.contextChipText}>{getLocalizedContextTag(p, language)}</Text>
              </View>
            ))}
            {record.context.location?.map((l, i) => (
              <View key={`l-${i}`} style={styles.contextChip}>
                <Ionicons name="location-outline" size={12} color="#8E9BAE" style={{ marginRight: 4 }} />
                <Text style={styles.contextChipText}>{getLocalizedContextTag(l, language)}</Text>
              </View>
            ))}
            {record.context.activity?.map((a, i) => (
              <View key={`a-${i}`} style={styles.contextChip}>
                <Ionicons name="flash-outline" size={12} color="#8E9BAE" style={{ marginRight: 4 }} />
                <Text style={styles.contextChipText}>{getLocalizedContextTag(a, language)}</Text>
              </View>
            ))}
          </View>
        )}

      {/* Expandable Psychological Insight Section */}
      <View style={styles.insightSection}>
        <TouchableOpacity
          style={styles.insightToggleBtn}
          onPress={() => {
            triggerHaptic('light');
            setIsExpanded((prev) => !prev);
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isExpanded ? 'book' : 'book-outline'}
            size={14}
            color="#4FD1C5"
          />
          <Text style={styles.insightToggleBtnText}>
            {isExpanded
              ? isRu
                ? 'Скрыть разбор чувств'
                : 'Hide psychological insight'
              : isRu
              ? 'О чём эти чувства?'
              : 'What do these feelings mean?'}
          </Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#4FD1C5"
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.insightExpandedBox}>
            {/* Coherent narrative if 2+ emotions */}
            {Boolean(insight.narrative) && (
              <Text style={styles.insightNarrativeText}>
                {insight.narrative}
              </Text>
            )}

            {/* Individual emotion cards */}
            <View style={styles.insightItemsList}>
              {insight.items.map((item, idx) => (
                <View key={`ins_${idx}_${item.id}`} style={styles.insightItemCard}>
                  <View style={styles.insightItemHeader}>
                    <QuadrantIcon quadrantId={item.quadrantId} size={14} />
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
    </View>
  );
};

const styles = StyleSheet.create({
  cardOuter: {
    backgroundColor: '#121620',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.2,
  },
  headerTime: {
    fontSize: 12,
    color: '#8E9BAE',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    padding: 4,
  },
  emotionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  emotionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  emotionPillEmoji: {
    fontSize: 13,
  },
  emotionPillText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  noteBox: {
    backgroundColor: '#171D28',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4FD1C5',
    marginBottom: 12,
  },
  noteText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  contextChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2230',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  contextChipText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  insightSection: {
    borderTopWidth: 1,
    borderTopColor: '#1E2636',
    paddingTop: 10,
    marginTop: 2,
  },
  insightToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  insightToggleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4FD1C5',
  },
  insightExpandedBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1A2230',
  },
  insightNarrativeText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 19,
    fontStyle: 'italic',
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#161D2A',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ECC94B',
  },
  insightItemsList: {
    gap: 8,
  },
  insightItemCard: {
    backgroundColor: '#161C26',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#242E3E',
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
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  insightItemQuadName: {
    fontSize: 11,
    color: '#718096',
    marginLeft: 'auto',
  },
  insightItemDefText: {
    fontSize: 12,
    color: '#A0AEC0',
    lineHeight: 17,
  },
});
