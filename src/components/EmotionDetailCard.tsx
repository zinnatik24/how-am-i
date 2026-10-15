import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Emotion, Quadrant } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface EmotionDetailCardProps {
  emotion: Emotion;
  quadrant: Quadrant;
}

export const EmotionDetailCard: React.FC<EmotionDetailCardProps> = ({ emotion, quadrant }) => {
  const { language, t } = useLanguage();
  const emotionData = emotion[language] || emotion.en;

  const getIntensityLabel = (intensity: number) => {
    if (intensity === 1) return t('checkin.intensity1');
    if (intensity === 2) return t('checkin.intensity2');
    return t('checkin.intensity3');
  };

  return (
    <View style={[styles.card, { borderLeftColor: quadrant.color_hex }]}>
      <View style={styles.headerRow}>
        <Text style={styles.emotionName}>{emotionData.name}</Text>
        <View style={[styles.intensityBadge, { backgroundColor: quadrant.color_hex }]}>
          <Text style={styles.intensityText}>
            {t('checkin.intensityLabel')}: {getIntensityLabel(emotion.intensity)}
          </Text>
        </View>
      </View>
      <Text style={styles.definitionText}>{emotionData.definition}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E252E',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    marginVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emotionName: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  intensityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  intensityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  definitionText: {
    color: '#A0AEC0',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
