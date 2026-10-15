import React, { useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Emotion,
  ContextCategory,
  CheckInRecord,
  SelectedEmotionItem,
  QuadrantId,
} from '../types';
import { QUADRANTS, getEmotionColor } from '../data/emotionsData';
import { MoodMeterPlane } from '../components/MoodMeterPlane';
import { ContextSelector } from '../components/ContextSelector';
import { QuadrantCircle } from '../components/QuadrantCircle';
import { useLanguage } from '../i18n/LanguageContext';
import { saveCheckIn } from '../storage/checkInStorage';
import { triggerHaptic } from '../utils/haptics';

interface CheckInModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckInSaved: (record: CheckInRecord) => void;
}

export const CheckInModal: React.FC<CheckInModalProps> = ({
  visible,
  onClose,
  onCheckInSaved,
}) => {
  const { language, t } = useLanguage();

  // 'quadrants' = 4 big circles, 'plane' = 2D canvas of 144 bubbles, 'details' = scrollable checkin form
  const [currentView, setCurrentView] = useState<'quadrants' | 'plane' | 'details'>('quadrants');
  const [focusedQuadrant, setFocusedQuadrant] = useState<QuadrantId | null>(null);
  const [selectedEmotions, setSelectedEmotions] = useState<Emotion[]>([]);

  // Context tags & note
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<string[]>([]);
  const [noteText, setNoteText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const resetState = () => {
    setCurrentView('quadrants');
    setFocusedQuadrant(null);
    setSelectedEmotions([]);
    setSelectedPeople([]);
    setSelectedLocation([]);
    setSelectedActivity([]);
    setNoteText('');
    setIsSaving(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSelectQuadrant = (quadrantId: QuadrantId) => {
    triggerHaptic('medium');
    setFocusedQuadrant(quadrantId);
    setCurrentView('plane');
  };

  // Called when user taps an emotion bubble on the 2D plane
  const handleSelectEmotionFromPlane = (emotion: Emotion) => {
    triggerHaptic('medium');

    setSelectedEmotions((prev) => {
      const exists = prev.some((e) => e.id === emotion.id);
      if (exists) {
        return prev;
      }
      if (prev.length < 3) {
        return [...prev, emotion];
      }
      // If already 3, replace the last one or keep 3
      return [prev[0], prev[1], emotion];
    });

    // Directly navigate to details screen
    setCurrentView('details');
  };

  const handleRemoveEmotion = (id: string) => {
    triggerHaptic('light');
    setSelectedEmotions((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      if (updated.length === 0) {
        // If all removed, return to plane
        setCurrentView('plane');
      }
      return updated;
    });
  };

  const handleToggleTag = (category: ContextCategory, tagId: string) => {
    if (category === 'people') {
      setSelectedPeople((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
    } else if (category === 'location') {
      setSelectedLocation((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
    } else {
      setSelectedActivity((prev) =>
        prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
      );
    }
  };

  const handleCompleteCheckIn = async () => {
    if (selectedEmotions.length === 0) return;

    setIsSaving(true);
    triggerHaptic('success');

    const primaryEmotion = selectedEmotions[0];
    const primaryName =
      language === 'ru' ? primaryEmotion.ru.name : primaryEmotion.en.name;

    const emotionsPayload: SelectedEmotionItem[] = selectedEmotions.map((e) => ({
      id: e.id,
      name: language === 'ru' ? e.ru.name : e.en.name,
      quadrantId: e.quadrant,
      intensity: e.intensity,
    }));

    const newRecord: CheckInRecord = {
      id: `checkin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      quadrantId: primaryEmotion.quadrant,
      emotionId: primaryEmotion.id,
      emotionName: primaryName,
      intensity: primaryEmotion.intensity,
      emotions: emotionsPayload,
      context: {
        people: selectedPeople,
        location: selectedLocation,
        activity: selectedActivity,
      },
      note: noteText.trim() ? noteText.trim() : undefined,
    };

    try {
      await saveCheckIn(newRecord);
      onCheckInSaved(newRecord);
      // Immediately redirect to main home screen
      handleClose();
    } catch (e) {
      console.error('Failed to complete checkin:', e);
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalRoot}>
        {/* VIEW 1: 4 Quadrants Selection */}
        {currentView === 'quadrants' && (
          <View style={styles.quadrantsContainer}>
            {/* Top Navigation */}
            <View style={styles.quadrantsHeader}>
              <View style={styles.quadrantsHeaderTexts}>
                <Text style={styles.quadrantsTitle}>
                  {t('checkin.quadrantsTitle')}
                </Text>
                <Text style={styles.quadrantsSubtitle}>
                  {t('checkin.quadrantsSubtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.navIconButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#CBD5E0" />
              </TouchableOpacity>
            </View>

            {/* Axes & 2x2 Quadrant Circles */}
            <View style={styles.quadrantsGridWrap}>
              {/* Vertical axis: High energy indicator */}
              <View style={styles.axisVerticalTop}>
                <Ionicons name="arrow-up" size={14} color="#A0AEC0" />
                <Text style={styles.axisLabel}>
                  {language === 'ru' ? 'ВЫСОКАЯ ЭНЕРГИЯ' : 'HIGH ENERGY'}
                </Text>
              </View>

              {/* 2x2 Grid of Quadrant Circles */}
              <View style={styles.quadrantsGrid}>
                {/* Row 1: High energy (Red | Yellow) */}
                <View style={styles.quadrantsRow}>
                  <View style={styles.quadrantCircleWrapper}>
                    <QuadrantCircle
                      quadrant={QUADRANTS['high_unpleasant']}
                      onPress={() => handleSelectQuadrant('high_unpleasant')}
                    />
                  </View>
                  <View style={styles.quadrantCircleWrapper}>
                    <QuadrantCircle
                      quadrant={QUADRANTS['high_pleasant']}
                      onPress={() => handleSelectQuadrant('high_pleasant')}
                    />
                  </View>
                </View>

                {/* Horizontal axis guides between rows */}
                <View style={styles.axisHorizontalRow}>
                  <Text style={styles.axisLabel}>
                    {language === 'ru' ? '← НЕПРИЯТНО' : '← UNPLEASANT'}
                  </Text>
                  <View style={styles.axisCenterDot} />
                  <Text style={styles.axisLabel}>
                    {language === 'ru' ? 'ПРИЯТНО →' : 'PLEASANT →'}
                  </Text>
                </View>

                {/* Row 2: Low energy (Blue | Green) */}
                <View style={styles.quadrantsRow}>
                  <View style={styles.quadrantCircleWrapper}>
                    <QuadrantCircle
                      quadrant={QUADRANTS['low_unpleasant']}
                      onPress={() => handleSelectQuadrant('low_unpleasant')}
                    />
                  </View>
                  <View style={styles.quadrantCircleWrapper}>
                    <QuadrantCircle
                      quadrant={QUADRANTS['low_pleasant']}
                      onPress={() => handleSelectQuadrant('low_pleasant')}
                    />
                  </View>
                </View>
              </View>

              {/* Vertical axis: Low energy indicator */}
              <View style={styles.axisVerticalBottom}>
                <Ionicons name="arrow-down" size={14} color="#A0AEC0" />
                <Text style={styles.axisLabel}>
                  {language === 'ru' ? 'НИЗКАЯ ЭНЕРГИЯ' : 'LOW ENERGY'}
                </Text>
              </View>
            </View>

            {/* Prompt footer */}
            <View style={styles.quadrantsFooterPrompt}>
              <Text style={styles.quadrantsFooterPromptText}>
                {language === 'ru'
                  ? '💡 Нажмите на квадрант, чтобы погрузиться в карту чувств'
                  : '💡 Tap a quadrant to dive into its feeling plane'}
              </Text>
            </View>
          </View>
        )}

        {/* VIEW 2: 2D Mood Meter Plane */}
        {currentView === 'plane' && (
          <MoodMeterPlane
            language={language}
            selectedEmotions={selectedEmotions}
            focusedQuadrant={focusedQuadrant}
            onSelectEmotion={handleSelectEmotionFromPlane}
            onBack={() => {
              if (selectedEmotions.length > 0) {
                setCurrentView('details');
              } else {
                setCurrentView('quadrants');
              }
            }}
          />
        )}

        {/* VIEW 2: Check-In Details Screen with Sticky Finish Button */}
        {currentView === 'details' && (
          <View style={styles.detailsContainer}>
            {/* Top Navigation Bar */}
            <View style={styles.detailsHeader}>
              <TouchableOpacity
                onPress={() => {
                  triggerHaptic('light');
                  setFocusedQuadrant(null);
                  setCurrentView('plane');
                }}
                style={styles.navIconButton}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.detailsHeaderTitle}>
                {language === 'ru' ? 'Чекин чувств' : 'Check-in'}
              </Text>

              <TouchableOpacity onPress={handleClose} style={styles.navIconButton}>
                <Ionicons name="close" size={24} color="#CBD5E0" />
              </TouchableOpacity>
            </View>

            {/* Scrollable Form Content */}
            <ScrollView
              style={styles.detailsScrollView}
              contentContainerStyle={styles.detailsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* SECTION 1: Selected Emotions (up to 3) */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>
                    {language === 'ru' ? 'Выбранные чувства' : 'Selected Feelings'}
                  </Text>
                  <Text style={styles.countBadge}>
                    {selectedEmotions.length} / 3
                  </Text>
                </View>

                {/* Emotion Cards List */}
                <View style={styles.emotionsCardsList}>
                  {selectedEmotions.map((emotion) => {
                    const quad = QUADRANTS[emotion.quadrant];
                    const name =
                      language === 'ru' ? emotion.ru.name : emotion.en.name;
                    const definition =
                      language === 'ru'
                        ? emotion.ru.definition
                        : emotion.en.definition;
                    const bubbleColor = getEmotionColor(
                      emotion.quadrant,
                      emotion.intensity
                    );

                    return (
                      <View
                        key={emotion.id}
                        style={[
                          styles.emotionItemCard,
                          { borderLeftColor: bubbleColor },
                        ]}
                      >
                        <View style={styles.emotionItemTop}>
                          <View style={styles.emotionItemLeft}>
                            <View
                              style={[
                                styles.emotionBubbleMini,
                                { backgroundColor: bubbleColor },
                              ]}
                            >
                              <Text style={styles.emotionBubbleMiniText}>
                                {name[0]}
                              </Text>
                            </View>
                            <View>
                              <Text style={styles.emotionItemName}>{name}</Text>
                              <Text style={styles.emotionItemQuad}>
                                {quad.translations[language] || quad.translations.en}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            onPress={() => handleRemoveEmotion(emotion.id)}
                            style={styles.removeEmotionButton}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Ionicons name="close-circle" size={22} color="#718096" />
                          </TouchableOpacity>
                        </View>

                        <Text style={styles.emotionItemDef}>{definition}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* "+ Добавить эмоцию" button if less than 3 */}
                {selectedEmotions.length < 3 && (
                  <TouchableOpacity
                    style={styles.addMoreEmotionButton}
                    activeOpacity={0.8}
                    onPress={() => {
                      triggerHaptic('light');
                      setFocusedQuadrant(null);
                      setCurrentView('plane');
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={22} color="#4FD1C5" />
                    <Text style={styles.addMoreEmotionText}>
                      {language === 'ru'
                        ? `+ Добавить ещё чувство (${selectedEmotions.length}/3)`
                        : `+ Add another feeling (${selectedEmotions.length}/3)`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* SECTION 2: Add Note / Reflection */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  {language === 'ru'
                    ? 'Добавить запись / заметку'
                    : 'Add note or reflection'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {language === 'ru'
                    ? 'Опишите ваши мысли, наблюдения или что вызвало это состояние'
                    : 'Describe your thoughts, observations, or what triggered this feeling'}
                </Text>

                <TextInput
                  style={styles.noteInput}
                  multiline
                  numberOfLines={4}
                  placeholder={
                    language === 'ru'
                      ? 'Что у вас сейчас на душе? Какие мысли?...'
                      : 'What is on your mind right now? Any thoughts?...'
                  }
                  placeholderTextColor="#718096"
                  value={noteText}
                  onChangeText={setNoteText}
                />
              </View>

              {/* SECTION 3: Context Selectors (Who are you with? Where are you? What are you doing?) */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  {language === 'ru'
                    ? 'Что вы делаете прямо сейчас?'
                    : 'What are you doing right now?'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {language === 'ru'
                    ? 'С кем вы, где вы находитесь и чем заняты'
                    : 'Who you are with, where you are, and your current activity'}
                </Text>

                <ContextSelector
                  selectedPeople={selectedPeople}
                  selectedLocation={selectedLocation}
                  selectedActivity={selectedActivity}
                  onToggleTag={handleToggleTag}
                />
              </View>

              {/* Extra spacing so content is never covered by sticky bottom bar */}
              <View style={{ height: 110 }} />
            </ScrollView>

            {/* STICKY BOTTOM BUTTON: "Завершить чекин" (Always visible on scroll) */}
            <View style={styles.stickyBottomBar}>
              <TouchableOpacity
                style={[
                  styles.completeButton,
                  selectedEmotions.length === 0 && styles.completeButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={isSaving || selectedEmotions.length === 0}
                onPress={handleCompleteCheckIn}
              >
                <View style={styles.completeButtonContent}>
                  <Text style={styles.completeButtonText}>
                    {isSaving
                      ? (language === 'ru' ? 'Сохранение...' : 'Saving...')
                      : language === 'ru'
                      ? `Завершить чекин (${selectedEmotions.length})`
                      : `Complete check-in (${selectedEmotions.length})`}
                  </Text>
                  <Ionicons name="checkmark-circle" size={22} color="#000000" />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  quadrantsContainer: {
    flex: 1,
    backgroundColor: '#0A0D12',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 32 : 24,
  },
  quadrantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  quadrantsHeaderTexts: {
    flex: 1,
    paddingRight: 16,
  },
  quadrantsTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    marginBottom: 6,
  },
  quadrantsSubtitle: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 20,
  },
  quadrantsGridWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  axisVerticalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  axisVerticalBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  axisLabel: {
    color: '#718096',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quadrantsGrid: {
    width: '100%',
    maxWidth: 380,
    aspectRatio: 1,
    justifyContent: 'space-between',
  },
  quadrantsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  quadrantCircleWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisHorizontalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  axisCenterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4A5568',
  },
  quadrantsFooterPrompt: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  quadrantsFooterPromptText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: '#0A0D12',
    position: 'relative',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A202C',
    backgroundColor: '#0A0D12',
  },
  detailsHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  navIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsScrollView: {
    flex: 1,
  },
  detailsScrollContent: {
    padding: 18,
  },
  sectionCard: {
    backgroundColor: '#141820',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202632',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    color: '#8E9BAE',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  countBadge: {
    color: '#4FD1C5',
    backgroundColor: 'rgba(79, 209, 197, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '700',
  },
  emotionsCardsList: {
    gap: 10,
  },
  emotionItemCard: {
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
  },
  emotionItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  emotionItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emotionBubbleMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  emotionBubbleMiniText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 14,
  },
  emotionItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emotionItemQuad: {
    color: '#8E9BAE',
    fontSize: 12,
  },
  removeEmotionButton: {
    padding: 4,
  },
  emotionItemDef: {
    color: '#CBD5E0',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  addMoreEmotionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(79, 209, 197, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 209, 197, 0.3)',
    borderStyle: 'dashed',
    gap: 8,
  },
  addMoreEmotionText: {
    color: '#4FD1C5',
    fontSize: 15,
    fontWeight: '700',
  },
  noteInput: {
    backgroundColor: '#1A202C',
    borderRadius: 14,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  stickyBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 13, 18, 0.95)',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    borderTopWidth: 1,
    borderTopColor: '#1A202C',
  },
  completeButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  completeButtonDisabled: {
    opacity: 0.4,
  },
  completeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
