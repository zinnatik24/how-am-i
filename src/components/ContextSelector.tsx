import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CONTEXT_TAGS } from '../data/contextTags';
import { ContextTag, ContextCategory } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { triggerHaptic } from '../utils/haptics';

interface ContextSelectorProps {
  selectedPeople: string[];
  selectedLocation: string[];
  selectedActivity: string[];
  onToggleTag: (category: ContextCategory, tagId: string) => void;
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({
  selectedPeople,
  selectedLocation,
  selectedActivity,
  onToggleTag,
}) => {
  const { language, t } = useLanguage();

  const renderCategory = (
    title: string,
    category: ContextCategory,
    selectedList: string[]
  ) => {
    const tags = CONTEXT_TAGS.filter((item) => item.category === category);

    return (
      <View style={styles.categoryBlock}>
        <Text style={styles.categoryTitle}>{title}</Text>
        <View style={styles.tagWrap}>
          {tags.map((tag: ContextTag) => {
            const isSelected = selectedList.includes(tag.id);
            const label = language === 'ru' ? tag.ru : tag.en;

            return (
              <TouchableOpacity
                key={tag.id}
                activeOpacity={0.7}
                onPress={() => {
                  triggerHaptic('light');
                  onToggleTag(category, tag.id);
                }}
                style={[
                  styles.tagPill,
                  isSelected && styles.tagPillSelected,
                ]}
              >
                <Ionicons
                  name={tag.icon as any}
                  size={16}
                  color={isSelected ? '#FFFFFF' : '#8E9BAE'}
                />
                <Text
                  style={[
                    styles.tagText,
                    isSelected ? styles.tagTextSelected : styles.tagTextUnselected,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderCategory(t('checkin.whoWith'), 'people', selectedPeople)}
      {renderCategory(t('checkin.where'), 'location', selectedLocation)}
      {renderCategory(t('checkin.activity'), 'activity', selectedActivity)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
    marginVertical: 10,
  },
  categoryBlock: {},
  categoryTitle: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E252E',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  tagPillSelected: {
    backgroundColor: '#4A5568',
    borderColor: '#CBD5E0',
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  tagTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tagTextUnselected: {
    color: '#A0AEC0',
  },
});
